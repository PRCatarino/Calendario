// Capture a frame from the MIDDLE of a video (same-origin URL) via <video> + <canvas>.
// The video is served through our proxy (CORS enabled) so the canvas is not tainted.

export function captureMidFrame(videoUrl: string, timeoutMs = 60000): Promise<Blob | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);

    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.src = videoUrl;

    let done = false;
    const finish = (blob: Blob | null) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      video.removeAttribute('src');
      video.load();
      resolve(blob);
    };

    const timer = setTimeout(() => finish(null), timeoutMs);

    video.onloadedmetadata = () => {
      const d = video.duration;
      // seek to the middle (fallback to 1s if duration unknown)
      video.currentTime = Number.isFinite(d) && d > 0 ? d / 2 : 1;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth || 1280;
        canvas.height = video.videoHeight || 720;
        const ctx = canvas.getContext('2d');
        if (!ctx) return finish(null);
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => finish(blob), 'image/jpeg', 0.85);
      } catch {
        finish(null);
      }
    };

    video.onerror = () => finish(null);
  });
}
