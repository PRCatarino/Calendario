import { google } from 'googleapis';
import { one, query } from './db';

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

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

export function authUrl() {
  return oauthClient().generateAuthUrl({ access_type: 'offline', prompt: 'consent', scope: SCOPES });
}

interface TokenRow {
  access_token: string | null;
  refresh_token: string | null;
  expiry: string | null;
}

async function saveTokens(t: { access_token?: string | null; refresh_token?: string | null; expiry_date?: number | null }) {
  await query(
    `insert into google_tokens (id, access_token, refresh_token, expiry)
     values (1, $1, $2, $3)
     on conflict (id) do update set
       access_token = excluded.access_token,
       refresh_token = coalesce(excluded.refresh_token, google_tokens.refresh_token),
       expiry = excluded.expiry`,
    [t.access_token ?? null, t.refresh_token ?? null, t.expiry_date ?? null],
  );
}

async function loadTokens() {
  const row = await one<TokenRow>(`select access_token, refresh_token, expiry from google_tokens where id = 1`);
  if (!row) return null;
  return {
    access_token: row.access_token,
    refresh_token: row.refresh_token,
    expiry_date: row.expiry ? Number(row.expiry) : null,
  };
}

export async function exchangeCode(code: string) {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
  return tokens;
}

export async function authedClient() {
  const tokens = await loadTokens();
  if (!tokens || !tokens.refresh_token) return null;
  const client = oauthClient();
  client.setCredentials(tokens);
  client.on('tokens', (t) => saveTokens({ ...tokens, ...t }).catch(() => {}));
  return client;
}

interface MeetingLike {
  client_name?: string | null;
  title?: string | null;
  notes?: string | null;
  starts_at: string | Date;
  ends_at: string | Date;
  google_event_id?: string | null;
}

export async function pushEvent(m: MeetingLike): Promise<string | null> {
  const client = await authedClient();
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const body = {
    summary: m.title || `Reuniao - ${m.client_name}`,
    description: m.notes || `Cliente: ${m.client_name}`,
    start: { dateTime: new Date(m.starts_at).toISOString() },
    end: { dateTime: new Date(m.ends_at).toISOString() },
  };
  if (m.google_event_id) {
    const res = await calendar.events.update({ calendarId, eventId: m.google_event_id, requestBody: body });
    return res.data.id ?? null;
  }
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data.id ?? null;
}

export async function deleteEvent(eventId: string | null) {
  if (!eventId) return;
  const client = await authedClient();
  if (!client) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (code !== 404 && code !== 410) throw e;
  }
}
