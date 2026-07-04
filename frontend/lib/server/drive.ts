// Server-side Drive helpers: extract file id + auto-detect image vs video.

export function driveId(coverUrl?: string | null): string | null {
  if (!coverUrl) return null;
  const m = coverUrl.match(/\/d\/([\w-]+)/) || coverUrl.match(/[?&]id=([\w-]+)/);
  return m ? m[1] : null;
}

export function driveDownloadUrl(id: string) {
  return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
}
export function driveThumbUrl(id: string, size = 1000) {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** classify media by magic bytes only — returns null for anything not a known image/video */
export function sniffMediaType(buf: Buffer): 'image' | 'video' | null {
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return 'video'; // mp4/mov
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'video'; // webm/mkv
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image'; // jpeg
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'image'; // png
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'GIF8') return 'image'; // gif
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'image'; // webp
  return null;
}

/** detect image vs video from Drive content-type + magic bytes (file must be public) */
export async function detectCoverType(coverUrl?: string | null): Promise<'image' | 'video'> {
  const id = driveId(coverUrl);
  if (!id) return 'image';
  try {
    const r = await fetch(driveDownloadUrl(id), { headers: { Range: 'bytes=0-63' } });
    const ct = r.headers.get('content-type') || '';
    if (ct.includes('text/html')) return 'image';
    if (ct.startsWith('video')) return 'video';
    if (ct.startsWith('image')) return 'image';
    const buf = Buffer.from(await r.arrayBuffer());
    return sniffMediaType(buf) ?? 'image';
  } catch {
    return 'image';
  }
}
