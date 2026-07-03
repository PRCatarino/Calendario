import { isResponse, json, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  return json({ user });
}
