import { NextResponse } from 'next/server';
import { getAuth, type AuthUser } from './auth';

export function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}
export function err(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** returns the user, or a Response to return early (401/403) */
export function requireUser(req: Request): AuthUser | Response {
  const user = getAuth(req);
  if (!user) return err('token ausente ou invalido', 401);
  return user;
}
export function requireAdmin(req: Request): AuthUser | Response {
  const user = requireUser(req);
  if (user instanceof Response) return user;
  if (user.role !== 'ADMIN') return err('admin only', 403);
  return user;
}
export function isResponse(x: unknown): x is Response {
  return x instanceof Response;
}
