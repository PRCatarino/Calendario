const express = require('express');
const auth = require('../auth');
const logger = require('../logger');

const router = express.Router();

// POST /api/auth/login { username, password }
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return res.status(400).json({ error: 'username e password obrigatorios' });

    const account = await auth.findByUsername(username);
    if (!account || !account.active) {
      logger.warn('login failed: unknown/inactive user', { username, ip: req.ip });
      return res.status(401).json({ error: 'credenciais invalidas' });
    }

    const ok = await auth.verifyPassword(password, account.passwordHash);
    if (!ok) {
      logger.warn('login failed: wrong password', { username, ip: req.ip });
      return res.status(401).json({ error: 'credenciais invalidas' });
    }

    logger.info('login success', { username, role: account.role });
    const token = auth.signToken(account);
    res.json({
      token,
      user: { id: account.id, role: account.role, name: account.name, username: account.username },
    });
  } catch (e) { next(e); }
});

// GET /api/auth/me  (current user from token)
router.get('/me', auth.requireAuth, (req, res) => {
  res.json({ user: req.user });
});

module.exports = router;
