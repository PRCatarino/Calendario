import * as googleCal from '@/lib/server/google';
import { isResponse, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';

// any logged-in user connects THEIR own Google Calendar.
// token comes via ?t= (browser navigation); state carries the account id.
export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  if (!googleCal.isConfigured()) {
    return new Response('Google OAuth nao configurado', { status: 400 });
  }
  const state = googleCal.signState(user.id);
  return Response.redirect(googleCal.authUrl(state), 302);
}
