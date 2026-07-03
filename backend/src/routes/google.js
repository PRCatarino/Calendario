const express = require('express');
const google = require('../google');
const auth = require('../auth');
const logger = require('../logger');
const { withConn } = require('../db');

const router = express.Router();

function adminOnly(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
  next();
}

// POST /api/google/sync  (admin) -> push all meetings that aren't on Google yet
router.post('/sync', auth.requireAuth, adminOnly, async (req, res, next) => {
  try {
    const client = await google.authedClient();
    if (!client) return res.status(400).json({ error: 'Google nao conectado' });

    const rows = await withConn((c) =>
      c.execute(
        `SELECT id, client_name, title, notes, starts_at, ends_at
         FROM meetings WHERE google_event_id IS NULL ORDER BY starts_at`,
      ),
    );

    let synced = 0;
    const failed = [];
    for (const m of rows.rows) {
      try {
        const eventId = await google.pushEvent({
          client_name: m.CLIENT_NAME,
          title: m.TITLE,
          notes: m.NOTES,
          starts_at: m.STARTS_AT,
          ends_at: m.ENDS_AT,
        });
        if (eventId) {
          await withConn((c) =>
            c.execute(
              `UPDATE meetings SET google_event_id = :g WHERE id = :id`,
              { g: eventId, id: m.ID },
              { autoCommit: true },
            ),
          );
          synced++;
        }
      } catch (e) {
        failed.push(m.ID);
        logger.error('sync push failed', { id: m.ID, message: e.message });
      }
    }

    logger.info('google sync finished', { synced, failed: failed.length, total: rows.rows.length });
    res.json({ synced, failed: failed.length, total: rows.rows.length });
  } catch (e) { next(e); }
});

// GET /api/google/status  (admin, header token)
router.get('/status', auth.requireAuth, adminOnly, async (req, res, next) => {
  try {
    if (!google.isConfigured()) return res.json({ configured: false, connected: false });
    const client = await google.authedClient();
    res.json({ configured: true, connected: Boolean(client) });
  } catch (e) { next(e); }
});

// GET /api/google/connect -> redirect to Google consent
// browser navigation, so token comes via ?t= (requireAuthFlexible)
router.get('/connect', auth.requireAuthFlexible, adminOnly, (req, res) => {
  if (!google.isConfigured()) {
    return res.status(400).send('Google OAuth nao configurado — defina GOOGLE_CLIENT_ID/SECRET no .env do backend');
  }
  logger.info('google oauth: redirecting to consent', { by: req.user.username });
  res.redirect(google.authUrl());
});

// GET /api/google/callback?code=...  (Google redirects here — public)
router.get('/callback', async (req, res, next) => {
  try {
    const front = process.env.FRONTEND_ORIGIN || 'http://localhost:4173';
    if (req.query.error) {
      logger.warn('google oauth denied', { error: req.query.error });
      return res.redirect(`${front}?google=denied`);
    }
    if (!req.query.code) return res.redirect(`${front}?google=error`);
    await google.exchangeCode(req.query.code);
    logger.info('google oauth: tokens stored');
    res.redirect(`${front}?google=connected`);
  } catch (e) {
    logger.error('google oauth callback failed', { message: e.message });
    const front = process.env.FRONTEND_ORIGIN || 'http://localhost:4173';
    res.redirect(`${front}?google=error`);
  }
});

module.exports = router;
