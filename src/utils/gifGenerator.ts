import { VideoFrameItem, GifConfig } from '../types';

export interface GifGenerationProgress {
  stage: 'preparing' | 'encoding' | 'finalizing';
  percent: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

export interface GifGenerationResult {
  blob: Blob;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  frameCount: number;
  durationSec: number;
}

export function generateGifWithWorker(
  frames: VideoFrameItem[],
  config: GifConfig,
  onProgress: (progress: GifGenerationProgress) => void
): { promise: Promise<GifGenerationResult>; abort: () => void } {
  let worker: Worker | null = null;
  let isAborted = false;

  const promise = new Promise<GifGenerationResult>(async (resolve, reject) => {
    try {
      if (frames.length === 0) {
        throw new Error('沒有可用的影格來製作 GIF');
      }

      // Compute dimensions maintaining aspect ratio of first frame
      const firstFrame = frames[0];
      const targetWidth = Math.max(80, Math.min(1920, Math.round(config.width)));
      const aspect = (firstFrame.height || 360) / (firstFrame.width || 640);
      const targetHeight = Math.max(60, Math.round(targetWidth * aspect));

      onProgress({
        stage: 'preparing',
        percent: 5,
        currentFrame: 0,
        totalFrames: frames.length,
        message: '正在縮放並準備影格資料...',
      });

      // Prepare resized frame buffers
      const offscreen = document.createElement('canvas');
      offscreen.width = targetWidth;
      offscreen.height = targetHeight;
      const ctx = offscreen.getContext('2d', { willReadFrequently: true });

      if (!ctx) {
        throw new Error('無法建立 2D 畫布環境');
      }

      const framePayloads: Array<{
        buffer: ArrayBuffer;
        width: number;
        height: number;
        delay: number;
      }> = [];

      const delayPerFrame = Math.max(20, Math.round(config.delayMs || 1000 / config.fps));

      for (let i = 0; i < frames.length; i++) {
        if (isAborted) {
          throw new Error('已取消製作');
        }

        const frameItem = frames[i];
        ctx.clearRect(0, 0, targetWidth, targetHeight);

        // Draw original canvas or thumbnail image onto resized canvas
        if (frameItem.originalCanvas) {
          ctx.drawImage(frameItem.originalCanvas, 0, 0, targetWidth, targetHeight);
        } else {
          // Fallback to loading dataUrl
          const img = new Image();
          await new Promise<void>((imgResolve) => {
            img.onload = () => {
              ctx.drawImage(img, 0, 0, targetWidth, targetHeight);
              imgResolve();
            };
            img.src = frameItem.dataUrl;
          });
        }

        const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
        framePayloads.push({
          buffer: imgData.data.buffer,
          width: targetWidth,
          height: targetHeight,
          delay: frameItem.delayMs || delayPerFrame,
        });

        const prepPercent = Math.round(5 + (i / frames.length) * 20);
        onProgress({
          stage: 'preparing',
          percent: prepPercent,
          currentFrame: i + 1,
          totalFrames: frames.length,
          message: `準備影格 (${i + 1}/${frames.length})...`,
        });
      }

      if (isAborted) {
        throw new Error('已取消製作');
      }

      onProgress({
        stage: 'encoding',
        percent: 25,
        currentFrame: 0,
        totalFrames: frames.length,
        message: 'Web Worker 已啟動，開始編碼...',
      });

      // Instantiate Web Worker using Vite standard module worker syntax
      worker = new Worker(
        new URL('../workers/gifEncoder.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (e: MessageEvent) => {
        if (isAborted) return;
        const msg = e.data;

        if (msg.type === 'progress') {
          // Map worker progress from 25% to 95%
          const overallPercent = Math.min(95, Math.round(25 + (msg.percent / 100) * 70));
          onProgress({
            stage: 'encoding',
            percent: overallPercent,
            currentFrame: msg.current,
            totalFrames: msg.total,
            message: msg.stage || `編碼影格 ${msg.current} / ${msg.total}`,
          });
        } else if (msg.type === 'done') {
          onProgress({
            stage: 'finalizing',
            percent: 100,
            currentFrame: frames.length,
            totalFrames: frames.length,
            message: '編碼完成，正在生成 GIF 檔案...',
          });

          const blob = new Blob([msg.buffer], { type: 'image/gif' });
          const url = URL.createObjectURL(blob);
          const totalDelayMs = framePayloads.reduce((sum, f) => sum + f.delay, 0);

          if (worker) {
            worker.terminate();
            worker = null;
          }

          resolve({
            blob,
            url,
            sizeBytes: blob.size,
            width: msg.width,
            height: msg.height,
            frameCount: frames.length,
            durationSec: totalDelayMs / 1000,
          });
        } else if (msg.type === 'error') {
          if (worker) {
            worker.terminate();
            worker = null;
          }
          reject(new Error(msg.error || 'GIF 編碼失敗'));
        }
      };

      worker.onerror = (err) => {
        if (worker) {
          worker.terminate();
          worker = null;
        }
        reject(new Error(`Web Worker 錯誤: ${err.message}`));
      };

      // Send payload with transferable buffers for zero-copy high performance
      const transferList = framePayloads.map((f) => f.buffer);
      worker.postMessage(
        {
          frames: framePayloads,
          width: targetWidth,
          height: targetHeight,
          repeat: config.repeat,
          maxColors: config.maxColors,
          format: config.format,
        },
        transferList
      );
    } catch (err) {
      if (worker) {
        worker.terminate();
        worker = null;
      }
      reject(err);
    }
  });

  return {
    promise,
    abort: () => {
      isAborted = true;
      if (worker) {
        worker.terminate();
        worker = null;
      }
    },
  };
}
