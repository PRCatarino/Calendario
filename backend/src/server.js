require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const auth = require('./auth');
const logger = require('./logger');

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: process.env.FRONTEND_ORIGIN || 'http://localhost:4173' }));
app.use(express.json({ limit: '1mb' }));
app.use(logger.requestLogger);

// throttle auth to slow brute-force (20 attempts / 15 min / IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  skipSuccessfulRequests: true, // only failed logins count toward the limit
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'muitas tentativas de login, tente novamente mais tarde' },
  handler: (req, res, next, options) => {
    logger.warn('rate limit hit on login', { ip: req.ip });
    res.status(options.statusCode).json(options.message);
  },
});

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', require('./routes/auth'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/google', require('./routes/google'));

// centralized error handler — logs full error, returns a safe message
app.use((err, req, res, next) => { // eslint-disable-line no-unused-vars
  logger.error(`unhandled error on ${req.method} ${req.originalUrl.split('?')[0]}`, {
    message: err.message,
    stack: err.stack,
  });
  res.status(err.status || 500).json({ error: 'erro interno do servidor' });
});

const PORT = process.env.PORT || 4000;

db.init()
  .then(() => {
    logger.info('database pool initialized');
    return auth.ensureAdmin();
  })
  .then(() => app.listen(PORT, () => logger.info(`backend listening on :${PORT}`)))
  .catch((e) => {
    logger.error('boot failed', { message: e.message, stack: e.stack });
    process.exit(1);
  });
