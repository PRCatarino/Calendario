import { logger } from '@/lib/logger';
import type { Meeting, MeetingColor, MeetingStatus } from '@/types/meeting';

// '' = same-origin (Next API routes on Vercel). Default keeps pointing at the local
// Express/Oracle backend so nothing breaks locally until you flip the env.
const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
const TOKEN_KEY = 'cal.token';

export interface AuthUser {
  id: number;
  role: 'ADMIN' | 'CLIENT';
  name: string;
  username: string;
}

export interface ClientAccount {
  id: number;
  username: string;
  name: string;
  active: boolean;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(t: string) {
  localStorage.setItem(TOKEN_KEY, t);
}
export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const token = getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const started = performance.now();
  logger.debug(`→ ${method} ${path}`);
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, { ...init, headers });
  } catch (e) {
    logger.error(`✗ ${method} ${path} (network)`, e);
    throw new ApiError('Falha de conexão com o servidor', 0);
  }
  const ms = Math.round(performance.now() - started);

  if (res.status === 401) {
    clearToken();
    logger.warn(`✗ ${method} ${path} 401 (${ms}ms) — sessão expirada`);
    throw new ApiError('Sessão expirada', 401);
  }
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    logger.warn(`✗ ${method} ${path} ${res.status} (${ms}ms)`, data);
    throw new ApiError(data.error || `Erro ${res.status}`, res.status);
  }
  logger.debug(`← ${method} ${path} ${res.status} (${ms}ms)`);
  if (res.status === 204) return undefined as T;
  return res.json();
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---- auth ----
export async function login(username: string, password: string) {
  return req<{ token: string; user: AuthUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password }),
  });
}
export async function fetchMe() {
  return req<{ user: AuthUser }>('/api/auth/me');
}

// ---- clients (admin) ----
export async function listClients() {
  return req<ClientAccount[]>('/api/accounts/clients');
}
export async function createClient(body: { name: string; username: string; password: string }) {
  return req<ClientAccount>('/api/accounts/clients', { method: 'POST', body: JSON.stringify(body) });
}

// ---- meetings ----
interface ApiMeeting {
  id: number;
  client_id: number;
  client_name: string;
  title: string;
  starts_at: string;
  ends_at: string;
  notes: string | null;
  has_image: boolean;
  image_url: string | null;
  cover_url: string | null;
  cover_type: 'image' | 'video' | null;
  status: MeetingStatus;
  reject_reason: string | null;
}

const PALETTE: MeetingColor[] = ['blue', 'violet', 'emerald', 'amber', 'rose', 'cyan', 'indigo', 'teal'];
function colorFor(clientId: number): MeetingColor {
  return PALETTE[clientId % PALETTE.length];
}

function mapMeeting(m: ApiMeeting): Meeting {
  return {
    id: String(m.id),
    clientId: m.client_id,
    clientName: m.client_name,
    title: m.title,
    start: new Date(m.starts_at),
    end: new Date(m.ends_at),
    notes: m.notes ?? '',
    // cover frame (proxied thumbnail) for chips/cards — a video frame or the image;
    // avatar fallback when no cover
    imageUrl: m.cover_url
      ? coverProxyUrl(String(m.id), true)
      : `https://i.pravatar.cc/150?u=${encodeURIComponent(m.client_name)}-${m.client_id}`,
    coverUrl: m.cover_url ?? undefined,
    coverType: m.cover_type === 'video' ? 'video' : 'image',
    hasFrame: m.has_image,
    status: m.status,
    rejectReason: m.reject_reason ?? undefined,
    color: colorFor(m.client_id),
  };
}

export async function getMeetings(from: Date, to: Date, clientId?: number | null): Promise<Meeting[]> {
  const qs = new URLSearchParams({ from: from.toISOString(), to: to.toISOString() });
  if (clientId) qs.set('client_id', String(clientId));
  const rows = await req<ApiMeeting[]>(`/api/meetings?${qs}`);
  return rows.map(mapMeeting);
}

export async function createMeeting(form: FormData) {
  return req<{ id: number; cover_type: 'image' | 'video' }>('/api/meetings', { method: 'POST', body: form });
}

export async function uploadCoverFrame(id: string, frame: Blob) {
  const fd = new FormData();
  fd.set('frame', frame, 'frame.jpg');
  return req<void>(`/api/meetings/${id}/cover-frame`, { method: 'POST', body: fd });
}

/** same-origin proxy URL for a meeting's Drive cover (plays in <img>/<video>).
 *  thumb=true returns a still frame (video) / thumbnail (image) for use as the cover. */
export function coverProxyUrl(id: string, thumb = false): string {
  const token = getToken();
  const q = thumb ? '&thumb=1' : '';
  return `${API}/api/meetings/${id}/cover?t=${encodeURIComponent(token ?? '')}${q}`;
}

// ---- google sync (admin) ----
export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
}

export async function googleStatus() {
  return req<GoogleStatus>('/api/google/status');
}

/** browser-navigation URL to start OAuth (token via query since it's a redirect) */
export function googleConnectUrl(): string {
  const token = getToken();
  return `${API}/api/google/connect?t=${encodeURIComponent(token ?? '')}`;
}

/** push meetings not yet on Google Calendar */
export async function googleSync() {
  return req<{ synced: number; failed: number; total: number }>('/api/google/sync', { method: 'POST' });
}

export async function updateMeetingStatus(id: string, status: MeetingStatus, reason?: string) {
  const m = await req<ApiMeeting>(`/api/meetings/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, reason }),
  });
  return mapMeeting(m);
}
