import * as googleCal from '@/lib/server/google';
import { isResponse, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';

// browser navigation → token via ?t= (handled by requireAdmin/getAuth)
export async function GET(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  if (!googleCal.isConfigured()) {
    return new Response('Google OAuth nao configurado — defina GOOGLE_CLIENT_ID/SECRET', { status: 400 });
  }
  return Response.redirect(googleCal.authUrl(), 302);
}
