// Turn a Google Drive share link into a directly-embeddable image URL.
// File must be shared as "anyone with the link".

/** extract the Drive file id from common link shapes */
export function extractDriveId(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim();

  // raw id pasted (25-50 url-safe chars, no slashes)
  if (/^[\w-]{20,}$/.test(trimmed)) return trimmed;

  const patterns = [
    /\/file\/d\/([\w-]+)/, // .../file/d/ID/view
    /[?&]id=([\w-]+)/, // ...open?id=ID  |  uc?id=ID
    /\/d\/([\w-]+)/, // .../d/ID
  ];
  for (const re of patterns) {
    const m = trimmed.match(re);
    if (m) return m[1];
  }
  return null;
}

/** build a display URL for a Drive image id (thumbnail endpoint is the most reliable) */
export function driveImageUrl(id: string, size = 1000): string {
  return `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`;
}

/** build an embeddable player URL for a Drive video id */
export function driveVideoUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/preview`;
}

/** convenience: link -> display URL (or null if not a recognizable Drive link) */
export function driveLinkToImage(link: string, size = 1000): string | null {
  const id = extractDriveId(link);
  return id ? driveImageUrl(id, size) : null;
}

/** link -> display/embed URL for the chosen media type */
export function driveLinkToMedia(link: string, type: 'image' | 'video'): string | null {
  const id = extractDriveId(link);
  if (!id) return null;
  return type === 'video' ? driveVideoUrl(id) : driveImageUrl(id);
}
