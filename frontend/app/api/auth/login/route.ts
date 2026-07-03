import { ensureAdmin, findByUsername, signToken, verifyPassword } from '@/lib/server/auth';
import { err, json } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    await ensureAdmin();
    const { username, password } = await req.json().catch(() => ({}));
    if (!username || !password) return err('username e password obrigatorios', 400);

    const account = await findByUsername(username);
    if (!account || !account.active) return err('credenciais invalidas', 401);

    const ok = await verifyPassword(password, account.password_hash);
    if (!ok) return err('credenciais invalidas', 401);

    const token = signToken(account);
    return json({
      token,
      user: { id: account.id, role: account.role, name: account.name, username: account.username },
    });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
