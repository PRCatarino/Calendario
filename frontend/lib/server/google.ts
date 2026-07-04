import { google } from 'googleapis';
import jwt from 'jsonwebtoken';
import { one, query } from './db';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];
const STATE_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

function oauthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// signed OAuth "state" carrying which account is connecting (callback is public)
export function signState(accountId: number) {
  return jwt.sign({ sub: accountId, p: 'gcal' }, STATE_SECRET, { expiresIn: '10m' });
}
export function verifyState(token: string): number | null {
  try {
    const p = jwt.verify(token, STATE_SECRET) as jwt.JwtPayload;
    return p.p === 'gcal' ? Number(p.sub) : null;
  } catch {
    return null;
  }
}

export function authUrl(state: string) {
  return oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES, state });
}

interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expiry: string | null;
}

async function saveTokens(accountId: number, t: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) {
  await query(
    `insert into google_connections (account_id, access_token, refresh_token, expiry)
     values ($1,$2,$3,$4)
     on conflict (account_id) do update set
       access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, google_connections.refresh_token),
       expiry = excluded.expiry`,
    [accountId, t.access_token ?? null, t.refresh_token ?? null, t.expiry_date ?? null],
  );
}

async function loadTokens(accountId: number) {
  const row = await one<TokenRow>(`select access_token, refresh_token, expiry from google_connections where account_id = $1`, [accountId]);
  if (!row) return null;
  return { access_token: row.access_token, refresh_token: row.refresh_token, expiry_date: row.expiry ? Number(row.expiry) : null };
}

export async function exchangeCode(accountId: number, code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(accountId, tokens);
  return tokens;
}

export async function authedClient(accountId: number) {
  const tokens = await loadTokens(accountId);
  if (!tokens || !tokens.refresh_token) return null;
  const client = oauthClient();
  client.setCredentials(tokens);
  client.on('tokens', (t) => saveTokens(accountId, { ...tokens, ...t }).catch(() => {}));
  return client;
}

export async function isConnected(accountId: number) {
  return Boolean(await authedClient(accountId));
}

export interface MeetingLike {
  id: number;
  client_id?: number | null;
  client_name?: string | null;
  title?: string | null;
  notes?: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
}

async function pushEvent(accountId: number, m: MeetingLike, existingEventId?: string | null): Promise<string | null> {
  const client = await authedClient(accountId);
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const body = {
    summary: m.title || `Reuniao - ${m.client_name}`,
    description: m.notes || `Cliente: ${m.client_name}`,
    start: { dateTime: new Date(m.starts_at).toISOString() },
    end: { dateTime: new Date(m.ends_at).toISOString() },
  };
  if (existingEventId) {
    const res = await calendar.events.update({ calendarId, eventId: existingEventId, requestBody: body });
    return res.data.id ?? null;
  }
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data.id ?? null;
}

/** create/update the Google event for a meeting on one account's calendar (via mapping) */
export async function syncMeetingToAccount(accountId: number, m: MeetingLike) {
  const existing = await one<{ event_id: string }>(
    `select event_id from meeting_google_events where meeting_id = $1 and account_id = $2`,
    [m.id, accountId],
  );
  const eventId = await pushEvent(accountId, m, existing?.event_id);
  if (eventId) {
    await query(
      `insert into meeting_google_events (meeting_id, account_id, event_id) values ($1,$2,$3)
       on conflict (meeting_id, account_id) do update set event_id = excluded.event_id`,
      [m.id, accountId, eventId],
    );
  }
  return eventId;
}

/** account ids that should receive this meeting: every connected admin + the meeting's client */
export async function targetAccountIds(clientId: number | null | undefined): Promise<number[]> {
  const rows = await query<{ account_id: number }>(
    `select gc.account_id from google_connections gc
     join accounts a on a.id = gc.account_id
     where gc.refresh_token is not null and (a.role = 'ADMIN' or a.id = $1)`,
    [clientId ?? -1],
  );
  return rows.map((r) => r.account_id);
}

/** push a meeting to all connected target calendars (admins + its client) */
export async function syncMeetingEverywhere(m: MeetingLike) {
  const ids = await targetAccountIds(m.client_id);
  for (const accountId of ids) {
    try { await syncMeetingToAccount(accountId, m); } catch (e) { console.error('sync failed', accountId, (e as Error).message); }
  }
}

/** delete all Google events mapped to a meeting (across accounts) */
export async function deleteMeetingEvents(meetingId: number) {
  const maps = await query<{ account_id: number; event_id: string }>(
    `select account_id, event_id from meeting_google_events where meeting_id = $1`,
    [meetingId],
  );
  for (const mp of maps) {
    try {
      const client = await authedClient(mp.account_id);
      if (!client) continue;
      const calendar = google.calendar({ version: 'v3', auth: client });
      await calendar.events.delete({ calendarId: process.env.GOOGLE_CALENDAR_ID || 'primary', eventId: mp.event_id });
    } catch (e) {
      const code = (e as { code?: number }).code;
      if (code !== 404 && code !== 410) console.error('delete event failed', mp.account_id, (e as Error).message);
    }
  }
}
