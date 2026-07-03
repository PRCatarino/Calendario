import { query } from '@/lib/server/db';
import * as googleCal from '@/lib/server/google';
import { err, isResponse, json, requireAdmin } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 60;

interface Row {
  id: number;
  client_name: string | null;
  title: string | null;
  notes: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
}

// POST /api/google/sync — push meetings not yet on Google
export async function POST(req: Request) {
  const admin = requireAdmin(req);
  if (isResponse(admin)) return admin;

  const client = await googleCal.authedClient();
  if (!client) return err('Google nao conectado', 400);

  const rows = await query<Row>(
    `select id, client_name, title, notes, starts_at, ends_at
     from meetings where google_event_id is null order by starts_at`,
  );

  let synced = 0;
  let failed = 0;
  for (const m of rows) {
    try {
      const eventId = await googleCal.pushEvent({
        client_name: m.client_name,
        title: m.title,
        notes: m.notes,
        starts_at: m.starts_at,
        ends_at: m.ends_at,
      });
      if (eventId) {
        await query(`update meetings set google_event_id = $1 where id = $2`, [eventId, m.id]);
        synced++;
      }
    } catch (e) {
      failed++;
      console.error('sync push failed:', m.id, (e as Error).message);
    }
  }
  return json({ synced, failed, total: rows.length });
}
