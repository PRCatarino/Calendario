import { findByUsername, hashPassword } from '@/lib/server/auth';
import { query } from '@/lib/server/db';
import { err, isResponse, json, requireAdmin } from '@/lib/server/http';
import { appendCredential } from '@/lib/server/vault';

export const runtime = 'nodejs';

interface ClientRow {
  id: number;
  username: string;
  name: string;
  active: boolean;
}

export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  const rows = await query<ClientRow>(
    `select id, username, name, active from accounts where role = 'CLIENT' order by name`,
  );
  return json(rows);
}

export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const { name, username, password } = await req.json().catch(() => ({}));
    if (!name || !username || !password) return err('name, username, password obrigatorios', 400);

    const existing = await findByUsername(username);
    if (existing) return err('username ja existe', 409);

    const hash = await hashPassword(password);
    const rows = await query<{ id: number }>(
      `insert into accounts (username, password_hash, role, name)
       values ($1, $2, 'CLIENT', $3) returning id`,
      [username, hash, name],
    );
    const id = rows[0].id;
    await appendCredential({ name, username, password });
    return json({ id, name, username, role: 'CLIENT' }, 201);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
