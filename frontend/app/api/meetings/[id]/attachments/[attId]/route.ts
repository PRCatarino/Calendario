import { one, query } from '@/lib/server/db';
import { err, isResponse, requireUser } from '@/lib/server/http';
import { ATTACHMENTS_BUCKET, removeObject } from '@/lib/server/supabase';

export const runtime = 'nodejs';

// DELETE /api/meetings/:id/attachments/:attId  (owner client or admin)
export async function DELETE(req: Request, { params }: { params: { id: string; attId: string } }) {
  const user = requireUser(req);
  if (isResponse(user)) return user;

  const row = await one<{ path: string; client_id: number | null }>(
    `select a.path, m.client_id
     from meeting_attachments a join meetings m on m.id = a.meeting_id
     where a.id = $1 and a.meeting_id = $2`,
    [params.attId, params.id],
  );
  if (!row) return err('anexo nao encontrado', 404);

  const isAdmin = user.role === 'ADMIN';
  const isOwner = user.role === 'CLIENT' && row.client_id === user.id;
  if (!isAdmin && !isOwner) return err('sem permissao', 403);

  await query(`delete from meeting_attachments where id = $1`, [params.attId]);
  await removeObject(ATTACHMENTS_BUCKET, row.path);
  return new Response(null, { status: 204 });
}
