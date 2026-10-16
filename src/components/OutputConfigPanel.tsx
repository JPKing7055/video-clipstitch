import React from 'react';
import {
  Film,
  Sparkles,
  Maximize,
  Zap,
  AlertTriangle,
  Layers,
  Clock,
} from 'lucide-react';
import { OutputConfig, VideoSegment } from '../types';
import { calculateSegmentsStats } from '../utils/segmentUtils';
import { estimateGifSizeBytes, formatBytes } from '../utils/formatters';

interface OutputConfigPanelProps {
  config: OutputConfig;
  setConfig: React.Dispatch<React.SetStateAction<OutputConfig>>;
  segments: VideoSegment[];
  onStartExport: () => void;
  isExporting: boolean;
  videoNativeWidth?: number;
  videoNativeHeight?: number;
}

export const OutputConfigPanel: React.FC<OutputConfigPanelProps> = ({
  config,
  setConfig,
  segments,
  onStartExport,
  isExporting,
  videoNativeWidth = 640,
  videoNativeHeight = 360,
}) => {
  // Aggregate stats (Requirement 12)
  const stats = calculateSegmentsStats(segments, config.fps);

  // Proportional height
  const aspect = videoNativeWidth > 0 ? videoNativeHeight / videoNativeWidth : 9 / 16;
  let targetWidth = Math.max(64, Math.round(config.width));
  if (config.format === 'mp4' && targetWidth % 2 !== 0) {
    targetWidth -= 1;
  }
  let targetHeight = Math.max(64, Math.round(targetWidth * aspect));
  if (config.format === 'mp4' && targetHeight % 2 !== 0) {
    targetHeight -= 1;
  }

  // Size estimation
  const estimatedGifBytes = estimateGifSizeBytes(
    stats.totalFrames,
    targetWidth,
    targetHeight,
    config.maxColors || 256
  );
  const estimatedMp4Bytes = Math.round(
    stats.totalDurationSec * (((config.bitrateMbps || 2.5) * 1_000_000) / 8)
  );

  const isGifOver10Mb = config.format === 'gif' && estimatedGifBytes > 10 * 1024 * 1024;

  const widthPresets = [320, 480, 640, 720];
  const fpsOptions = [10, 15, 24, 30] as const; // 60fps removed per requirement 11!

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
      {/* Title & Format selector (Requirement 10) */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <span>輸出設定</span>
        </h3>

        {/* Format Selector: MP4 vs GIF */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, format: 'mp4' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              config.format === 'mp4'
                ? 'bg-white text-violet-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Film className="w-3.5 h-3.5 text-violet-600" />
            <span>MP4 影片</span>
          </button>

          <button
            type="button"
            onClick={() => setConfig((prev) => ({ ...prev, format: 'gif' }))}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              config.format === 'gif'
                ? 'bg-white text-indigo-800 shadow-xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            <span>GIF 動畫</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Width (Requirement 10: default 480px, even for MP4) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span className="flex items-center gap-1.5">
              <Maximize className="w-3.5 h-3.5 text-slate-500" />
              <span>輸出解析度 (等比縮放)</span>
            </span>
            <span className="font-mono text-indigo-700 font-semibold">
              {targetWidth} × {targetHeight} px
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {widthPresets.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, width: w }))}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                  config.width === w
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {w}px {w === 480 && '(預設)'}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 pt-0.5">
            <input
              type="range"
              min={240}
              max={1920}
              step={20}
              value={config.width}
              onChange={(e) => {
                const raw = parseInt(e.target.value) || 480;
                const even = config.format === 'mp4' && raw % 2 !== 0 ? raw - 1 : raw;
                setConfig((prev) => ({ ...prev, width: even }));
              }}
              className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
            />
            <span className="text-xs font-mono text-slate-600">{targetWidth}px</span>
          </div>
        </div>

        {/* 2. Output Frame Rate (Requirement 10 & 11: default 15, options 10/15/24/30) */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-700">
            <span className="flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-slate-500" />
              <span>輸出幀率 (FPS)</span>
            </span>
            <span className="font-mono text-indigo-700 font-semibold">
              {config.fps} FPS
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {fpsOptions.map((fpsVal) => (
              <button
                key={fpsVal}
                type="button"
                onClick={() => setConfig((prev) => ({ ...prev, fps: fpsVal }))}
                className={`py-1.5 px-1.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                  config.fps === fpsVal
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                {fpsVal} fps {fpsVal === 15 && '(預設)'}
              </button>
            ))}
          </div>

          {/* Explanation note per requirement 11 */}
          <p className="text-3xs text-slate-400 leading-tight">
            每秒輸出幾張畫面，越高越流暢但檔案越大
          </p>
        </div>
      </div>

      {/* GIF Size warning if > 10MB (Requirement 13) */}
      {isGifOver10Mb && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-900">
              GIF 檔案大小提醒：預估容量超過 10MB (~{formatBytes(estimatedGifBytes)})
            </p>
            <p className="text-amber-800 leading-relaxed">
              建議調低輸出寬度（如 320px 或 480px）、或降低輸出幀率至 10/15 fps，或切換為 MP4 格式輸出以取得更小容量。
            </p>
          </div>
        </div>
      )}

      {/* Requirement 12: Preview Summary Info Box */}
      <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-indigo-950 font-medium">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-2xs font-bold uppercase">
            輸出預覽
          </span>
          <span className="font-semibold text-sm text-slate-900">
            共 {stats.count} 個片段，總長 {stats.totalDurationSec} 秒，約 {stats.totalFrames} 張畫面
          </span>
        </div>

        <div className="text-2xs text-slate-500 font-mono hidden sm:block">
          預估容量: ~
          {formatBytes(
            config.format === 'mp4' ? estimatedMp4Bytes : estimatedGifBytes
          )}
        </div>
      </div>

      {/* Primary Export Button */}
      <div>
        <button
          type="button"
          onClick={onStartExport}
          disabled={isExporting || segments.length === 0}
          className={`w-full py-3.5 px-6 rounded-xl font-bold text-sm shadow-md flex items-center justify-center gap-2.5 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
            config.format === 'mp4'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white shadow-violet-200 active:scale-[0.99]'
              : 'bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700 text-white shadow-indigo-200 active:scale-[0.99]'
          }`}
        >
          {config.format === 'mp4' ? (
            <>
              <Film className="w-4 h-4 fill-white/20" />
              <span>
                {segments.length === 0
                  ? '請先加入至少 1 個片段'
                  : `輸出 MP4 影片 (${stats.count} 個片段 · 約 ${stats.totalFrames} 幀)`}
              </span>
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 fill-white/20" />
              <span>
                {segments.length === 0
                  ? '請先加入至少 1 個片段'
                  : `產生 GIF 動畫 (${stats.count} 個片段 · 約 ${stats.totalFrames} 幀)`}
              </span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};
