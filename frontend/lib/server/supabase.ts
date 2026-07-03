import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Server-only Supabase client (service role) — used for Storage of cover frames.
let client: SupabaseClient | undefined;

export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set');
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

export const COVERS_BUCKET = 'covers';

/** upload (or replace) a captured cover frame; returns the storage path */
export async function uploadCoverFrame(meetingId: string, bytes: Buffer, contentType = 'image/jpeg') {
  const path = `meetings/${meetingId}.jpg`;
  const { error } = await getSupabase()
    .storage.from(COVERS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/** short-lived signed URL to read a private cover frame */
export async function signedCoverUrl(path: string, expiresIn = 300) {
  const { data, error } = await getSupabase().storage.from(COVERS_BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
