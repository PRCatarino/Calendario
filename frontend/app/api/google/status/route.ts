import * as googleCal from '@/lib/server/google';
import { isResponse, json, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  if (!googleCal.isConfigured()) return json({ configured: false, connected: false });
  const client = await googleCal.authedClient();
  return json({ configured: true, connected: Boolean(client) });
}
