import * as googleCal from '@/lib/server/google';

export const runtime = 'nodejs';

// Google redirects here (public). Front origin = same app.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const front = process.env.APP_ORIGIN || url.origin;
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');

  if (error) return Response.redirect(`${front}/?google=denied`, 302);
  if (!code) return Response.redirect(`${front}/?google=error`, 302);
  try {
    await googleCal.exchangeCode(code);
    return Response.redirect(`${front}/?google=connected`, 302);
  } catch (e) {
    console.error('google callback failed:', (e as Error).message);
    return Response.redirect(`${front}/?google=error`, 302);
  }
}
