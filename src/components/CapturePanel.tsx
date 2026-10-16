import React, { useState } from 'react';
import {
  Camera,
  Layers,
  PlayCircle,
  XCircle,
  AlertCircle,
  Zap,
  CheckCircle2,
} from 'lucide-react';
import { BatchExtractionSettings } from '../types';
import { formatTime } from '../utils/formatters';

interface CapturePanelProps {
  currentTime: number;
  duration: number;
  onManualCapture: () => void;
  onBatchCapture: (settings: BatchExtractionSettings) => void;
  isBatchExtracting: boolean;
  batchProgress: { current: number; total: number; percent: number };
  onCancelBatch: () => void;
  batchSettings: BatchExtractionSettings;
  setBatchSettings: React.Dispatch<React.SetStateAction<BatchExtractionSettings>>;
}

export const CapturePanel: React.FC<CapturePanelProps> = ({
  currentTime,
  duration,
  onManualCapture,
  onBatchCapture,
  isBatchExtracting,
  batchProgress,
  onCancelBatch,
  batchSettings,
  setBatchSettings,
}) => {
  const [activeTab, setActiveTab] = useState<'batch' | 'manual'>('batch');
  const [justCaptured, setJustCaptured] = useState(false);

  // Quick calculate expected frames
  const rangeDuration = Math.max(0, batchSettings.endTime - batchSettings.startTime);
  const estimatedFrames = Math.max(1, Math.round(rangeDuration * batchSettings.fps) + 1);

  const handleManualClick = () => {
    onManualCapture();
    setJustCaptured(true);
    setTimeout(() => setJustCaptured(false), 900);
  };

  const handleFpsChange = (fpsVal: number) => {
    setBatchSettings((prev) => ({ ...prev, fps: fpsVal }));
  };

  const startBatch = () => {
    onBatchCapture(batchSettings);
  };

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      {/* Mode Switcher Tabs */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'batch'
                ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>批次區段擷取</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
              activeTab === 'manual'
                ? 'bg-white text-indigo-900 shadow-xs font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Camera className="w-3.5 h-3.5" />
            <span>手動單張擷取</span>
          </button>
        </div>

        <span className="text-xs text-slate-500 font-mono">
          目前時間: {formatTime(currentTime)}
        </span>
      </div>

      {/* Tab 1: Batch Capture */}
      {activeTab === 'batch' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            {/* Start Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-700">起始秒數 (秒)</label>
                <button
                  type="button"
                  onClick={() =>
                    setBatchSettings((prev) => ({
                      ...prev,
                      startTime: Number(currentTime.toFixed(2)),
                    }))
                  }
                  className="text-indigo-600 hover:text-indigo-700 text-2xs font-medium hover:underline"
                >
                  帶入目前時間
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={0}
                  max={batchSettings.endTime}
                  step={0.1}
                  value={batchSettings.startTime}
                  disabled={isBatchExtracting}
                  onChange={(e) => {
                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                    setBatchSettings((prev) => ({
                      ...prev,
                      startTime: Math.min(val, prev.endTime),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 font-mono text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                  {formatTime(batchSettings.startTime)}
                </span>
              </div>
            </div>

            {/* End Time */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <label className="font-medium text-slate-700">結束秒數 (秒)</label>
                <button
                  type="button"
                  onClick={() =>
                    setBatchSettings((prev) => ({
                      ...prev,
                      endTime: Number(currentTime.toFixed(2)),
                    }))
                  }
                  className="text-indigo-600 hover:text-indigo-700 text-2xs font-medium hover:underline"
                >
                  帶入目前時間
                </button>
              </div>
              <div className="relative">
                <input
                  type="number"
                  min={batchSettings.startTime}
                  max={duration || 1000}
                  step={0.1}
                  value={batchSettings.endTime}
                  disabled={isBatchExtracting}
                  onChange={(e) => {
                    const val = Math.max(
                      batchSettings.startTime,
                      parseFloat(e.target.value) || 0
                    );
                    setBatchSettings((prev) => ({
                      ...prev,
                      endTime: Math.min(val, duration || val),
                    }));
                  }}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50/50 font-mono text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <span className="absolute right-3 top-2.5 text-xs text-slate-400 font-mono">
                  {formatTime(batchSettings.endTime)}
                </span>
              </div>
            </div>

            {/* Density Selector */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">
                擷取密度（每秒影片取幾張）
              </label>
              <div className="flex items-center gap-1.5">
                {[5, 10, 15, 20].map((f) => (
                  <button
                    key={f}
                    type="button"
                    disabled={isBatchExtracting}
                    onClick={() => handleFpsChange(f)}
                    className={`flex-1 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${
                      batchSettings.fps === f
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {f} 張
                  </button>
                ))}
              </div>
              <p className="text-3xs text-slate-400 leading-tight">
                決定從原影片取多少素材，與播放速度無關
              </p>
            </div>
          </div>

          {/* Quick summary & Actions */}
          <div className="pt-1 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 rounded-xl p-3 border border-slate-200/60">
            <div className="text-xs text-slate-600 flex items-center gap-3">
              <span>
                擷取時長: <strong className="font-mono text-slate-800">{rangeDuration.toFixed(2)}s</strong>
              </span>
              <span>·</span>
              <span>
                預計影格數: <strong className="font-mono text-indigo-700 text-sm">{estimatedFrames}</strong> 張
              </span>
            </div>

            <div className="flex items-center gap-2">
              {isBatchExtracting ? (
                <button
                  type="button"
                  onClick={onCancelBatch}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>中止擷取</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startBatch}
                  disabled={batchSettings.endTime <= batchSettings.startTime}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>開始批次擷取影格</span>
                </button>
              )}
            </div>
          </div>

          {/* Extraction progress bar */}
          {isBatchExtracting && (
            <div className="space-y-1.5 p-3 rounded-xl bg-indigo-50/70 border border-indigo-100">
              <div className="flex items-center justify-between text-xs font-medium text-indigo-900">
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                  正在逐格對齊並擷取影格中... (已確保 seeked 影格正確性)
                </span>
                <span className="font-mono">{batchProgress.percent}% ({batchProgress.current}/{batchProgress.total})</span>
              </div>
              <div className="h-2 w-full bg-indigo-200/70 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all duration-150 rounded-full"
                  style={{ width: `${batchProgress.percent}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Manual Capture */}
      {activeTab === 'manual' && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="space-y-1 text-center sm:text-left">
              <h4 className="text-sm font-semibold text-slate-800">
                手動單張影格擷取
              </h4>
              <p className="text-xs text-slate-500">
                將影片拖動或逐格暫停至想要的時間點，點擊按鈕即可精準收錄該影格。
              </p>
            </div>

            <button
              type="button"
              onClick={handleManualClick}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-xs ${
                justCaptured
                  ? 'bg-emerald-600 text-white scale-105'
                  : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
              }`}
            >
              {justCaptured ? (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>已成功擷取影格！</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4" />
                  <span>擷取此影格 ({formatTime(currentTime)})</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
