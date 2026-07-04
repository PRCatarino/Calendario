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
export const ATTACHMENTS_BUCKET = 'attachments';

/** upload (or replace) a captured cover frame; returns the storage path */
export async function uploadCoverFrame(meetingId: string, bytes: Buffer, contentType = 'image/jpeg') {
  const path = `meetings/${meetingId}.jpg`;
  const { error } = await getSupabase()
    .storage.from(COVERS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/** short-lived signed URL to read a private object */
export async function signedUrl(bucket: string, path: string, expiresIn = 300) {
  const { data, error } = await getSupabase().storage.from(bucket).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

/** back-compat helper for cover frames */
export function signedCoverUrl(path: string, expiresIn = 300) {
  return signedUrl(COVERS_BUCKET, path, expiresIn);
}

/** upload (replace) an admin cover file for a meeting; returns the storage path */
export async function uploadMeetingCover(meetingId: number, ext: string, bytes: Buffer, contentType: string) {
  const path = `covers/${meetingId}.${ext}`;
  const { error } = await getSupabase()
    .storage.from(COVERS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}

/** upload a client meeting attachment; content-type is the server-detected mime */
export async function uploadAttachment(meetingId: number, filename: string, bytes: Buffer, contentType: string) {
  const path = `meetings/${meetingId}/${filename}`;
  const { error } = await getSupabase()
    .storage.from(ATTACHMENTS_BUCKET)
    .upload(path, bytes, { contentType, upsert: false });
  if (error) throw error;
  return path;
}

export async function removeObject(bucket: string, path: string) {
  await getSupabase().storage.from(bucket).remove([path]).catch(() => {});
}

/** upload (replace) an account avatar into the covers bucket under avatars/ */
export async function uploadAvatar(accountId: number, bytes: Buffer, ext: string, contentType: string) {
  const path = `avatars/${accountId}.${ext}`;
  const { error } = await getSupabase()
    .storage.from(COVERS_BUCKET)
    .upload(path, bytes, { contentType, upsert: true });
  if (error) throw error;
  return path;
}
