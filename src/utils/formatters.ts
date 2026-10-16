export function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00.00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const hundredths = Math.floor((seconds % 1) * 100);

  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  const ms = String(hundredths).padStart(2, '0');
  return `${mm}:${ss}.${ms}`;
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Estimates GIF file size in bytes based on frame count, resolution, and color count.
 * Typically GIF LZW compression on real frames achieves ~0.35-0.55 bytes/pixel.
 */
export function estimateGifSizeBytes(
  frameCount: number,
  width: number,
  height: number,
  maxColors: number = 256
): number {
  if (frameCount <= 0 || width <= 0 || height <= 0) return 0;
  const pixelCount = width * height;
  const colorFactor = maxColors <= 64 ? 0.32 : maxColors <= 128 ? 0.42 : 0.5;
  const estimatedPerFrame = pixelCount * colorFactor;
  return Math.round(frameCount * estimatedPerFrame);
}
