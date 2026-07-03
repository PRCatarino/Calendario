import { getAuth } from '@/lib/server/auth';
import { one } from '@/lib/server/db';
import { driveDownloadUrl, driveId, driveThumbUrl } from '@/lib/server/drive';
import { signedCoverUrl } from '@/lib/server/supabase';

export const runtime = 'nodejs';

// GET /api/meetings/:id/cover[?thumb=1]  (token via ?t= since media tags can't send headers)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = getAuth(req);
  if (!user) return new Response('unauthorized', { status: 401 });

  const row = await one<{
    cover_url: string | null;
    cover_type: string | null;
    client_id: number | null;
    cover_frame_path: string | null;
  }>(`select cover_url, cover_type, client_id, cover_frame_path from meetings where id = $1`, [params.id]);

  if (!row) return new Response(null, { status: 404 });
  if (user.role === 'CLIENT' && row.client_id !== user.id) return new Response(null, { status: 403 });

  const url = new URL(req.url);
  const wantThumb = url.searchParams.get('thumb') === '1';

  // thumb: prefer stored captured frame (Supabase Storage) -> redirect to a signed URL
  if (wantThumb && row.cover_frame_path) {
    const signed = await signedCoverUrl(row.cover_frame_path);
    return Response.redirect(signed, 302);
  }

  const id = driveId(row.cover_url);
  if (!id) return new Response(null, { status: 404 });

  const upstreamUrl = wantThumb ? driveThumbUrl(id) : driveDownloadUrl(id);
  const range = req.headers.get('range');
  const upstream = await fetch(upstreamUrl, {
    headers: range && !wantThumb ? { Range: range } : {},
    redirect: 'follow',
  });

  const upstreamType = upstream.headers.get('content-type') || '';
  if (upstreamType.includes('text/html')) {
    return Response.json(
      { error: 'arquivo do Drive nao esta publico (compartilhe como "qualquer pessoa com o link")' },
      { status: 409 },
    );
  }

  const headers = new Headers();
  if (!wantThumb) {
    for (const h of ['content-length', 'accept-ranges', 'content-range']) {
      const v = upstream.headers.get(h);
      if (v) headers.set(h, v);
    }
  }
  headers.set(
    'content-type',
    wantThumb ? 'image/jpeg' : row.cover_type === 'video' ? 'video/mp4' : upstreamType || 'image/jpeg',
  );
  return new Response(upstream.body, { status: upstream.status, headers });
}
