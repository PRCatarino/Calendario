const express = require('express');
const multer = require('multer');
const { Readable } = require('stream');
const { withConn, oracledb } = require('../db');
const google = require('../google');
const auth = require('../auth');
const logger = require('../logger');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

function driveId(coverUrl) {
  if (!coverUrl) return null;
  const m = coverUrl.match(/\/d\/([\w-]+)/) || coverUrl.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}

// auto-detect whether a Drive file is image or video (content-type + magic bytes).
// requires the file to be public; falls back to 'image' if undetectable.
async function detectCoverType(coverUrl) {
  const id = driveId(coverUrl);
  if (!id) return 'image';
  try {
    const r = await fetch(
      `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`,
      { headers: { Range: 'bytes=0-63' } },
    );
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('text/html')) return 'image'; // private / sign-in page
    if (ct.startsWith('video')) return 'video';
    if (ct.startsWith('image')) return 'image';
    const buf = Buffer.from(await r.arrayBuffer());
    if (buf.length >= 8 && buf.toString('ascii', 4, 8) === 'ftyp') return 'video'; // mp4/mov
    if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video'; // webm/mkv
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xd8) return 'image'; // jpeg
    if (buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50) return 'image'; // png
    if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'GIF8') return 'image';
    if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image';
    return 'image';
  } catch {
    return 'image';
  }
}

// GET /api/meetings/:id/cover  — proxy Drive media through our origin so it
// plays in <img>/<video> without 3rd-party cookies / Drive login wall.
// Uses flexible auth (token via header or ?t=) since media tags can't set headers.
router.get('/:id/cover', auth.requireAuthFlexible, async (req, res, next) => {
  try {
    const r = await withConn((c) =>
      c.execute(`SELECT cover_url, cover_type, client_id FROM meetings WHERE id = :id`, { id: req.params.id }),
    );
    if (!r.rows.length || !r.rows[0].COVER_URL) return res.status(404).end();
    const row = r.rows[0];
    if (req.user.role === 'CLIENT' && row.CLIENT_ID !== req.user.id) return res.status(403).end();

    const wantThumb = req.query.thumb === '1';

    // thumb: prefer a stored captured frame (e.g. mid-video frame) over Drive's thumbnail
    if (wantThumb) {
      const blobRow = await withConn((c) =>
        c.execute(`SELECT image_blob, image_mime FROM meetings WHERE id = :id`, { id: req.params.id }),
      );
      if (blobRow.rows.length && blobRow.rows[0].IMAGE_BLOB) {
        res.setHeader('Content-Type', blobRow.rows[0].IMAGE_MIME || 'image/jpeg');
        return res.send(blobRow.rows[0].IMAGE_BLOB);
      }
    }

    const id = driveId(row.COVER_URL);
    if (!id) return res.status(404).end();

    // thumb=1 -> a frame/thumbnail image (used as the meeting cover, incl. video frame);
    // otherwise stream the full media (for the <video> player).
    const upstreamUrl = wantThumb
      ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000`
      : `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;

    const range = req.headers.range;
    const upstream = await fetch(upstreamUrl, {
      headers: range && !wantThumb ? { Range: range } : {},
      redirect: 'follow',
    });

    const upstreamType = upstream.headers.get('content-type') || '';
    if (upstreamType.includes('text/html')) {
      return res.status(409).json({ error: 'arquivo do Drive nao esta publico (compartilhe como "qualquer pessoa com o link")' });
    }

    res.status(upstream.status);
    if (!wantThumb) {
      for (const h of ['content-length', 'accept-ranges', 'content-range']) {
        const v = upstream.headers.get(h);
        if (v) res.setHeader(h, v);
      }
    }
    const ctype = wantThumb
      ? 'image/jpeg'
      : row.COVER_TYPE === 'video'
        ? 'video/mp4'
        : upstreamType || 'image/jpeg';
    res.setHeader('Content-Type', ctype);

    if (!upstream.body) return res.end();
    Readable.fromWeb(upstream.body).pipe(res);
  } catch (e) { next(e); }
});

// every other meetings route requires a logged-in account (header token)
router.use(auth.requireAuth);

function toJson(row) {
  return {
    id: row.ID,
    client_id: row.CLIENT_ID,
    client_name: row.CLIENT_NAME,
    title: row.TITLE,
    starts_at: row.STARTS_AT,
    ends_at: row.ENDS_AT,
    notes: row.NOTES,
    has_image: row.HAS_IMAGE === 1,
    image_url: row.HAS_IMAGE === 1 ? `/api/meetings/${row.ID}/image` : null,
    cover_url: row.COVER_URL,
    cover_type: row.COVER_TYPE || 'image',
    status: row.STATUS,
    reject_reason: row.REJECT_REASON,
    google_event_id: row.GOOGLE_EVENT_ID,
  };
}

const SELECT = `SELECT m.id, m.client_id, m.client_name, m.title, m.starts_at, m.ends_at, m.notes,
  CASE WHEN m.image_blob IS NULL THEN 0 ELSE 1 END AS has_image, m.cover_url, m.cover_type,
  m.status, m.reject_reason, m.google_event_id`;

// GET /api/meetings?from=ISO&to=ISO[&client_id=]
// CLIENT: always scoped to own account. ADMIN: all, or filtered by client_id.
router.get('/', async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const binds = {};
    const conds = [];

    if (req.user.role === 'CLIENT') {
      conds.push('m.client_id = :scopeId');
      binds.scopeId = req.user.id;
    } else if (req.query.client_id) {
      const cid = Number(req.query.client_id);
      if (!Number.isInteger(cid)) return res.status(400).json({ error: 'client_id invalido' });
      conds.push('m.client_id = :scopeId');
      binds.scopeId = cid;
    }
    if (from && to) {
      conds.push('m.starts_at < :toTs AND m.ends_at > :fromTs');
      binds.fromTs = new Date(from);
      binds.toTs = new Date(to);
    }
    const where = conds.length ? ` WHERE ${conds.join(' AND ')}` : '';
    const rows = await withConn((c) =>
      c.execute(`${SELECT} FROM meetings m${where} ORDER BY m.starts_at`, binds),
    );
    res.json(rows.rows.map(toJson));
  } catch (e) { next(e); }
});

// GET /api/meetings/:id/image  (owner client or admin)
router.get('/:id/image', async (req, res, next) => {
  try {
    const r = await withConn((c) =>
      c.execute(`SELECT image_blob, image_mime, client_id FROM meetings WHERE id = :id`, { id: req.params.id }),
    );
    if (!r.rows.length || !r.rows[0].IMAGE_BLOB) return res.status(404).end();
    if (req.user.role === 'CLIENT' && r.rows[0].CLIENT_ID !== req.user.id) {
      return res.status(403).end();
    }
    res.setHeader('Content-Type', r.rows[0].IMAGE_MIME || 'application/octet-stream');
    res.send(r.rows[0].IMAGE_BLOB);
  } catch (e) { next(e); }
});

// POST /api/meetings  (ADMIN only) multipart incl. client_id
router.post('/', auth.requireAdmin, upload.single('image'), async (req, res, next) => {
  try {
    const { client_id, client_name, title, starts_at, ends_at, notes, cover_url } = req.body;
    if (!client_id || !starts_at || !ends_at) {
      return res.status(400).json({ error: 'client_id, starts_at, ends_at required' });
    }
    const cid = Number(client_id);
    if (!Number.isInteger(cid)) return res.status(400).json({ error: 'client_id invalido' });
    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (startDate.getTime() < Date.now() - 60_000) {
      return res.status(400).json({ error: 'nao e possivel agendar no passado' });
    }
    if (endDate <= startDate) {
      return res.status(400).json({ error: 'hora final deve ser depois da inicial' });
    }
    // auto-detect image vs video from the Drive content (no manual choice)
    const covType = cover_url ? await detectCoverType(cover_url) : 'image';
    const binds = {
      cid,
      cn: client_name || null,
      ti: title || null,
      st: new Date(starts_at),
      en: new Date(ends_at),
      no: notes || null,
      cov: cover_url || null,
      covt: covType,
      img: req.file ? req.file.buffer : null,
      mime: req.file ? req.file.mimetype : null,
      id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };
    const result = await withConn((c) =>
      c.execute(
        `INSERT INTO meetings (client_id, client_name, title, starts_at, ends_at, notes, cover_url, cover_type, image_blob, image_mime)
         VALUES (:cid, :cn, :ti, :st, :en, :no, :cov, :covt, :img, :mime) RETURNING id INTO :id`,
        binds, { autoCommit: true },
      ),
    );
    const id = result.outBinds.id[0];
    logger.info('meeting created', { id, clientId: cid, type: covType, by: req.user.username });

    let googleEventId = null;
    try {
      googleEventId = await google.pushEvent({ client_name, title, notes, starts_at, ends_at });
      if (googleEventId) {
        await withConn((c) => c.execute(
          `UPDATE meetings SET google_event_id = :g WHERE id = :id`,
          { g: googleEventId, id }, { autoCommit: true },
        ));
        logger.info('meeting pushed to google calendar', { id, googleEventId });
      }
    } catch (e) { logger.error('google push failed', { id, message: e.message }); }

    res.status(201).json({ id, cover_type: covType, google_event_id: googleEventId });
  } catch (e) { next(e); }
});

// POST /api/meetings/:id/cover-frame  (ADMIN) multipart 'frame' -> store captured frame as cover image
router.post('/:id/cover-frame', auth.requireAdmin, upload.single('frame'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'frame obrigatorio' });
    await withConn((c) =>
      c.execute(
        `UPDATE meetings SET image_blob = :img, image_mime = :mime WHERE id = :id`,
        { img: req.file.buffer, mime: req.file.mimetype || 'image/jpeg', id: req.params.id },
        { autoCommit: true },
      ),
    );
    logger.info('cover frame stored', { id: Number(req.params.id), bytes: req.file.size });
    res.status(204).end();
  } catch (e) { next(e); }
});

// PATCH /api/meetings/:id/status  { status, reason? }
// CLIENT (owner): only from PENDING -> APPROVED (no reason) or REJECTED (reason required); locked after.
// ADMIN: any transition anytime (can reset to PENDING, edit reason).
router.patch('/:id/status', async (req, res, next) => {
  try {
    const { status, reason } = req.body || {};
    const VALID = ['PENDING', 'APPROVED', 'REJECTED'];
    if (!VALID.includes(status)) return res.status(400).json({ error: 'status invalido' });

    const r = await withConn((c) =>
      c.execute(`SELECT client_id, status FROM meetings WHERE id = :id`, { id: req.params.id }),
    );
    if (!r.rows.length) return res.status(404).json({ error: 'reuniao nao encontrada' });
    const current = r.rows[0];

    const isAdmin = req.user.role === 'ADMIN';
    const isOwner = req.user.role === 'CLIENT' && current.CLIENT_ID === req.user.id;
    if (!isAdmin && !isOwner) return res.status(403).json({ error: 'sem permissao' });

    if (!isAdmin) {
      // client constraints
      if (current.STATUS !== 'PENDING') {
        return res.status(403).json({ error: 'status ja definido; somente o admin pode alterar' });
      }
      if (status === 'PENDING') {
        return res.status(400).json({ error: 'cliente nao pode redefinir como pendente' });
      }
    }
    if (status === 'REJECTED' && !reason) {
      return res.status(400).json({ error: 'motivo obrigatorio ao reprovar' });
    }

    const finalReason = status === 'REJECTED' ? reason : null;
    await withConn((c) =>
      c.execute(
        `UPDATE meetings SET status = :st, reject_reason = :rr,
           status_changed_by = :chgby, status_changed_at = SYSTIMESTAMP WHERE id = :id`,
        { st: status, rr: finalReason, chgby: req.user.id, id: req.params.id },
        { autoCommit: true },
      ),
    );

    logger.info('meeting status changed', {
      id: Number(req.params.id), status, by: req.user.username, role: req.user.role,
    });
    const updated = await withConn((c) =>
      c.execute(`${SELECT} FROM meetings m WHERE m.id = :id`, { id: req.params.id }),
    );
    res.json(toJson(updated.rows[0]));
  } catch (e) { next(e); }
});

// DELETE /api/meetings/:id  (ADMIN only)
router.delete('/:id', auth.requireAdmin, async (req, res, next) => {
  try {
    const r = await withConn((c) =>
      c.execute(`SELECT google_event_id FROM meetings WHERE id = :id`, { id: req.params.id }),
    );
    const gid = r.rows.length ? r.rows[0].GOOGLE_EVENT_ID : null;
    await withConn((c) => c.execute(`DELETE FROM meetings WHERE id = :id`, { id: req.params.id }, { autoCommit: true }));
    logger.info('meeting deleted', { id: Number(req.params.id), by: req.user.username });
    try { await google.deleteEvent(gid); } catch (e) { logger.error('google delete failed', { message: e.message }); }
    res.status(204).end();
  } catch (e) { next(e); }
});

module.exports = router;
