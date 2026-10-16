import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { VideoFrameItem, Mp4Config, ExportResult } from '../types';

export interface Mp4GenerationProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

/**
 * Checks whether WebCodecs VideoEncoder and H.264 (AVC) encoding are supported in the current environment.
 */
export async function checkWebCodecsSupport(): Promise<{
  supported: boolean;
  codec: string;
  reason?: string;
}> {
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
    return {
      supported: false,
      codec: '',
      reason: '此瀏覽器不支援 WebCodecs API (VideoEncoder)',
    };
  }

  const candidateCodecs = [
    'avc1.42001f', // Baseline profile level 3.1 (best compatibility)
    'avc1.4d002a', // Main profile level 4.2
    'avc1.640028', // High profile level 4.0
    'avc1.42e01f', // Constrained Baseline
  ];

  for (const c of candidateCodecs) {
    try {
      const support = await (window as any).VideoEncoder.isConfigSupported({
        codec: c,
        width: 480,
        height: 360,
        bitrate: 2_500_000,
        framerate: 30,
      });
      if (support && support.supported) {
        return { supported: true, codec: c };
      }
    } catch {
      // try next codec
    }
  }

  return {
    supported: false,
    codec: '',
    reason: '瀏覽器有 WebCodecs 但未支援 H.264 (AVC) 硬體/軟體編碼',
  };
}

/**
 * Encodes frames to MP4 using WebCodecs VideoEncoder and mp4-muxer.
 * Guarantees even width and height, and respects each frame's delayMs.
 */
export function generateMp4Video(
  frames: VideoFrameItem[],
  config: Mp4Config,
  onProgress: (progress: Mp4GenerationProgress) => void
): { promise: Promise<ExportResult>; abort: () => void } {
  let isAborted = false;
  let activeEncoder: any = null;

  const promise = new Promise<ExportResult>(async (resolve, reject) => {
    try {
      if (frames.length === 0) {
        throw new Error('沒有可輸出的影格');
      }

      // Check support first
      const check = await checkWebCodecsSupport();
      if (!check.supported) {
        // Fallback to WebM using MediaRecorder Canvas stream
        const fallbackRes = await generateWebmFallback(frames, config, onProgress, () => isAborted);
        resolve({
          ...fallbackRes,
          fallbackNotice: `目前環境未支援 WebCodecs H.264 編碼 (${check.reason})，已自動切換為 WebM 格式輸出。`,
        });
        return;
      }

      const selectedCodec = check.codec;
      const firstFrame = frames[0];

      // Calculate even dimensions (H.264 requires width & height divisible by 2)
      let targetWidth = Math.max(64, Math.round(config.width));
      if (targetWidth % 2 !== 0) targetWidth -= 1;

      const aspect = (firstFrame.height || 360) / (firstFrame.width || 640);
      let targetHeight = Math.max(64, Math.round(targetWidth * aspect));
      if (targetHeight % 2 !== 0) targetHeight -= 1;

      const fps = Math.max(1, Math.min(60, Math.round(config.fps || 30)));
      const frameDurationMicros = Math.round(1_000_000 / fps);
      const bitrate = Math.round((config.bitrateMbps || 2.5) * 1_000_000);

      onProgress({
        percent: 2,
        currentFrame: 0,
        totalFrames: frames.length,
        message: '初始化 MP4 封裝器與 H.264 編碼器...',
      });

      const target = new ArrayBufferTarget();
      const muxer = new Muxer({
        target,
        video: {
          codec: 'avc',
          width: targetWidth,
          height: targetHeight,
          frameRate: fps,
        },
        fastStart: 'in-memory',
        firstTimestampBehavior: 'strict',
      });

      let encodeError: Error | null = null;
      const encoder = new (window as any).VideoEncoder({
        output: (chunk: any, meta: any) => {
          muxer.addVideoChunk(chunk, meta);
        },
        error: (e: any) => {
          encodeError = e instanceof Error ? e : new Error(String(e));
        },
      });
      activeEncoder = encoder;

      await encoder.configure({
        codec: selectedCodec,
        width: targetWidth,
        height: targetHeight,
        bitrate,
        framerate: fps,
      });

      // Prepare drawing canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('無法建立 Canvas 繪圖上下文');

      // Calculate total video ticks across all frames based on per-frame delayMs
      const frameTicks: number[] = [];
      let totalVideoTicks = 0;
      let totalDurationMs = 0;

      for (let i = 0; i < frames.length; i++) {
        const delay = Math.max(16, frames[i].delayMs || 100);
        totalDurationMs += delay;
        const ticks = Math.max(1, Math.round((delay / 1000) * fps));
        frameTicks.push(ticks);
        totalVideoTicks += ticks;
      }

      let currentTick = 0;
      let currentTimestampMicros = 0;

      for (let i = 0; i < frames.length; i++) {
        if (isAborted) {
          throw new Error('已取消 MP4 輸出');
        }

        const frameItem = frames[i];
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Draw frame onto resized even canvas
        if (frameItem.originalCanvas) {
          ctx.drawImage(frameItem.originalCanvas, 0, 0, targetWidth, targetHeight);
        } else {
          const img = new Image();
          await new Promise<void>((imgResolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              imgResolve();
            };
            img.src = frameItem.dataUrl;
          });
        }

        const ticks = frameTicks[i];

        // Feed ticks for the exact duration of this frame
        for (let t = 0; t < ticks; t++) {
          if (isAborted) throw new Error('已取消 MP4 輸出');
          if (encodeError) throw encodeError;

          // Backpressure handling to avoid unbounded memory accumulation
          if (encoder.encodeQueueSize > 8) {
            await new Promise((r) => setTimeout(r, 6));
          }

          const isKeyFrame = currentTick === 0 || currentTick % (fps * 2) === 0;

          const videoFrame = new (window as any).VideoFrame(canvas, {
            timestamp: currentTimestampMicros,
            duration: frameDurationMicros,
          });

          encoder.encode(videoFrame, { keyFrame: isKeyFrame });
          videoFrame.close();

          currentTimestampMicros += frameDurationMicros;
          currentTick++;
        }

        const pct = Math.min(94, Math.round((currentTick / totalVideoTicks) * 94));
        onProgress({
          percent: pct,
          currentFrame: i + 1,
          totalFrames: frames.length,
          message: `編碼影格 (${i + 1}/${frames.length}) · 累計 ${(totalDurationMs / 1000).toFixed(1)}s`,
        });

        // Cooperative tick for UI
        await new Promise((r) => setTimeout(r, 4));
      }

      onProgress({
        percent: 96,
        currentFrame: frames.length,
        totalFrames: frames.length,
        message: '完成編碼，正在封裝 MP4 檔案 (Muxing)...',
      });

      await encoder.flush();
      encoder.close();
      activeEncoder = null;

      muxer.finalize();

      const blob = new Blob([target.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      onProgress({
        percent: 100,
        currentFrame: frames.length,
        totalFrames: frames.length,
        message: 'MP4 封裝完成！',
      });

      resolve({
        blob,
        url,
        sizeBytes: blob.size,
        width: targetWidth,
        height: targetHeight,
        frameCount: frames.length,
        durationSec: totalDurationMs / 1000,
        format: 'mp4',
      });
    } catch (err) {
      if (activeEncoder) {
        try {
          activeEncoder.close();
        } catch {}
      }
      reject(err);
    }
  });

  return {
    promise,
    abort: () => {
      isAborted = true;
      if (activeEncoder) {
        try {
          activeEncoder.close();
        } catch {}
      }
    },
  };
}

/**
 * Fallback recorder that exports WebM using Canvas and MediaRecorder when WebCodecs is unavailable.
 */
async function generateWebmFallback(
  frames: VideoFrameItem[],
  config: Mp4Config,
  onProgress: (progress: Mp4GenerationProgress) => void,
  isAborted: () => boolean
): Promise<ExportResult> {
  const firstFrame = frames[0];
  let targetWidth = Math.max(64, Math.round(config.width));
  if (targetWidth % 2 !== 0) targetWidth -= 1;
  const aspect = (firstFrame.height || 360) / (firstFrame.width || 640);
  let targetHeight = Math.max(64, Math.round(targetWidth * aspect));
  if (targetHeight % 2 !== 0) targetHeight -= 1;

  const fps = Math.max(1, Math.min(60, config.fps || 30));
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d')!;

  const stream = canvas.captureStream(fps);
  const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
    ? 'video/webm;codecs=vp9'
    : 'video/webm';

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: Math.round((config.bitrateMbps || 2.5) * 1_000_000),
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  const recordingPromise = new Promise<Blob>((resolve, reject) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType }));
    recorder.onerror = (e) => reject(e);
  });

  recorder.start();

  let totalDurationMs = 0;
  for (let i = 0; i < frames.length; i++) {
    if (isAborted()) {
      recorder.stop();
      throw new Error('已取消輸出');
    }

    const frameItem = frames[i];
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    if (frameItem.originalCanvas) {
      ctx.drawImage(frameItem.originalCanvas, 0, 0, targetWidth, targetHeight);
    } else {
      const img = new Image();
      await new Promise<void>((r) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
          r();
        };
        img.src = frameItem.dataUrl;
      });
    }

    const delay = Math.max(20, frameItem.delayMs || 100);
    totalDurationMs += delay;

    onProgress({
      percent: Math.min(95, Math.round(((i + 1) / frames.length) * 95)),
      currentFrame: i + 1,
      totalFrames: frames.length,
      message: `[WebM 備選] 渲染影格 (${i + 1}/${frames.length})...`,
    });

    await new Promise((r) => setTimeout(r, delay));
  }

  recorder.stop();
  const blob = await recordingPromise;
  const url = URL.createObjectURL(blob);

  return {
    blob,
    url,
    sizeBytes: blob.size,
    width: targetWidth,
    height: targetHeight,
    frameCount: frames.length,
    durationSec: totalDurationMs / 1000,
    format: 'webm',
  };
}
