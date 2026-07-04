import { sniffMediaType } from './drive';

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

// canonical content-type + extension per accepted magic-byte family.
// We NEVER trust the client's mime/filename — everything is derived from bytes.
const MIME_BY_SNIFF: Record<string, { ext: string; mime: string }> = {
  jpg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' },
  gif: { ext: 'gif', mime: 'image/gif' },
  webp: { ext: 'webp', mime: 'image/webp' },
  mp4: { ext: 'mp4', mime: 'video/mp4' },
  webm: { ext: 'webm', mime: 'video/webm' },
};

export interface ValidatedMedia {
  mediaType: 'image' | 'video';
  mime: string;
  ext: string;
  bytes: Buffer;
}

/** precise magic-byte family (for extension/mime), stricter than sniffMediaType */
function detailedSniff(buf: Buffer): keyof typeof MIME_BY_SNIFF | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.length >= 4 && buf.toString('ascii', 0, 4) === 'GIF8') return 'gif';
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buf.length >= 4 && buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return 'webm';
  // mp4/mov: ...ftyp<brand>; accept as mp4 container
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') return 'mp4';
  return null;
}

export class UploadError extends Error {}

/** validate an uploaded Blob strictly by content. Throws UploadError on rejection. */
export async function validateMedia(file: Blob): Promise<ValidatedMedia> {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError('arquivo maior que 100MB');
  }
  const bytes = Buffer.from(await file.arrayBuffer());
  if (bytes.length === 0) throw new UploadError('arquivo vazio');
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError('arquivo maior que 100MB');

  const family = detailedSniff(bytes);
  const mediaType = sniffMediaType(bytes); // null unless a known image/video
  if (!family || !mediaType) {
    throw new UploadError('tipo de arquivo nao permitido (apenas fotos e videos)');
  }
  const { ext, mime } = MIME_BY_SNIFF[family];
  return { mediaType, mime, ext, bytes };
}
