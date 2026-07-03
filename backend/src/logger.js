// Lightweight structured logger. Levels: debug < info < warn < error.
// Set LOG_LEVEL in .env (default 'info'). Each line: ISO time [LEVEL] message {meta}

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const threshold = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] ?? LEVELS.info;

function write(level, message, meta) {
  if (LEVELS[level] < threshold) return;
  const line = `${new Date().toISOString()} [${level.toUpperCase()}] ${message}`;
  const sink = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta && Object.keys(meta).length) sink(line, JSON.stringify(meta));
  else sink(line);
}

const logger = {
  debug: (msg, meta) => write('debug', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  error: (msg, meta) => write('error', msg, meta),
};

// Express middleware: logs each request with method, path, status, duration, user.
logger.requestLogger = (req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    const meta = {
      status: res.statusCode,
      ms,
      ip: req.ip,
      user: req.user ? `${req.user.username}(${req.user.role})` : 'anon',
    };
    const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
    write(level, `${req.method} ${req.originalUrl.split('?')[0]}`, meta);
  });
  next();
};

module.exports = logger;
