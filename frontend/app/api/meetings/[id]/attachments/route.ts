import { randomUUID } from 'crypto';
import { one, query } from '@/lib/server/db';
import { err, isResponse, json, requireUser } from '@/lib/server/http';
import { ATTACHMENTS_BUCKET, signedUrl, uploadAttachment } from '@/lib/server/supabase';
import { UploadError, validateMedia } from '@/lib/server/upload';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface AttRow {
  id: number;
  path: string;
  media_type: 'image' | 'video';
  mime: string | null;
  size_bytes: number | null;
  uploaded_by: number | null;
  created_at: Date | string;
}

// verify the caller may access this meeting's attachments; returns meeting or a Response
async function authorize(req: Request, meetingId: string) {
  const user = requireUser(req);
  if (isResponse(user)) return { error: user as Response };
  const m = await one<{ client_id: number | null }>(`select client_id from meetings where id = $1`, [meetingId]);
  if (!m) return { error: err('reuniao nao encontrada', 404) };
  const isAdmin = user.role === 'ADMIN';
  const isOwner = user.role === 'CLIENT' && m.client_id === user.id;
  if (!isAdmin && !isOwner) return { error: err('sem permissao', 403) };
  return { user, isAdmin, isOwner };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const a = await authorize(req, params.id);
  if (a.error) return a.error;

  const t0 = Date.now();
  const rows = await query<AttRow>(
    `select id, path, media_type, mime, size_bytes, uploaded_by, created_at
     from meeting_attachments where meeting_id = $1 order by created_at`,
    [params.id],
  );
  const t1 = Date.now();

  const out = await Promise.all(
    rows.map(async (r) => ({
      id: r.id,
      media_type: r.media_type,
      mime: r.mime,
      size_bytes: r.size_bytes,
      uploaded_by: r.uploaded_by,
      created_at: r.created_at,
      url: await signedUrl(ATTACHMENTS_BUCKET, r.path, 3600).catch((e) => {
        console.error(`[attachments] signedUrl failed for path=${r.path}`, e?.message ?? e);
        return null;
      }),
    })),
  );
  const t2 = Date.now();
  if (rows.length > 0) {
    console.log(`[attachments] GET meeting=${params.id}: db=${t1 - t0}ms signedUrls=${t2 - t1}ms total=${t2 - t0}ms (${rows.length} items)`);
  }
  return json(out);
}

// POST — owner client (or admin) uploads a photo/video. Strict content validation.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const a = await authorize(req, params.id);
  if (a.error) return a.error;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return err('arquivo obrigatorio', 400);

    const media = await validateMedia(file);
    const filename = `${randomUUID()}.${media.ext}`;
    const path = await uploadAttachment(Number(params.id), filename, media.bytes, media.mime);

    const rows = await query<{ id: number }>(
      `insert into meeting_attachments (meeting_id, path, media_type, mime, size_bytes, uploaded_by)
       values ($1,$2,$3,$4,$5,$6) returning id`,
      [params.id, path, media.mediaType, media.mime, media.bytes.length, a.user!.id],
    );
    return json({ id: rows[0].id, media_type: media.mediaType }, 201);
  } catch (e) {
    if (e instanceof UploadError) return err(e.message, 400);
    return err((e as Error).message, 500);
  }
}
