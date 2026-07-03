import { one, query } from '@/lib/server/db';
import { err, isResponse, json, requireUser } from '@/lib/server/http';
import { MEETING_COLS, toJson, type MeetingRow } from '@/lib/server/meetingMap';

export const runtime = 'nodejs';

const VALID = ['PENDING', 'APPROVED', 'REJECTED'];

// PATCH /api/meetings/:id/status { status, reason? }
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const user = requireUser(req);
  if (isResponse(user)) return user;
  try {
    const { status, reason } = await req.json().catch(() => ({}));
    if (!VALID.includes(status)) return err('status invalido', 400);

    const current = await one<{ client_id: number | null; status: string }>(
      `select client_id, status from meetings where id = $1`,
      [params.id],
    );
    if (!current) return err('reuniao nao encontrada', 404);

    const isAdmin = user.role === 'ADMIN';
    const isOwner = user.role === 'CLIENT' && current.client_id === user.id;
    if (!isAdmin && !isOwner) return err('sem permissao', 403);

    if (!isAdmin) {
      if (current.status !== 'PENDING') return err('status ja definido; somente o admin pode alterar', 403);
      if (status === 'PENDING') return err('cliente nao pode redefinir como pendente', 400);
    }
    if (status === 'REJECTED' && !reason) return err('motivo obrigatorio ao reprovar', 400);

    const finalReason = status === 'REJECTED' ? reason : null;
    await query(
      `update meetings set status = $1, reject_reason = $2, status_changed_by = $3, status_changed_at = now() where id = $4`,
      [status, finalReason, user.id, params.id],
    );

    const updated = await one<MeetingRow>(`select ${MEETING_COLS} from meetings where id = $1`, [params.id]);
    return json(toJson(updated!));
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
