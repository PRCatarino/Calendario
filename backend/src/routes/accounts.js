const express = require('express');
const { withConn, oracledb } = require('../db');
const auth = require('../auth');
const logger = require('../logger');
const vault = require('../credentialsVault');

const router = express.Router();

// all routes here are admin-only
router.use(auth.requireAuth, auth.requireAdmin);

// GET /api/accounts/clients  -> list CLIENT accounts (companies)
router.get('/clients', async (req, res, next) => {
  try {
    const r = await withConn((c) =>
      c.execute(
        `SELECT id, username, name, active FROM accounts WHERE role = 'CLIENT' ORDER BY name`,
      ),
    );
    res.json(
      r.rows.map((row) => ({
        id: row.ID,
        username: row.USERNAME,
        name: row.NAME,
        active: row.ACTIVE === 1,
      })),
    );
  } catch (e) { next(e); }
});

// POST /api/accounts/clients { name, username, password }  -> create a client company login
router.post('/clients', async (req, res, next) => {
  try {
    const { name, username, password } = req.body || {};
    if (!name || !username || !password) {
      return res.status(400).json({ error: 'name, username, password obrigatorios' });
    }
    const existing = await auth.findByUsername(username);
    if (existing) return res.status(409).json({ error: 'username ja existe' });

    const hash = await auth.hashPassword(password);
    const r = await withConn((c) =>
      c.execute(
        `INSERT INTO accounts (username, password_hash, role, name)
         VALUES (:u, :h, 'CLIENT', :n) RETURNING id INTO :id`,
        {
          u: username,
          h: hash,
          n: name,
          id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true },
      ),
    );
    const id = r.outBinds.id[0];
    // write-only record of the plaintext credentials (DB only keeps the bcrypt hash)
    vault.appendCredential({ name, username, password });
    logger.info('client account created', { id, username, by: req.user.username });
    res.status(201).json({ id, name, username, role: 'CLIENT' });
  } catch (e) { next(e); }
});

module.exports = router;
