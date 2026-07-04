import * as googleCal from '@/lib/server/google';

export const runtime = 'nodejs';

// Google redirects here (public). The account id is inside the signed `state`.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const front = process.env.APP_ORIGIN || url.origin;
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (error) return Response.redirect(`${front}/?google=denied`, 302);
  const accountId = state ? googleCal.verifyState(state) : null;
  if (!code || !accountId) return Response.redirect(`${front}/?google=error`, 302);
  try {
    await googleCal.exchangeCode(accountId, code);
    return Response.redirect(`${front}/?google=connected`, 302);
  } catch (e) {
    console.error('google callback failed:', (e as Error).message);
    return Response.redirect(`${front}/?google=error`, 302);
  }
}
