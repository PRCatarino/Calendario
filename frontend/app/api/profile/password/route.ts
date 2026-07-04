import { hashPassword, verifyPassword } from '@/lib/server/auth';
import { one, query } from '@/lib/server/db';
import { err, isResponse, json, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';

// POST /api/profile/password { currentPassword, newPassword }
export async function POST(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  try {
    const { currentPassword, newPassword } = await req.json().catch(() => ({}));
    if (!currentPassword || !newPassword) return err('senha atual e nova obrigatorias', 400);
    if (String(newPassword).length < 4) return err('nova senha muito curta (min 4)', 400);

    const row = await one<{ password_hash: string }>(`select password_hash from accounts where id = $1`, [user.id]);
    if (!row) return err('conta nao encontrada', 404);

    const ok = await verifyPassword(currentPassword, row.password_hash);
    if (!ok) return err('senha atual incorreta', 403);

    const hash = await hashPassword(newPassword);
    await query(`update accounts set password_hash = $1 where id = $2`, [hash, user.id]);
    return json({ ok: true });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
