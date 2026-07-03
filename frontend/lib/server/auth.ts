import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { one, query } from './db';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';
const JWT_EXPIRES = '12h';

export interface AuthUser {
  id: number;
  role: 'ADMIN' | 'CLIENT';
  name: string;
  username: string;
}

interface AccountRow {
  id: number;
  username: string;
  password_hash: string;
  role: 'ADMIN' | 'CLIENT';
  name: string;
  active: boolean;
}

export function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}
export function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export function signToken(a: { id: number; role: string; name: string; username: string }) {
  return jwt.sign({ sub: a.id, role: a.role, name: a.name, username: a.username }, JWT_SECRET, {
    expiresIn: JWT_EXPIRES,
  });
}

export function verifyToken(token: string): AuthUser | null {
  try {
    const p = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    return { id: Number(p.sub), role: p.role, name: p.name, username: p.username };
  } catch {
    return null;
  }
}

/** token from Authorization header, or ?t= (for <img>/<video>/redirects) */
export function tokenFromRequest(req: Request): string | null {
  const header = req.headers.get('authorization') || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  const t = new URL(req.url).searchParams.get('t');
  return t || null;
}

export function getAuth(req: Request): AuthUser | null {
  const token = tokenFromRequest(req);
  return token ? verifyToken(token) : null;
}

export async function findByUsername(username: string) {
  return one<AccountRow>(
    `select id, username, password_hash, role, name, active from accounts where username = $1`,
    [username],
  );
}

// lazily ensure an ADMIN exists (serverless has no boot step)
let adminChecked = false;
export async function ensureAdmin() {
  if (adminChecked) return;
  const username = process.env.ADMIN_USER || 'admin';
  const existing = await findByUsername(username);
  if (!existing) {
    const hash = await hashPassword(process.env.ADMIN_PASSWORD || 'admin123');
    await query(
      `insert into accounts (username, password_hash, role, name) values ($1, $2, 'ADMIN', 'Administrador')`,
      [username, hash],
    );
  }
  adminChecked = true;
}
