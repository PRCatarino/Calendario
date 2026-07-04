import { getAuth } from '@/lib/server/auth';
import { one, query } from '@/lib/server/db';
import { detectCoverType, driveDownloadUrl, driveId, driveThumbUrl } from '@/lib/server/drive';
import { err, isResponse, json, requireAdmin } from '@/lib/server/http';
import { COVERS_BUCKET, signedCoverUrl, signedUrl, uploadMeetingCover } from '@/lib/server/supabase';
import { UploadError, validateMedia } from '@/lib/server/upload';

export const runtime = 'nodejs';

// POST /api/meetings/:id/cover  (ADMIN) — set/replace cover by file (jpeg/mp4) OR Drive link
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const form = await req.formData();
    const file = form.get('cover');
    const cover_url = (form.get('cover_url') as string) || null;

    if (file instanceof Blob) {
      const media = await validateMedia(file);
      const path = await uploadMeetingCover(Number(params.id), media.ext, media.bytes, media.mime);
      // switching cover invalidates any previously captured frame
      await query(
        `update meetings set cover_storage_path = $1, cover_type = $2, cover_url = null, cover_frame_path = null where id = $3`,
        [path, media.mediaType, params.id],
      );
      return json({ ok: true, cover_type: media.mediaType });
    }

    if (cover_url) {
      const coverType = await detectCoverType(cover_url);
      await query(
        `update meetings set cover_url = $1, cover_type = $2, cover_storage_path = null, cover_frame_path = null where id = $3`,
        [cover_url, coverType, params.id],
      );
      return json({ ok: true, cover_type: coverType });
    }

    return err('envie um arquivo (cover) ou cover_url', 400);
  } catch (e) {
    if (e instanceof UploadError) return err(e.message, 400);
    return err((e as Error).message, 500);
  }
}

// GET /api/meetings/:id/cover[?thumb=1]  (token via ?t= since media tags can't send headers)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = getAuth(req);
  if (!user) return new Response('unauthorized', { status: 401 });

  const row = await one<{
    cover_url: string | null;
    cover_type: string | null;
    client_id: number | null;
    cover_frame_path: string | null;
    cover_storage_path: string | null;
  }>(`select cover_url, cover_type, client_id, cover_frame_path, cover_storage_path from meetings where id = $1`, [params.id]);

  if (!row) return new Response(null, { status: 404 });
  if (user.role === 'CLIENT' && row.client_id !== user.id) return new Response(null, { status: 403 });

  const url = new URL(req.url);
  const wantThumb = url.searchParams.get('thumb') === '1';

  // thumb: prefer stored captured frame (Supabase Storage) -> redirect to a signed URL
  if (wantThumb && row.cover_frame_path) {
    return Response.redirect(await signedCoverUrl(row.cover_frame_path), 302);
  }

  // admin-uploaded cover stored in Supabase (image or video) -> signed URL
  if (row.cover_storage_path) {
    // for a video thumb without a captured frame, there is no still yet
    if (wantThumb && row.cover_type === 'video') return new Response(null, { status: 404 });
    return Response.redirect(await signedUrl(COVERS_BUCKET, row.cover_storage_path), 302);
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
