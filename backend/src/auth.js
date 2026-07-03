const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { withConn } = require('./db');
const logger = require('./logger');

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES = '12h';

function hashPassword(plain) {
  return bcrypt.hash(plain, 10);
}

function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

function signToken(account) {
  return jwt.sign(
    { sub: account.id, role: account.role, name: account.name, username: account.username },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES },
  );
}

// find an active account by username
async function findByUsername(username) {
  return withConn(async (conn) => {
    const r = await conn.execute(
      `SELECT id, username, password_hash, role, name, active FROM accounts WHERE username = :u`,
      { u: username },
    );
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return {
      id: row.ID,
      username: row.USERNAME,
      passwordHash: row.PASSWORD_HASH,
      role: row.ROLE,
      name: row.NAME,
      active: row.ACTIVE === 1,
    };
  });
}

// express middleware: require a valid Bearer token, attach req.user
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') return res.status(403).json({ error: 'admin only' });
  next();
}

// like requireAuth but also accepts the token via ?t= query param.
// needed for <img>/<video> tags which can't send an Authorization header.
function requireAuthFlexible(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.t;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = { id: payload.sub, role: payload.role, name: payload.name, username: payload.username };
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

// ensure an ADMIN account exists on boot (env-driven), create if missing
async function ensureAdmin() {
  const username = process.env.ADMIN_USER || 'admin';
  const password = process.env.ADMIN_PASSWORD || 'admin123';
  const existing = await findByUsername(username);
  if (existing) return;
  const hash = await hashPassword(password);
  await withConn((conn) =>
    conn.execute(
      `INSERT INTO accounts (username, password_hash, role, name) VALUES (:u, :h, 'ADMIN', :n)`,
      { u: username, h: hash, n: 'Administrador' },
      { autoCommit: true },
    ),
  );
  logger.info('seeded admin account', { username });
}

module.exports = {
  hashPassword,
  verifyPassword,
  signToken,
  findByUsername,
  requireAuth,
  requireAuthFlexible,
  requireAdmin,
  ensureAdmin,
};
