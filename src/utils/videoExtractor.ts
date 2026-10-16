import { VideoFrameItem } from '../types';

/**
 * Seeks a video element to a specific timestamp and waits strictly for the 'seeked' event,
 * with guaranteed resolution even when the video is paused.
 */
export function seekVideo(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise((resolve) => {
    const rawDur = video.duration;
    const duration = Number.isFinite(rawDur) && rawDur > 0 ? rawDur : targetTime + 10;
    const clampedTime = Math.max(0, Math.min(targetTime, duration));

    // If video is already at the target time (within 0.015s threshold)
    if (Math.abs(video.currentTime - clampedTime) < 0.015) {
      // Yield to next frame to allow buffer to settle
      requestAnimationFrame(() => {
        setTimeout(resolve, 8);
      });
      return;
    }

    let isDone = false;
    let timer: number;

    const onFinish = () => {
      if (isDone) return;
      isDone = true;
      video.removeEventListener('seeked', onFinish);
      video.removeEventListener('error', onFinish);
      clearTimeout(timer);

      // Brief tick after seeked to ensure video frame is decoded onto canvas
      requestAnimationFrame(() => {
        setTimeout(resolve, 10);
      });
    };

    video.addEventListener('seeked', onFinish, { once: true });
    video.addEventListener('error', onFinish, { once: true });

    // Safety timeout in case seek hangs or seeked does not fire
    timer = window.setTimeout(onFinish, 600);

    video.currentTime = clampedTime;
  });
}

/**
 * Captures the current visible frame of the video element into a VideoFrameItem.
 */
export function captureFrameFromVideo(
  video: HTMLVideoElement,
  timestamp?: number
): VideoFrameItem {
  const videoWidth = video.videoWidth || 640;
  const videoHeight = video.videoHeight || 360;

  // Master canvas at native resolution
  const canvas = document.createElement('canvas');
  canvas.width = videoWidth;
  canvas.height = videoHeight;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    try {
      ctx.drawImage(video, 0, 0, videoWidth, videoHeight);
    } catch {
      // fallback
    }
  }

  // Thumbnail canvas for responsive UI list rendering
  const thumbMax = 180;
  const thumbScale = Math.min(thumbMax / videoWidth, thumbMax / videoHeight, 1);
  const thumbWidth = Math.max(1, Math.round(videoWidth * thumbScale));
  const thumbHeight = Math.max(1, Math.round(videoHeight * thumbScale));

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = thumbWidth;
  thumbCanvas.height = thumbHeight;
  const thumbCtx = thumbCanvas.getContext('2d');
  if (thumbCtx) {
    thumbCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);
  }

  const dataUrl = thumbCanvas.toDataURL('image/jpeg', 0.82);

  return {
    id: `frame_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: typeof timestamp === 'number' ? timestamp : video.currentTime,
    dataUrl,
    originalCanvas: canvas,
    width: videoWidth,
    height: videoHeight,
    selected: true,
  };
}

/**
 * Batch extracts frames across a specified time range and FPS.
 * Uses cooperative yielding so React UI progress bar updates smoothly on each frame.
 */
export async function batchExtractFrames(
  video: HTMLVideoElement,
  startTime: number,
  endTime: number,
  fps: number,
  onProgress: (current: number, total: number, percent: number) => void,
  shouldAbort: () => boolean
): Promise<VideoFrameItem[]> {
  const originalTime = video.currentTime;
  const originalPaused = video.paused;

  if (!video.paused) {
    video.pause();
  }

  // Ensure video metadata/data is ready
  if (video.readyState < 2) {
    await new Promise<void>((res) => {
      const onReady = () => {
        video.removeEventListener('canplay', onReady);
        video.removeEventListener('loadeddata', onReady);
        res();
      };
      video.addEventListener('canplay', onReady, { once: true });
      video.addEventListener('loadeddata', onReady, { once: true });
      setTimeout(res, 400);
    });
  }

  const step = 1 / Math.max(1, fps);
  const timestamps: number[] = [];

  for (let t = startTime; t <= endTime + 0.0001; t += step) {
    timestamps.push(Number(t.toFixed(4)));
  }

  if (timestamps.length === 0) {
    timestamps.push(startTime);
  }

  const total = timestamps.length;
  const frames: VideoFrameItem[] = [];

  try {
    for (let i = 0; i < total; i++) {
      if (shouldAbort()) {
        break;
      }

      const targetTime = timestamps[i];
      await seekVideo(video, targetTime);

      if (shouldAbort()) break;

      const frame = captureFrameFromVideo(video, targetTime);
      frames.push(frame);

      const percent = Math.round(((i + 1) / total) * 100);
      onProgress(i + 1, total, percent);

      // Cooperative yield to event loop so React renders progress bar
      await new Promise((resolve) => setTimeout(resolve, 12));
    }
  } finally {
    // Restore video position
    try {
      await seekVideo(video, originalTime);
      if (!originalPaused) {
        video.play().catch(() => {});
      }
    } catch {
      // ignore seek restoration errors
    }
  }

  return frames;
}
