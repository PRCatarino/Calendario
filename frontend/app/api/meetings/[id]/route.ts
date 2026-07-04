import { one, query } from '@/lib/server/db';
import * as googleCal from '@/lib/server/google';
import { err, isResponse, json, requireAdmin } from '@/lib/server/http';
import { COVERS_BUCKET, getSupabase } from '@/lib/server/supabase';

export const runtime = 'nodejs';

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const row = await one<{ cover_frame_path: string | null }>(
      `select cover_frame_path from meetings where id = $1`,
      [params.id],
    );
    // delete Google events across all connected calendars BEFORE the row (cascade) goes away
    try { await googleCal.deleteMeetingEvents(Number(params.id)); } catch (e) { console.error('google delete failed:', (e as Error).message); }

    await query(`delete from meetings where id = $1`, [params.id]);
    if (row?.cover_frame_path) {
      await getSupabase().storage.from(COVERS_BUCKET).remove([row.cover_frame_path]).catch(() => {});
    }
    return new Response(null, { status: 204 });
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
