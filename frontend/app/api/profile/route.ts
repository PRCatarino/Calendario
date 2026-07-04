import { one, query } from '@/lib/server/db';
import { err, isResponse, json, requireUser } from '@/lib/server/http';
import { COVERS_BUCKET, signedUrl } from '@/lib/server/supabase';

export const runtime = 'nodejs';

interface AccountRow {
  id: number;
  name: string;
  username: string;
  role: string;
  email: string | null;
  phone: string | null;
  avatar_path: string | null;
}

export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  const row = await one<AccountRow>(
    `select id, name, username, role, email, phone, avatar_path from accounts where id = $1`,
    [user.id],
  );
  if (!row) return err('conta nao encontrada', 404);
  let avatarUrl: string | null = null;
  if (row.avatar_path) {
    try { avatarUrl = await signedUrl(COVERS_BUCKET, row.avatar_path, 3600); } catch { /* ignore */ }
  }
  return json({
    id: row.id,
    name: row.name,
    username: row.username,
    role: row.role,
    email: row.email,
    phone: row.phone,
    avatarUrl,
  });
}

export async function PATCH(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  try {
    const { name, email, phone } = await req.json().catch(() => ({}));
    if (name !== undefined && String(name).trim().length === 0) return err('nome nao pode ser vazio', 400);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email))) return err('email invalido', 400);

    await query(
      `update accounts set
         name = coalesce($1, name),
         email = $2,
         phone = $3
       where id = $4`,
      [name?.trim() ?? null, email ? String(email).trim() : null, phone ? String(phone).trim() : null, user.id],
    );
    return json({ ok: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
