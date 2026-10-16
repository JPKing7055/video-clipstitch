import { Muxer, ArrayBufferTarget } from 'mp4-muxer';
import { VideoSegment, OutputConfig, ExportResult } from '../types';
import { seekVideo } from './videoExtractor';
import { checkWebCodecsSupport } from './mp4Generator';

export interface SegmentExportProgress {
  percent: number;
  currentSegment: number;
  totalSegments: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

/**
 * Concatenates all segments in list order and exports as either MP4 (via WebCodecs) or GIF (via Web Worker).
 * Guarantees that every frame strictly awaits video 'seeked' before drawing to canvas.
 */
export function exportSegments(
  video: HTMLVideoElement,
  segments: VideoSegment[],
  config: OutputConfig,
  onProgress: (p: SegmentExportProgress) => void
): { promise: Promise<ExportResult>; abort: () => void } {
  let isAborted = false;
  let activeEncoder: any = null;
  let activeWorker: Worker | null = null;

  const promise = new Promise<ExportResult>(async (resolve, reject) => {
    const originalTime = video.currentTime;
    const originalPaused = video.paused;

    try {
      if (segments.length === 0) {
        throw new Error('未包含任何片段');
      }

      if (!video.paused) {
        video.pause();
      }

      // Calculate output dimensions (MP4 requires even width & height)
      const firstFrameWidth = video.videoWidth || 640;
      const firstFrameHeight = video.videoHeight || 360;
      const aspect = firstFrameHeight / firstFrameWidth;

      let targetWidth = Math.max(64, Math.round(config.width || 480));
      if (config.format === 'mp4' && targetWidth % 2 !== 0) {
        targetWidth -= 1;
      }
      let targetHeight = Math.max(64, Math.round(targetWidth * aspect));
      if (config.format === 'mp4' && targetHeight % 2 !== 0) {
        targetHeight -= 1;
      }

      const fps = Math.max(1, Math.min(30, config.fps || 15));
      const frameDurationMicros = Math.round(1_000_000 / fps);
      const frameDelayMs = Math.round(1000 / fps);

      // Pre-calculate frame count per segment
      const segmentSpecs: Array<{
        segment: VideoSegment;
        rawDuration: number;
        outputDuration: number;
        numFrames: number;
      }> = [];

      let totalOutputFrames = 0;
      let totalOutputDurationSec = 0;

      for (const seg of segments) {
        const rawDur = Math.max(0.01, seg.endTime - seg.startTime);
        const outDur = rawDur / (seg.speed || 1);
        const count = Math.max(1, Math.round(outDur * fps));
        segmentSpecs.push({
          segment: seg,
          rawDuration: rawDur,
          outputDuration: outDur,
          numFrames: count,
        });
        totalOutputFrames += count;
        totalOutputDurationSec += outDur;
      }

      // Setup Canvas
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('無法建立 2D 畫布');

      // MODE 1: MP4 Export via WebCodecs + mp4-muxer
      if (config.format === 'mp4') {
        const check = await checkWebCodecsSupport();
        if (!check.supported) {
          throw new Error(`瀏覽器未支援 WebCodecs H.264 編碼 (${check.reason || ''})，建議切換為 GIF 格式。`);
        }

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
          output: (chunk: any, meta: any) => muxer.addVideoChunk(chunk, meta),
          error: (e: any) => {
            encodeError = e instanceof Error ? e : new Error(String(e));
          },
        });
        activeEncoder = encoder;

        await encoder.configure({
          codec: check.codec,
          width: targetWidth,
          height: targetHeight,
          bitrate: Math.round((config.bitrateMbps || 2.5) * 1_000_000),
          framerate: fps,
        });

        let globalFrameIdx = 0;
        let currentTimestampMicros = 0;

        for (let sIdx = 0; sIdx < segmentSpecs.length; sIdx++) {
          if (isAborted) throw new Error('已取消輸出');
          const spec = segmentSpecs[sIdx];
          const seg = spec.segment;

          for (let f = 0; f < spec.numFrames; f++) {
            if (isAborted) throw new Error('已取消輸出');
            if (encodeError) throw encodeError;

            // Calculate precise source timestamp in original video
            const progressRatio = spec.numFrames > 1 ? f / (spec.numFrames - 1) : 0;
            const sourceTime = seg.startTime + progressRatio * spec.rawDuration;

            // Strict wait for seeked event before painting
            await seekVideo(video, sourceTime);

            if (isAborted) throw new Error('已取消輸出');

            // Draw to canvas
            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

            // Backpressure check
            if (encoder.encodeQueueSize > 8) {
              await new Promise((r) => setTimeout(r, 6));
            }

            const isKeyFrame = globalFrameIdx === 0 || globalFrameIdx % (fps * 2) === 0;
            const videoFrame = new (window as any).VideoFrame(canvas, {
              timestamp: currentTimestampMicros,
              duration: frameDurationMicros,
            });

            encoder.encode(videoFrame, { keyFrame: isKeyFrame });
            videoFrame.close();

            currentTimestampMicros += frameDurationMicros;
            globalFrameIdx++;

            const percent = Math.min(95, Math.round((globalFrameIdx / totalOutputFrames) * 95));
            onProgress({
              percent,
              currentSegment: sIdx + 1,
              totalSegments: segmentSpecs.length,
              currentFrame: globalFrameIdx,
              totalFrames: totalOutputFrames,
              message: `擷取片段 #${sIdx + 1}/${segmentSpecs.length} (第 ${f + 1}/${spec.numFrames} 幀)...`,
            });

            // Yield to UI
            await new Promise((r) => setTimeout(r, 8));
          }
        }

        onProgress({
          percent: 96,
          currentSegment: segmentSpecs.length,
          totalSegments: segmentSpecs.length,
          currentFrame: totalOutputFrames,
          totalFrames: totalOutputFrames,
          message: '完成影格擷取，正在封裝 MP4 檔案...',
        });

        await encoder.flush();
        encoder.close();
        activeEncoder = null;
        muxer.finalize();

        const blob = new Blob([target.buffer], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);

        onProgress({
          percent: 100,
          currentSegment: segmentSpecs.length,
          totalSegments: segmentSpecs.length,
          currentFrame: totalOutputFrames,
          totalFrames: totalOutputFrames,
          message: 'MP4 影片輸出完成！',
        });

        resolve({
          blob,
          url,
          sizeBytes: blob.size,
          width: targetWidth,
          height: targetHeight,
          durationSec: totalOutputDurationSec,
          frameCount: totalOutputFrames,
          format: 'mp4',
        });
      } else {
        // MODE 2: GIF Export via Web Worker
        const framePayloads: Array<{
          buffer: ArrayBuffer;
          width: number;
          height: number;
          delay: number;
        }> = [];

        let globalFrameIdx = 0;

        for (let sIdx = 0; sIdx < segmentSpecs.length; sIdx++) {
          if (isAborted) throw new Error('已取消輸出');
          const spec = segmentSpecs[sIdx];
          const seg = spec.segment;

          for (let f = 0; f < spec.numFrames; f++) {
            if (isAborted) throw new Error('已取消輸出');

            const progressRatio = spec.numFrames > 1 ? f / (spec.numFrames - 1) : 0;
            const sourceTime = seg.startTime + progressRatio * spec.rawDuration;

            // Strict wait for seeked event before painting
            await seekVideo(video, sourceTime);

            if (isAborted) throw new Error('已取消輸出');

            ctx.clearRect(0, 0, targetWidth, targetHeight);
            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);

            const imgData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            framePayloads.push({
              buffer: imgData.data.buffer,
              width: targetWidth,
              height: targetHeight,
              delay: frameDelayMs,
            });

            globalFrameIdx++;

            const prepPercent = Math.min(30, Math.round((globalFrameIdx / totalOutputFrames) * 30));
            onProgress({
              percent: prepPercent,
              currentSegment: sIdx + 1,
              totalSegments: segmentSpecs.length,
              currentFrame: globalFrameIdx,
              totalFrames: totalOutputFrames,
              message: `擷取片段 #${sIdx + 1}/${segmentSpecs.length} (${f + 1}/${spec.numFrames})...`,
            });

            await new Promise((r) => setTimeout(r, 8));
          }
        }

        if (isAborted) throw new Error('已取消輸出');

        onProgress({
          percent: 32,
          currentSegment: segmentSpecs.length,
          totalSegments: segmentSpecs.length,
          currentFrame: totalOutputFrames,
          totalFrames: totalOutputFrames,
          message: 'Web Worker 已啟動，開始量化與編碼 GIF...',
        });

        // Launch Web Worker
        const worker = new Worker(
          new URL('../workers/gifEncoder.worker.ts', import.meta.url),
          { type: 'module' }
        );
        activeWorker = worker;

        worker.onmessage = (e: MessageEvent) => {
          if (isAborted) return;
          const msg = e.data;

          if (msg.type === 'progress') {
            const overallPercent = Math.min(96, Math.round(32 + (msg.percent / 100) * 64));
            onProgress({
              percent: overallPercent,
              currentSegment: segmentSpecs.length,
              totalSegments: segmentSpecs.length,
              currentFrame: msg.current,
              totalFrames: msg.total,
              message: msg.stage || `編碼影格 ${msg.current} / ${msg.total}`,
            });
          } else if (msg.type === 'done') {
            onProgress({
              percent: 100,
              currentSegment: segmentSpecs.length,
              totalSegments: segmentSpecs.length,
              currentFrame: totalOutputFrames,
              totalFrames: totalOutputFrames,
              message: 'GIF 動畫輸出完成！',
            });

            const blob = new Blob([msg.buffer], { type: 'image/gif' });
            const url = URL.createObjectURL(blob);
            worker.terminate();
            activeWorker = null;

            resolve({
              blob,
              url,
              sizeBytes: blob.size,
              width: msg.width,
              height: msg.height,
              durationSec: totalOutputDurationSec,
              frameCount: totalOutputFrames,
              format: 'gif',
            });
          } else if (msg.type === 'error') {
            worker.terminate();
            activeWorker = null;
            reject(new Error(msg.error || 'GIF 編碼失敗'));
          }
        };

        worker.onerror = (err) => {
          worker.terminate();
          activeWorker = null;
          reject(new Error(`Web Worker 錯誤: ${err.message}`));
        };

        const transferList = framePayloads.map((f) => f.buffer);
        worker.postMessage(
          {
            frames: framePayloads,
            width: targetWidth,
            height: targetHeight,
            repeat: config.repeat ?? 0,
            maxColors: config.maxColors ?? 256,
            format: 'rgb565',
          },
          transferList
        );
      }
    } catch (err) {
      if (activeEncoder) {
        try {
          activeEncoder.close();
        } catch {}
      }
      if (activeWorker) {
        try {
          activeWorker.terminate();
        } catch {}
      }
      reject(err);
    } finally {
      // Restore video position
      try {
        await seekVideo(video, originalTime);
        if (!originalPaused) {
          video.play().catch(() => {});
        }
      } catch {}
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
      if (activeWorker) {
        try {
          activeWorker.terminate();
        } catch {}
      }
    },
  };
}
