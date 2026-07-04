import { query } from '@/lib/server/db';
import { err, isResponse, json, requireUser } from '@/lib/server/http';
import { uploadAvatar } from '@/lib/server/supabase';
import { UploadError, validateMedia } from '@/lib/server/upload';

export const runtime = 'nodejs';

// POST /api/profile/avatar — image only, validated by content
export async function POST(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  try {
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof Blob)) return err('arquivo obrigatorio', 400);

    const media = await validateMedia(file);
    if (media.mediaType !== 'image') return err('avatar precisa ser uma imagem', 400);

    const path = await uploadAvatar(user.id, media.bytes, media.ext, media.mime);
    await query(`update accounts set avatar_path = $1 where id = $2`, [path, user.id]);
    return json({ ok: true });
  } catch (e) {
    if (e instanceof UploadError) return err(e.message, 400);
    return err((e as Error).message, 500);
  }
}
