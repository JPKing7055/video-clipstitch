import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  AlertTriangle,
  Zap,
  Repeat,
  Palette,
  Maximize,
  Film,
  Activity,
  Gauge,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { GifConfig, Mp4Config, VideoFrameItem } from '../types';
import { estimateGifSizeBytes, formatBytes } from '../utils/formatters';

interface GifConfigPanelProps {
  config: GifConfig;
  setConfig: React.Dispatch<React.SetStateAction<GifConfig>>;
  mp4Config: Mp4Config;
  setMp4Config: React.Dispatch<React.SetStateAction<Mp4Config>>;
  frames: VideoFrameItem[];
  setFrames?: React.Dispatch<React.SetStateAction<VideoFrameItem[]>>;
  captureDensity: number; // e.g. batchSettings.fps (5, 10, 15, 20)
  onGenerateGif: () => void;
  onGenerateMp4: () => void;
  isGenerating: boolean;
  videoNativeWidth?: number;
  videoNativeHeight?: number;
}

type SpeedOption = '1x' | '0.5x' | '0.25x' | '2x' | 'custom';

export const GifConfigPanel: React.FC<GifConfigPanelProps> = ({
  config,
  setConfig,
  mp4Config,
  setMp4Config,
  frames,
  setFrames,
  captureDensity = 10,
  onGenerateGif,
  onGenerateMp4,
  isGenerating,
  videoNativeWidth = 640,
  videoNativeHeight = 360,
}) => {
  const [activeTab, setActiveTab] = useState<'gif' | 'mp4'>('gif');
  const [selectedSpeed, setSelectedSpeed] = useState<SpeedOption>('1x');
  const [customSpeed, setCustomSpeed] = useState<number>(1.0);
  const [showAdvancedDelay, setShowAdvancedDelay] = useState<boolean>(false);
  const [manualDelayInput, setManualDelayInput] = useState<number>(100);

  const selectedFrames = frames.filter((f) => f.selected);
  const selectedCount = selectedFrames.length;

  // Aspect ratio
  const aspect = videoNativeWidth > 0 ? videoNativeHeight / videoNativeWidth : 9 / 16;

  // Calculate default frame delay in ms based on capture density and selected speed
  const getDelayForSpeed = (speed: SpeedOption, customVal: number): number => {
    const baseDelayMs = Math.round(1000 / Math.max(1, captureDensity));
    if (speed === '1x') return baseDelayMs;
    if (speed === '0.5x') return Math.round(baseDelayMs / 0.5); // e.g. 100 / 0.5 = 200ms
    if (speed === '0.25x') return Math.round(baseDelayMs / 0.25); // e.g. 100 / 0.25 = 400ms
    if (speed === '2x') return Math.round(baseDelayMs / 2); // e.g. 100 / 2 = 50ms
    if (speed === 'custom') {
      const s = Math.max(0.1, customVal || 1.0);
      return Math.round(baseDelayMs / s);
    }
    return baseDelayMs;
  };

  // Handle speed change
  const handleSpeedSelect = (speed: SpeedOption) => {
    setSelectedSpeed(speed);
    const delay = getDelayForSpeed(speed, customSpeed);
    setManualDelayInput(delay);

    // Apply unified delay to frames
    if (setFrames) {
      setFrames((prev) => prev.map((f) => ({ ...f, delayMs: delay })));
    }

    // Update config delayMs & effective fps
    setConfig((prev) => ({
      ...prev,
      delayMs: delay,
      fps: Math.max(1, Math.round(1000 / delay)),
    }));
  };

  // Handle custom speed multiplier change
  const handleCustomSpeedChange = (val: number) => {
    const safeVal = Math.max(0.05, Math.min(10, val));
    setCustomSpeed(safeVal);
    if (selectedSpeed === 'custom') {
      const delay = getDelayForSpeed('custom', safeVal);
      setManualDelayInput(delay);
      if (setFrames) {
        setFrames((prev) => prev.map((f) => ({ ...f, delayMs: delay })));
      }
      setConfig((prev) => ({
        ...prev,
        delayMs: delay,
        fps: Math.max(1, Math.round(1000 / delay)),
      }));
    }
  };

  // Handle manual delay input apply
  const handleApplyManualDelay = (delayVal: number) => {
    const safeDelay = Math.max(10, delayVal || 100);
    setManualDelayInput(safeDelay);
    setSelectedSpeed('custom');
    const baseDelayMs = 1000 / Math.max(1, captureDensity);
    setCustomSpeed(Number((baseDelayMs / safeDelay).toFixed(2)));

    if (setFrames) {
      setFrames((prev) => prev.map((f) => ({ ...f, delayMs: safeDelay })));
    }
    setConfig((prev) => ({
      ...prev,
      delayMs: safeDelay,
      fps: Math.max(1, Math.round(1000 / safeDelay)),
    }));
  };

  // Recalculate total duration based on each frame's delayMs
  const effectiveBaseDelay = getDelayForSpeed(selectedSpeed, customSpeed);
  const totalDurationMs = selectedFrames.reduce(
    (sum, f) => sum + (f.delayMs || effectiveBaseDelay),
    0
  );
  const totalDurationSec = totalDurationMs / 1000;

  // Calculate speed description for Requirement 4
  // Original real-time duration of the captured segment:
  const originalRealDurationSec =
    captureDensity > 0 ? selectedCount / captureDensity : selectedCount * 0.1;

  let speedDescription = '原速播放';
  if (originalRealDurationSec > 0 && totalDurationSec > 0) {
    const ratio = totalDurationSec / originalRealDurationSec;
    if (Math.abs(ratio - 1) < 0.05) {
      speedDescription = '原速播放';
    } else if (ratio > 1.05) {
      const slowMultiplier = ratio >= 9.95 ? ratio.toFixed(0) : ratio.toFixed(1);
      speedDescription = `原速的 ${slowMultiplier} 倍慢動作`;
    } else {
      const fastMultiplier =
        (1 / ratio) >= 9.95 ? (1 / ratio).toFixed(0) : (1 / ratio).toFixed(1);
      speedDescription = `原速的 ${fastMultiplier} 倍快動作`;
    }
  }

  // GIF Dimensions & Size estimation
  const gifHeight = Math.max(20, Math.round(config.width * aspect));
  const estimatedGifBytes = estimateGifSizeBytes(
    selectedCount,
    config.width,
    gifHeight,
    config.maxColors
  );

  // MP4 Dimensions (MUST BE EVEN)
  let mp4EvenWidth = Math.max(64, Math.round(mp4Config.width));
  if (mp4EvenWidth % 2 !== 0) mp4EvenWidth -= 1;
  let mp4EvenHeight = Math.max(64, Math.round(mp4EvenWidth * aspect));
  if (mp4EvenHeight % 2 !== 0) mp4EvenHeight -= 1;

  // MP4 estimated size: (bitrate * duration) / 8
  const estimatedMp4Bytes = Math.round(
    totalDurationSec * ((mp4Config.bitrateMbps * 1_000_000) / 8)
  );

  const isGifOver10Mb = estimatedGifBytes > 10 * 1024 * 1024;
  const isMp4Over10Mb = estimatedMp4Bytes > 10 * 1024 * 1024;

  const widthPresets = [320, 480, 640];
  const mp4FpsOptions = [15, 24, 30]; // 60 removed per requirement 3!
  const bitratePresets = [
    { label: '1.5 Mbps', val: 1.5 },
    { label: '2.5 Mbps (預設)', val: 2.5 },
    { label: '4.0 Mbps (高品質)', val: 4.0 },
    { label: '8.0 Mbps (高碼率)', val: 8.0 },
  ];

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-5">
      {/* SECTION 1: Unified Playback Speed (Shared by GIF and MP4) */}
      <div className="space-y-3 pb-4 border-b border-slate-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gauge className="w-4 h-4 text-indigo-600" />
            <h4 className="text-xs font-semibold text-slate-800">
              播放速度（GIF 與 MP4 共用）
            </h4>
          </div>
          <span className="text-2xs text-slate-400">
            原片擷取密度: {captureDensity} 張/秒
          </span>
        </div>

        {/* Speed Buttons */}
        <div className="grid grid-cols-5 gap-1.5">
          <button
            type="button"
            onClick={() => handleSpeedSelect('1x')}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
              selectedSpeed === '1x'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            原速 (1x)
          </button>

          <button
            type="button"
            onClick={() => handleSpeedSelect('0.5x')}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
              selectedSpeed === '0.5x'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            0.5 倍速
          </button>

          <button
            type="button"
            onClick={() => handleSpeedSelect('0.25x')}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
              selectedSpeed === '0.25x'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            0.25 倍速
          </button>

          <button
            type="button"
            onClick={() => handleSpeedSelect('2x')}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
              selectedSpeed === '2x'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            2 倍速
          </button>

          <button
            type="button"
            onClick={() => handleSpeedSelect('custom')}
            className={`py-2 px-1 rounded-xl text-xs font-semibold border transition-all cursor-pointer text-center ${
              selectedSpeed === 'custom'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-2xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            自訂倍速
          </button>
        </div>

        {/* Custom speed input row if custom is selected */}
        {selectedSpeed === 'custom' && (
          <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs">
            <span className="text-slate-600 font-medium shrink-0">自訂倍率:</span>
            <input
              type="number"
              min={0.1}
              max={10}
              step={0.1}
              value={customSpeed}
              onChange={(e) => handleCustomSpeedChange(parseFloat(e.target.value) || 1.0)}
              className="w-16 px-2 py-1 rounded-lg border border-slate-200 bg-white font-mono text-center font-medium"
            />
            <span className="text-slate-600 font-mono">x 倍速</span>
            <span className="text-2xs text-slate-400">
              (約等於每格停留 {getDelayForSpeed('custom', customSpeed)} ms)
            </span>
          </div>
        )}

        {/* Speed explanation note */}
        <p className="text-3xs text-slate-500">
          預設為「原速」，即播放幀率自動等於擷取密度（
          {Math.round(1000 / Math.max(1, captureDensity))} ms/張）；慢動作將等比增加每張停留時間。
        </p>

        {/* Advanced manual duration toggle */}
        <div className="pt-0.5">
          <button
            type="button"
            onClick={() => setShowAdvancedDelay(!showAdvancedDelay)}
            className="flex items-center gap-1 text-2xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
          >
            <Clock className="w-3.5 h-3.5" />
            <span>手動指定每張停留時間 (進階)</span>
            {showAdvancedDelay ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>

          {showAdvancedDelay && (
            <div className="mt-2 p-2.5 rounded-xl bg-indigo-50/50 border border-indigo-100 flex flex-wrap items-center gap-2 text-xs">
              <span className="text-slate-600 font-medium">指定停留:</span>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={10}
                  max={60000}
                  step={50}
                  value={manualDelayInput}
                  onChange={(e) => setManualDelayInput(parseInt(e.target.value) || 100)}
                  className="w-20 px-2 py-1 rounded-lg border border-indigo-200 bg-white font-mono text-center text-sm font-semibold text-slate-800"
                />
                <span className="font-mono text-slate-500">ms</span>
              </div>
              <button
                type="button"
                onClick={() => handleApplyManualDelay(manualDelayInput)}
                className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs shadow-2xs transition-all cursor-pointer"
              >
                套用至所有影格
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: Format Specific Settings (GIF vs MP4) */}
      <div className="space-y-4">
        {/* Tab Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('gif')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'gif'
                  ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>GIF 規格設定</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('mp4')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                activeTab === 'mp4'
                  ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-violet-600" />
              <span>MP4 規格設定 (H.264)</span>
            </button>
          </div>
        </div>

        {/* Mode 1: GIF Settings */}
        {activeTab === 'gif' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Output Width */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Maximize className="w-3.5 h-3.5 text-slate-500" />
                    <span>GIF 輸出解析度</span>
                  </span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    {config.width} × {gifHeight} px
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
                    min={160}
                    max={1280}
                    step={20}
                    value={config.width}
                    onChange={(e) =>
                      setConfig((prev) => ({
                        ...prev,
                        width: parseInt(e.target.value) || 480,
                      }))
                    }
                    className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-600">{config.width}px</span>
                </div>
              </div>

              {/* Loop */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Repeat className="w-3.5 h-3.5 text-slate-500" />
                    <span>循環播放</span>
                  </span>
                  <span className="text-2xs text-slate-500">
                    {config.repeat === 0 ? '永遠循環' : '僅播一次'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, repeat: 0 }))}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      config.repeat === 0
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    永遠循環 (推薦)
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig((prev) => ({ ...prev, repeat: -1 }))}
                    className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                      config.repeat === -1
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    僅播一次
                  </button>
                </div>
              </div>

              {/* Color Palette */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-slate-500" />
                    <span>調色盤品質</span>
                  </span>
                  <span className="text-2xs text-slate-500 font-mono">
                    {config.maxColors} 色
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[
                    { colors: 256, label: '最佳 256 色' },
                    { colors: 128, label: '平衡 128 色' },
                    { colors: 64, label: '精簡 64 色' },
                  ].map((q) => (
                    <button
                      key={q.colors}
                      type="button"
                      onClick={() => setConfig((prev) => ({ ...prev, maxColors: q.colors }))}
                      className={`flex-1 py-1.5 px-1.5 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        config.maxColors === q.colors
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {q.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* GIF Size Estimation */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium">預估 GIF 大小:</span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    isGifOver10Mb ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  ~{formatBytes(estimatedGifBytes)}
                </span>
              </div>
              <span className="text-2xs text-slate-400">Web Worker 本機量化編碼</span>
            </div>

            {isGifOver10Mb && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">預估 GIF 容量超過 10MB</p>
                  <p className="text-amber-800 mt-0.5">
                    建議將寬度調小（例如 480px / 360px）或減少影格數量。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Mode 2: MP4 Settings (WebCodecs H.264) */}
        {activeTab === 'mp4' && (
          <div className="space-y-4 pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* MP4 Output Width (Even number required) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Maximize className="w-3.5 h-3.5 text-slate-500" />
                    <span>MP4 解析度 (偶數寬高)</span>
                  </span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    {mp4EvenWidth} × {mp4EvenHeight} px
                  </span>
                </div>

                <div className="flex items-center gap-1.5">
                  {[480, 720, 1080].map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => setMp4Config((prev) => ({ ...prev, width: w }))}
                      className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                        mp4Config.width === w
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {w}p {w === 480 && '(預設)'}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="range"
                    min={240}
                    max={1920}
                    step={20}
                    value={mp4Config.width}
                    onChange={(e) => {
                      const raw = parseInt(e.target.value) || 480;
                      const even = raw % 2 === 0 ? raw : raw - 1;
                      setMp4Config((prev) => ({ ...prev, width: even }));
                    }}
                    className="flex-1 accent-indigo-600 h-1.5 bg-slate-200 rounded-lg cursor-pointer"
                  />
                  <span className="text-xs font-mono text-slate-600">{mp4EvenWidth}px</span>
                </div>
              </div>

              {/* Requirement 3: File Frame Rate (檔案幀率, 15 / 24 / 30, default 30) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-slate-500" />
                    <span>檔案幀率</span>
                  </span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    {mp4Config.fps} FPS
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                  {mp4FpsOptions.map((fpsVal) => (
                    <button
                      key={fpsVal}
                      type="button"
                      onClick={() => setMp4Config((prev) => ({ ...prev, fps: fpsVal }))}
                      className={`py-1.5 px-1.5 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        mp4Config.fps === fpsVal
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {fpsVal} fps {fpsVal === 30 && '(預設)'}
                    </button>
                  ))}
                </div>

                <p className="text-3xs text-slate-400">
                  僅影響檔案規格，不影響播放速度
                </p>
              </div>

              {/* Bitrate Selector */}
              <div className="space-y-2 md:col-span-2">
                <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-slate-500" />
                    <span>位元率 (Bitrate，預設 2~4 Mbps)</span>
                  </span>
                  <span className="font-mono text-indigo-700 font-semibold">
                    {mp4Config.bitrateMbps} Mbps
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {bitratePresets.map((b) => (
                    <button
                      key={b.val}
                      type="button"
                      onClick={() => setMp4Config((prev) => ({ ...prev, bitrateMbps: b.val }))}
                      className={`py-1.5 px-2 rounded-xl text-xs font-medium border text-center truncate transition-all cursor-pointer ${
                        mp4Config.bitrateMbps === b.val
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-semibold shadow-2xs'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* MP4 Size & Duration Estimation */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="text-slate-600 font-medium">預估 MP4 大小:</span>
                <span
                  className={`font-mono text-sm font-semibold ${
                    isMp4Over10Mb ? 'text-amber-600' : 'text-emerald-700'
                  }`}
                >
                  ~{formatBytes(estimatedMp4Bytes)}
                </span>
              </div>
              <span className="text-2xs text-slate-400">WebCodecs 硬體加速</span>
            </div>

            {isMp4Over10Mb && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
                <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">預估 MP4 容量超過 10MB</p>
                  <p className="text-amber-800 mt-0.5">
                    建議調低位元率（例如 1.5 或 2.5 Mbps）或調小解析度寬度。
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* SECTION 3: Requirement 4 - Output Preview Summary Box */}
      <div className="p-3.5 rounded-xl bg-indigo-50/80 border border-indigo-200/80 flex items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2 text-indigo-950 font-medium">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-600 text-white text-2xs font-bold uppercase">
            輸出預覽
          </span>
          <span className="font-semibold">
            共 {selectedCount} 張，預計時長 {totalDurationSec.toFixed(1)} 秒，{speedDescription}
          </span>
        </div>
      </div>

      {/* Dual Parallel Action Buttons */}
      <div className="pt-1 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Button 1: GIF */}
        <button
          type="button"
          onClick={onGenerateGif}
          disabled={isGenerating || selectedCount === 0}
          className="py-3 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 active:scale-[0.99] text-white font-medium text-xs sm:text-sm shadow-md shadow-indigo-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Sparkles className="w-4 h-4 fill-white/20" />
          <span>產生 GIF 動畫 ({selectedCount} 格)</span>
        </button>

        {/* Button 2: MP4 */}
        <button
          type="button"
          onClick={onGenerateMp4}
          disabled={isGenerating || selectedCount === 0}
          className="py-3 px-4 rounded-xl bg-gradient-to-r from-violet-600 to-purple-700 hover:from-violet-700 hover:to-purple-800 active:scale-[0.99] text-white font-medium text-xs sm:text-sm shadow-md shadow-violet-200 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Film className="w-4 h-4 fill-white/20" />
          <span>輸出 MP4 影片 ({selectedCount} 格 · H.264)</span>
        </button>
      </div>
    </div>
  );
};
