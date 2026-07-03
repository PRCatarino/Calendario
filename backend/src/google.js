const { google } = require('googleapis');
const { withConn, oracledb } = require('./db');

const SCOPES = ['https://www.googleapis.com/auth/calendar.events'];

function makeOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

function authUrl() {
  return makeOAuthClient().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });
}

async function saveTokens(tokens) {
  await withConn(async (conn) => {
    await conn.execute(
      `MERGE INTO google_tokens t USING (SELECT 1 id FROM dual) s ON (t.id = s.id)
       WHEN MATCHED THEN UPDATE SET access_token = :at, refresh_token = COALESCE(:rt, t.refresh_token), expiry = :exp
       WHEN NOT MATCHED THEN INSERT (id, access_token, refresh_token, expiry) VALUES (1, :at, :rt, :exp)`,
      { at: tokens.access_token || null, rt: tokens.refresh_token || null, exp: tokens.expiry_date || null },
      { autoCommit: true }
    );
  });
}

async function loadTokens() {
  return withConn(async (conn) => {
    const r = await conn.execute(`SELECT access_token, refresh_token, expiry FROM google_tokens WHERE id = 1`);
    if (!r.rows.length) return null;
    const row = r.rows[0];
    return {
      access_token: row.ACCESS_TOKEN,
      refresh_token: row.REFRESH_TOKEN,
      expiry_date: row.EXPIRY,
    };
  });
}

// returns an authed client or null if user never connected Google
async function authedClient() {
  const tokens = await loadTokens();
  if (!tokens || !tokens.refresh_token) return null;
  const client = makeOAuthClient();
  client.setCredentials(tokens);
  // persist refreshed tokens
  client.on('tokens', (t) => saveTokens({ ...tokens, ...t }).catch(() => {}));
  return client;
}

async function exchangeCode(code) {
  const client = makeOAuthClient();
  const { tokens } = await client.getToken(code);
  await saveTokens(tokens);
  return tokens;
}

function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// push a meeting to Google Calendar, returns event id or null
async function pushEvent(meeting) {
  const client = await authedClient();
  if (!client) return null;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  const body = {
    summary: meeting.title || `Reuniao - ${meeting.client_name}`,
    description: meeting.notes || `Cliente: ${meeting.client_name}`,
    start: { dateTime: new Date(meeting.starts_at).toISOString() },
    end: { dateTime: new Date(meeting.ends_at).toISOString() },
  };
  if (meeting.google_event_id) {
    const res = await calendar.events.update({ calendarId, eventId: meeting.google_event_id, requestBody: body });
    return res.data.id;
  }
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data.id;
}

async function deleteEvent(eventId) {
  if (!eventId) return;
  const client = await authedClient();
  if (!client) return;
  const calendar = google.calendar({ version: 'v3', auth: client });
  const calendarId = process.env.GOOGLE_CALENDAR_ID || 'primary';
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    if (e.code !== 404 && e.code !== 410) throw e;
  }
}

module.exports = { authUrl, exchangeCode, pushEvent, deleteEvent, isConfigured, authedClient };
