import { waitUntil } from '@vercel/functions';
import { query } from '@/lib/server/db';
import { detectCoverType } from '@/lib/server/drive';
import * as googleCal from '@/lib/server/google';
import { err, isResponse, json, requireAdmin, requireUser } from '@/lib/server/http';
import { MEETING_COLS, toJson, type MeetingRow } from '@/lib/server/meetingMap';
import { COVERS_BUCKET, signedUrl, uploadMeetingCover } from '@/lib/server/supabase';
import { UploadError, validateMedia } from '@/lib/server/upload';

export const runtime = 'nodejs';

// meetings.<cols> aliased for joins
const MEETING_COLS_M = MEETING_COLS.split(',').map((c) => `m.${c.trim()}`).join(', ');

// Drive cover-type detection + Google push run AFTER the response so the card
// appears instantly. The row is updated in the background.
async function processMeetingSideEffects(
  id: number,
  cover_url: string | null,
  meta: { client_id: number; client_name: string | null; title: string | null; notes: string | null; starts_at: string; ends_at: string },
) {
  try {
    if (cover_url) {
      const coverType = await detectCoverType(cover_url);
      await query(`update meetings set cover_type = $1 where id = $2`, [coverType, id]);
    }
    // push to every connected calendar: admins + this meeting's client
    await googleCal.syncMeetingEverywhere({ id, ...meta });
  } catch (e) {
    console.error('meeting side-effects failed:', id, (e as Error).message);
  }
}

// GET /api/meetings?from&to[&client_id]
export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const conds: string[] = [];
  const params: unknown[] = [];

  if (user.role === 'CLIENT') {
    params.push(user.id);
    conds.push(`client_id = $${params.length}`);
  } else {
    const cidRaw = url.searchParams.get('client_id');
    if (cidRaw) {
      const cid = Number(cidRaw);
      if (!Number.isInteger(cid)) return err('client_id invalido', 400);
      params.push(cid);
      conds.push(`client_id = $${params.length}`);
    }
  }
  if (from && to) {
    params.push(new Date(from), new Date(to));
    conds.push(`starts_at < $${params.length} and ends_at > $${params.length - 1}`);
  }

  const where = conds.length ? ` where ${conds.map((c) => c.replace(/\b(client_id|starts_at|ends_at)\b/g, 'm.$1')).join(' and ')}` : '';
  const rows = await query<MeetingRow & { avatar_path: string | null }>(
    `select ${MEETING_COLS_M}, acc.avatar_path
     from meetings m left join accounts acc on acc.id = m.client_id${where} order by m.starts_at`,
    params,
  );
  const out = await Promise.all(
    rows.map(async (r) => ({
      ...toJson(r),
      client_avatar_url: r.avatar_path ? await signedUrl(COVERS_BUCKET, r.avatar_path, 3600).catch(() => null) : null,
    })),
  );
  return json(out);
}

// POST /api/meetings (ADMIN) — multipart form
export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const form = await req.formData();
    const client_id = form.get('client_id');
    const starts_at = form.get('starts_at') as string;
    const ends_at = form.get('ends_at') as string;
    if (!client_id || !starts_at || !ends_at) return err('client_id, starts_at, ends_at required', 400);

    const cid = Number(client_id);
    if (!Number.isInteger(cid)) return err('client_id invalido', 400);

    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (startDate.getTime() < Date.now() - 60_000) return err('nao e possivel agendar no passado', 400);
    if (endDate <= startDate) return err('hora final deve ser depois da inicial', 400);

    const client_name = (form.get('client_name') as string) || null;
    const title = (form.get('title') as string) || null;
    const notes = (form.get('notes') as string) || null;
    const cover_url = (form.get('cover_url') as string) || null;
    const coverFile = form.get('cover');

    // insert immediately with a provisional cover_type; refined in the background
    const rows = await query<{ id: number }>(
      `insert into meetings (client_id, client_name, title, starts_at, ends_at, notes, cover_url, cover_type)
       values ($1,$2,$3,$4,$5,$6,$7,'image') returning id`,
      [cid, client_name, title, startDate, endDate, notes, cover_url],
    );
    const id = rows[0].id;

    // admin uploaded a cover file (jpeg/mp4) — validate + store now
    let coverType = 'image';
    if (coverFile instanceof Blob) {
      const media = await validateMedia(coverFile);
      const path = await uploadMeetingCover(id, media.ext, media.bytes, media.mime);
      coverType = media.mediaType;
      await query(`update meetings set cover_storage_path = $1, cover_type = $2 where id = $3`, [path, coverType, id]);
    }

    // respond now; detect cover type (Drive) + push to Google after the response
    waitUntil(processMeetingSideEffects(id, cover_url, { client_id: cid, client_name, title, notes, starts_at, ends_at }));

    return json({ id, cover_type: coverFile ? coverType : cover_url ? 'pending' : 'image' }, 201);
  } catch (e) {
    if (e instanceof UploadError) return err(e.message, 400);
    return err((e as Error).message, 500);
  }
}
