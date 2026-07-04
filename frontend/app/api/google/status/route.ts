import * as googleCal from '@/lib/server/google';
import { isResponse, json, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';

// per-user: is THIS account connected to Google?
export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  if (!googleCal.isConfigured()) return json({ configured: false, connected: false });
  return json({ configured: true, connected: await googleCal.isConnected(user.id) });
}
