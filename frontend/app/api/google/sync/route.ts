import { one, query } from '@/lib/server/db';
import * as googleCal from '@/lib/server/google';
import { err, isResponse, json, requireUser } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Row {
  id: number;
  client_id: number | null;
  client_name: string | null;
  title: string | null;
  notes: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
}

// POST /api/google/sync — push meetings to THIS account's calendar.
// admin: all meetings · client: their own meetings.
export async function POST(req: Request) {
  const user = requireUser(req);
  if (isResponse(user)) return user;

  const client = await googleCal.authedClient(user.id);
  if (!client) return err('Google nao conectado', 400);

  const rows = user.role === 'ADMIN'
    ? await query<Row>(`select id, client_id, client_name, title, notes, starts_at, ends_at from meetings order by starts_at`)
    : await query<Row>(`select id, client_id, client_name, title, notes, starts_at, ends_at from meetings where client_id = $1 order by starts_at`, [user.id]);

  let synced = 0;
  let failed = 0;
  for (const m of rows) {
    try {
      const existing = await one<{ event_id: string }>(
        `select event_id from meeting_google_events where meeting_id = $1 and account_id = $2`,
        [m.id, user.id],
      );
      if (existing) continue; // already on this calendar
      const eventId = await googleCal.syncMeetingToAccount(user.id, m);
      if (eventId) synced++;
    } catch (e) {
      failed++;
      console.error('sync push failed:', m.id, (e as Error).message);
    }
  }
  return json({ synced, failed, total: rows.length });
}
