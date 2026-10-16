import { GIFEncoder, quantize, applyPalette } from 'gifenc';

export interface FramePayload {
  buffer: ArrayBuffer;
  width: number;
  height: number;
  delay: number;
}

export interface EncodeMessageData {
  frames: FramePayload[];
  width: number;
  height: number;
  repeat: number;
  maxColors: number;
  format: 'rgb565' | 'rgb444' | 'rgba4444';
}

self.onmessage = (e: MessageEvent<EncodeMessageData>) => {
  try {
    const { frames, width, height, repeat, maxColors, format } = e.data;
    if (!frames || frames.length === 0) {
      throw new Error('未提供影格資料');
    }

    const gif = GIFEncoder();
    const total = frames.length;

    for (let i = 0; i < total; i++) {
      const frame = frames[i];
      const rgba = new Uint8Array(frame.buffer);

      // Quantize colors for this frame
      const palette = quantize(rgba, maxColors || 256, {
        format: format || 'rgb565',
      });

      // Map RGBA pixels to palette indices
      const index = applyPalette(rgba, palette, format || 'rgb565');

      // Write frame into GIF stream
      gif.writeFrame(index, width, height, {
        palette,
        delay: frame.delay,
        repeat: i === 0 ? repeat : undefined,
      });

      // Send progress update
      const percent = Math.round(((i + 1) / total) * 100);
      self.postMessage({
        type: 'progress',
        current: i + 1,
        total,
        percent,
        stage: `編碼影格 ${i + 1} / ${total}`,
      });
    }

    gif.finish();
    const bytesView = gif.bytesView();
    // Copy or transfer the byte buffer
    const resultBuffer = bytesView.slice().buffer;

    const workerCtx = self as unknown as {
      postMessage: (message: unknown, transfer?: Transferable[]) => void;
    };

    workerCtx.postMessage(
      {
        type: 'done',
        buffer: resultBuffer,
        width,
        height,
      },
      [resultBuffer]
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'GIF 編碼過程發生錯誤';
    self.postMessage({
      type: 'error',
      error: message,
    });
  }
};
