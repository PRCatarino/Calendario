import { query } from '@/lib/server/db';
import { detectCoverType } from '@/lib/server/drive';
import * as googleCal from '@/lib/server/google';
import { err, isResponse, json, requireAdmin, requireUser } from '@/lib/server/http';
import { MEETING_COLS, toJson, type MeetingRow } from '@/lib/server/meetingMap';

export const runtime = 'nodejs';

// GET /api/meetings?from&to[&client_id]
export async function GET(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');
  const conds: string[] = [];
  const params: unknown[] = [];

  if (user.role === 'CLIENT') {
    params.push(user.id);
    conds.push(`client_id = $${params.length}`);
  } else {
    const cidRaw = url.searchParams.get('client_id');
    if (cidRaw) {
      const cid = Number(cidRaw);
      if (!Number.isInteger(cid)) return err('client_id invalido', 400);
      params.push(cid);
      conds.push(`client_id = $${params.length}`);
    }
  }
  if (from && to) {
    params.push(new Date(from), new Date(to));
    conds.push(`starts_at < $${params.length} and ends_at > $${params.length - 1}`);
  }

  const where = conds.length ? ` where ${conds.join(' and ')}` : '';
  const rows = await query<MeetingRow>(`select ${MEETING_COLS} from meetings${where} order by starts_at`, params);
  return json(rows.map(toJson));
}

// POST /api/meetings (ADMIN) — multipart form
export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;
  try {
    const form = await req.formData();
    const client_id = form.get('client_id');
    const starts_at = form.get('starts_at') as string;
    const ends_at = form.get('ends_at') as string;
    if (!client_id || !starts_at || !ends_at) return err('client_id, starts_at, ends_at required', 400);

    const cid = Number(client_id);
    if (!Number.isInteger(cid)) return err('client_id invalido', 400);

    const startDate = new Date(starts_at);
    const endDate = new Date(ends_at);
    if (startDate.getTime() < Date.now() - 60_000) return err('nao e possivel agendar no passado', 400);
    if (endDate <= startDate) return err('hora final deve ser depois da inicial', 400);

    const client_name = (form.get('client_name') as string) || null;
    const title = (form.get('title') as string) || null;
    const notes = (form.get('notes') as string) || null;
    const cover_url = (form.get('cover_url') as string) || null;
    const cover_type = cover_url ? await detectCoverType(cover_url) : 'image';

    const rows = await query<{ id: number }>(
      `insert into meetings (client_id, client_name, title, starts_at, ends_at, notes, cover_url, cover_type)
       values ($1,$2,$3,$4,$5,$6,$7,$8) returning id`,
      [cid, client_name, title, startDate, endDate, notes, cover_url, cover_type],
    );
    const id = rows[0].id;

    let googleEventId: string | null = null;
    try {
      googleEventId = await googleCal.pushEvent({ client_name, title, notes, starts_at, ends_at });
      if (googleEventId) {
        await query(`update meetings set google_event_id = $1 where id = $2`, [googleEventId, id]);
      }
    } catch (e) {
      console.error('google push failed:', (e as Error).message);
    }

    return json({ id, cover_type, google_event_id: googleEventId }, 201);
  } catch (e) {
    return err((e as Error).message, 500);
  }
}
