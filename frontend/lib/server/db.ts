import { Pool } from 'pg';

// Postgres pool for Supabase. Use the Transaction pooler URL (port 6543) in DATABASE_URL
// so it plays well with serverless. Keep the pool small.
let pool: Pool | undefined;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL not set');
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    pool = new Pool({
      connectionString,
      max: 3,
      idleTimeoutMillis: 10_000,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function one<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
