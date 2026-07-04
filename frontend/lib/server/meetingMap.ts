export interface MeetingRow {
  id: number;
  client_id: number | null;
  client_name: string | null;
  title: string | null;
  starts_at: Date | string;
  ends_at: Date | string;
  notes: string | null;
  cover_url: string | null;
  cover_type: string | null;
  cover_frame_path: string | null;
  cover_storage_path: string | null;
  status: string;
  reject_reason: string | null;
  google_event_id: string | null;
}

/** shape a DB row into the JSON the frontend expects */
export function toJson(row: MeetingRow) {
  const hasFrame = Boolean(row.cover_frame_path);
  const hasCover = Boolean(row.cover_url || row.cover_storage_path);
  return {
    id: row.id,
    client_id: row.client_id,
    client_name: row.client_name,
    title: row.title,
    starts_at: row.starts_at,
    ends_at: row.ends_at,
    notes: row.notes,
    has_image: hasFrame,
    has_cover: hasCover,
    image_url: hasFrame ? `/api/meetings/${row.id}/cover?thumb=1` : null,
    cover_url: row.cover_url,
    cover_type: row.cover_type || 'image',
    status: row.status,
    reject_reason: row.reject_reason,
    google_event_id: row.google_event_id,
  };
}

export const MEETING_COLS = `id, client_id, client_name, title, starts_at, ends_at, notes,
  cover_url, cover_type, cover_frame_path, cover_storage_path, status, reject_reason, google_event_id`;
