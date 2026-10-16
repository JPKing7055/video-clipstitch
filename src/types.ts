export interface VideoSegment {
  id: string;
  startTime: number;
  endTime: number;
  speed: 0.25 | 0.5 | 1 | 2;
  thumbnailUrl: string;
}

export interface OutputConfig {
  width: number; // default 480 (MP4 even)
  fps: 10 | 15 | 24 | 30; // default 15
  format: 'mp4' | 'gif';
  bitrateMbps: number; // default 2.5
  repeat: number; // default 0 (infinite loop for GIF)
  maxColors: number; // default 256 for GIF
}

export interface ExportProgress {
  percent: number;
  currentSegment: number;
  totalSegments: number;
  currentFrame: number;
  totalFrames: number;
  message: string;
}

export interface ExportResult {
  blob: Blob;
  url: string;
  sizeBytes: number;
  width: number;
  height: number;
  durationSec: number;
  frameCount: number;
  format: 'mp4' | 'gif' | 'webm';
  fallbackNotice?: string;
}

// Backward compatibility interfaces
export interface VideoFrameItem {
  id: string;
  timestamp: number;
  dataUrl: string;
  originalCanvas?: OffscreenCanvas | HTMLCanvasElement;
  width: number;
  height: number;
  selected: boolean;
  delayMs?: number;
}

export interface GifConfig {
  width: number;
  fps: number;
  delayMs: number;
  repeat: number;
  maxColors: number;
  format: 'rgb565' | 'rgb444' | 'rgba4444';
}

export interface Mp4Config {
  width: number;
  fps: number;
  bitrateMbps: number;
}

export interface BatchExtractionSettings {
  startTime: number;
  endTime: number;
  fps: number;
}
