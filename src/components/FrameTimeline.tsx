import React, { useState, useEffect, useRef } from 'react';
import {
  Trash2,
  MoveLeft,
  MoveRight,
  ArrowUpDown,
  CheckSquare,
  Square,
  Play,
  Pause,
  GripVertical,
  Layers,
  Sparkles,
  AlertCircle,
  Clock,
} from 'lucide-react';
import { VideoFrameItem } from '../types';
import { formatTime } from '../utils/formatters';

interface FrameTimelineProps {
  frames: VideoFrameItem[];
  setFrames: React.Dispatch<React.SetStateAction<VideoFrameItem[]>>;
  onSeekToTime?: (time: number) => void;
  targetFps: number;
}

export const FrameTimeline: React.FC<FrameTimelineProps> = ({
  frames,
  setFrames,
  onSeekToTime,
  targetFps,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isFlipbookPlaying, setIsFlipbookPlaying] = useState(false);
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0);
  const animIntervalRef = useRef<number | null>(null);

  const selectedCount = frames.filter((f) => f.selected).length;

  // Toggle single frame selection
  const toggleSelect = (id: string) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, selected: !f.selected } : f))
    );
  };

  // Delete single frame
  const deleteFrame = (id: string) => {
    setFrames((prev) => prev.filter((f) => f.id !== id));
  };

  // Move frame left or right
  const moveFrame = (index: number, direction: 'left' | 'right') => {
    const targetIndex = direction === 'left' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= frames.length) return;

    setFrames((prev) => {
      const copy = [...prev];
      const item = copy.splice(index, 1)[0];
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(index));
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    setFrames((prev) => {
      const copy = [...prev];
      const movedItem = copy.splice(draggedIndex, 1)[0];
      copy.splice(targetIndex, 0, movedItem);
      return copy;
    });

    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const [confirmClear, setConfirmClear] = useState(false);

  // Auto reset confirmation after 3.5 seconds
  useEffect(() => {
    if (confirmClear) {
      const timer = setTimeout(() => setConfirmClear(false), 3500);
      return () => clearTimeout(timer);
    }
  }, [confirmClear]);

  // Batch actions
  const selectAll = (selected: boolean) => {
    setFrames((prev) => prev.map((f) => ({ ...f, selected })));
  };

  const reverseFrames = () => {
    setFrames((prev) => [...prev].reverse());
  };

  // Delete all checked/selected frames (user requested)
  const deleteSelected = () => {
    setFrames((prev) => prev.filter((f) => !f.selected));
  };

  // Unified delay state (default 100ms)
  const [unifiedDelay, setUnifiedDelay] = useState<number>(100);

  const applyUnifiedDelay = () => {
    const val = Math.max(10, unifiedDelay || 100);
    setFrames((prev) => prev.map((f) => ({ ...f, delayMs: val })));
  };

  const updateFrameDelay = (id: string, delayMs: number) => {
    setFrames((prev) =>
      prev.map((f) => (f.id === id ? { ...f, delayMs } : f))
    );
  };

  // Two-step reliable in-app clear without blocking iframe window.confirm
  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    setFrames([]);
    setConfirmClear(false);
  };

  // Flipbook animation preview that honors per-frame delayMs
  const activeFrames = frames.filter((f) => f.selected);

  useEffect(() => {
    if (!isFlipbookPlaying || activeFrames.length <= 1) {
      if (animIntervalRef.current) {
        clearTimeout(animIntervalRef.current);
        animIntervalRef.current = null;
      }
      return;
    }

    const currentFrame = activeFrames[previewFrameIdx % activeFrames.length];
    const delay = Math.max(20, currentFrame?.delayMs || Math.round(1000 / (targetFps || 10)));

    animIntervalRef.current = window.setTimeout(() => {
      setPreviewFrameIdx((prev) => (prev + 1) % activeFrames.length);
    }, delay);

    return () => {
      if (animIntervalRef.current) {
        clearTimeout(animIntervalRef.current);
      }
    };
  }, [isFlipbookPlaying, previewFrameIdx, activeFrames, targetFps]);

  if (frames.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
          <Layers className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-700">尚未擷取任何影格</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            請在上方使用「批次區段擷取」或播放影片手動點擊「擷取此影格」來添加影格。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      {/* Header and Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>影格縮圖清單</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
              已保留 {selectedCount} / {frames.length} 格
            </span>
          </h3>
        </div>

        {/* Flipbook Mini Preview Toggle & Batch Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {activeFrames.length > 0 && (
            <button
              type="button"
              onClick={() => setIsFlipbookPlaying(!isFlipbookPlaying)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                isFlipbookPlaying
                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
              title="即時連播預覽目前勾選的影格順序"
            >
              {isFlipbookPlaying ? (
                <>
                  <Pause className="w-3.5 h-3.5 fill-current" />
                  <span>暫停連播</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>預覽播放連播</span>
                </>
              )}
            </button>
          )}

          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl text-xs font-medium text-slate-600">
            {selectedCount < frames.length ? (
              <button
                type="button"
                onClick={() => selectAll(true)}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition-colors cursor-pointer"
                title="勾選全部影格"
              >
                全選
              </button>
            ) : (
              <button
                type="button"
                onClick={() => selectAll(false)}
                className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition-colors cursor-pointer"
                title="取消勾選全部影格"
              >
                取消全選
              </button>
            )}

            {selectedCount > 0 && (
              <button
                type="button"
                onClick={deleteSelected}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 transition-colors cursor-pointer font-medium"
                title={`刪除勾選的 ${selectedCount} 個影格`}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>刪除勾選 ({selectedCount})</span>
              </button>
            )}

            <button
              type="button"
              onClick={reverseFrames}
              className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
              title="顛倒所有影格順序 (倒放效果)"
            >
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>倒放</span>
            </button>

            <button
              type="button"
              onClick={handleClearAll}
              className={`px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                confirmClear
                  ? 'bg-rose-600 text-white font-semibold shadow-xs animate-pulse'
                  : 'hover:bg-rose-50 text-rose-600'
              }`}
              title={confirmClear ? '再次點擊確認清空所有影格' : '清空全部影格'}
            >
              {confirmClear ? (
                <>
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>確認清空？</span>
                </>
              ) : (
                <span>清空</span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Flipbook Mini Preview Container (if active) */}
      {isFlipbookPlaying && activeFrames.length > 0 && (
        <div className="p-3 bg-slate-900 rounded-xl flex items-center justify-center gap-4 text-white">
          <div className="relative w-48 aspect-video rounded-lg overflow-hidden bg-black border border-slate-700">
            <img
              src={activeFrames[previewFrameIdx]?.dataUrl}
              alt="Flipbook preview"
              className="w-full h-full object-contain"
            />
            <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/70 text-2xs font-mono text-slate-200">
              #{previewFrameIdx + 1} / {activeFrames.length}
            </span>
          </div>
          <div className="text-xs space-y-1">
            <div className="font-medium text-indigo-300">影格即時連續預覽中</div>
            <div className="text-slate-400">目前速率: ~{targetFps} FPS</div>
            <div className="text-2xs text-slate-500">拖曳下方縮圖可即時調整順序</div>
          </div>
        </div>
      )}

      {/* Unified Delay Bar (Requirement 6) */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-indigo-50/70 rounded-xl border border-indigo-100 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 font-medium text-slate-800">
            <Clock className="w-4 h-4 text-indigo-600" />
            <span>全部影格統一停留時間:</span>
          </div>

          <div className="flex items-center gap-1">
            <input
              type="number"
              min={10}
              max={60000}
              step={50}
              value={unifiedDelay}
              onChange={(e) => setUnifiedDelay(Math.max(10, parseInt(e.target.value) || 100))}
              className="w-20 px-2 py-1 rounded-lg border border-indigo-200 bg-white font-mono text-sm text-slate-900 text-center font-medium shadow-2xs focus:outline-hidden focus:ring-2 focus:ring-indigo-400"
            />
            <span className="font-mono text-slate-500">ms</span>
          </div>

          <button
            type="button"
            onClick={applyUnifiedDelay}
            className="px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium transition-colors shadow-2xs cursor-pointer active:scale-98"
          >
            一鍵套用到所有影格
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-1 text-2xs">
          <span className="text-slate-400">快速填入:</span>
          {[
            { label: '100ms', val: 100 },
            { label: '200ms', val: 200 },
            { label: '500ms', val: 500 },
            { label: '1000ms (1s)', val: 1000 },
            { label: '2000ms (2s)', val: 2000 },
          ].map((preset) => (
            <button
              key={preset.val}
              type="button"
              onClick={() => {
                setUnifiedDelay(preset.val);
                setFrames((prev) => prev.map((f) => ({ ...f, delayMs: preset.val })));
              }}
              className="px-2 py-1 rounded border border-indigo-200/80 bg-white hover:bg-indigo-50 text-indigo-700 transition-colors cursor-pointer"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Frame Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 max-h-[460px] overflow-y-auto p-1">
        {frames.map((frame, index) => {
          const isOver = dragOverIndex === index;
          const isDraggingThis = draggedIndex === index;

          return (
            <div
              key={frame.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`group relative rounded-xl border transition-all duration-150 overflow-hidden bg-slate-50 flex flex-col ${
                !frame.selected ? 'opacity-40 grayscale' : 'opacity-100'
              } ${
                isOver
                  ? 'border-indigo-500 ring-2 ring-indigo-400 scale-[1.02] shadow-md'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              } ${isDraggingThis ? 'opacity-30' : ''}`}
            >
              {/* Drag Handle & Checkbox Header */}
              <div className="px-2 py-1.5 bg-white/90 border-b border-slate-200 flex items-center justify-between text-2xs text-slate-600">
                <button
                  type="button"
                  onClick={() => toggleSelect(frame.id)}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-indigo-600"
                >
                  {frame.selected ? (
                    <CheckSquare className="w-3.5 h-3.5 text-indigo-600 fill-indigo-50" />
                  ) : (
                    <Square className="w-3.5 h-3.5 text-slate-400" />
                  )}
                  <span className="font-mono font-medium">#{index + 1}</span>
                </button>

                <div
                  className="cursor-grab active:cursor-grabbing p-0.5 text-slate-400 hover:text-slate-700"
                  title="按住拖曳以改變順序"
                >
                  <GripVertical className="w-3.5 h-3.5" />
                </div>
              </div>

              {/* Thumbnail Image */}
              <div
                className="relative aspect-video bg-slate-900 cursor-pointer overflow-hidden"
                onClick={() => onSeekToTime?.(frame.timestamp)}
                title="點擊將影片播放器跳轉至此時間點"
              >
                <img
                  src={frame.dataUrl}
                  alt={`Frame ${index + 1}`}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
                <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-black/75 text-white font-mono text-3xs backdrop-blur-xs">
                  {formatTime(frame.timestamp)}
                </span>
              </div>

              {/* Individual Frame Delay Input (Requirement 2) */}
              <div className="px-2 py-1 bg-white border-t border-slate-100 flex items-center justify-between text-2xs text-slate-500">
                <span>停留:</span>
                <div className="flex items-center gap-0.5">
                  <input
                    type="number"
                    min={10}
                    max={60000}
                    step={50}
                    value={frame.delayMs ?? 100}
                    onChange={(e) => {
                      const val = Math.max(10, parseInt(e.target.value) || 100);
                      updateFrameDelay(frame.id, val);
                    }}
                    className="w-14 px-1 py-0.5 rounded border border-slate-200 bg-slate-50 font-mono text-center text-2xs text-slate-800 focus:bg-white focus:outline-hidden focus:border-indigo-400"
                    title="單獨自訂此影格停留時間 (ms)"
                  />
                  <span className="font-mono text-3xs">ms</span>
                </div>
              </div>

              {/* Frame Action Toolbar */}
              <div className="px-1.5 py-1 bg-white flex items-center justify-between gap-1 border-t border-slate-100">
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveFrame(index, 'left')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="向左前移 1 格"
                  >
                    <MoveLeft className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={index === frames.length - 1}
                    onClick={() => moveFrame(index, 'right')}
                    className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="向右後移 1 格"
                  >
                    <MoveRight className="w-3 h-3" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => deleteFrame(frame.id)}
                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="刪除此影格"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
