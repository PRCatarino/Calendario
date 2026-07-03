import { query } from '@/lib/server/db';
import { err, isResponse, requireAdmin } from '@/lib/server/http';
import { uploadCoverFrame } from '@/lib/server/supabase';

export const runtime = 'nodejs';

// POST /api/meetings/:id/cover-frame  (ADMIN) multipart 'frame' -> store captured frame in Storage
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const form = await req.formData();
    const file = form.get('frame');
    if (!(file instanceof Blob)) return err('frame obrigatorio', 400);

    const bytes = Buffer.from(await file.arrayBuffer());
    const path = await uploadCoverFrame(params.id, bytes, file.type || 'image/jpeg');
    await query(`update meetings set cover_frame_path = $1 where id = $2`, [path, params.id]);

    return new Response(null, { status: 204 });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
