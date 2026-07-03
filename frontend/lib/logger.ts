// Browser-side logger. Gated by NEXT_PUBLIC_LOG_LEVEL (default 'info' in dev, 'warn' in prod).
type Level = 'debug' | 'info' | 'warn' | 'error';

const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const configured = (process.env.NEXT_PUBLIC_LOG_LEVEL as Level | undefined)
  ?? (process.env.NODE_ENV === 'production' ? 'warn' : 'info');
const threshold = ORDER[configured] ?? ORDER.info;

function log(level: Level, msg: string, meta?: unknown) {
  if (ORDER[level] < threshold) return;
  const tag = `%c[cal:${level}]`;
  const color =
    level === 'error' ? 'color:#e11d48'
    : level === 'warn' ? 'color:#d97706'
    : level === 'info' ? 'color:#2563eb'
    : 'color:#64748b';
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  if (meta !== undefined) fn(tag, color, msg, meta);
  else fn(tag, color, msg);
}

export const logger = {
  debug: (msg: string, meta?: unknown) => log('debug', msg, meta),
  info: (msg: string, meta?: unknown) => log('info', msg, meta),
  warn: (msg: string, meta?: unknown) => log('warn', msg, meta),
  error: (msg: string, meta?: unknown) => log('error', msg, meta),
};
