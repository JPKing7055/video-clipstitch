import React, { useState } from 'react';
import {
  Film,
  Trash2,
  MoveUp,
  MoveDown,
  GripVertical,
  Play,
  AlertTriangle,
  Clock,
  Gauge,
  Sparkles,
  Layers,
  AlertCircle,
} from 'lucide-react';
import { VideoSegment } from '../types';
import { formatTime } from '../utils/formatters';
import { isSegmentOverlapping, hasAnyOverlap } from '../utils/segmentUtils';

interface SegmentListProps {
  segments: VideoSegment[];
  setSegments: React.Dispatch<React.SetStateAction<VideoSegment[]>>;
  onSeekToTime: (time: number) => void;
}

export const SegmentList: React.FC<SegmentListProps> = ({
  segments,
  setSegments,
  onSeekToTime,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const anyOverlap = hasAnyOverlap(segments);

  // Reorder handlers
  const moveSegment = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= segments.length) return;

    setSegments((prev) => {
      const copy = [...prev];
      const item = copy.splice(index, 1)[0];
      copy.splice(targetIndex, 0, item);
      return copy;
    });
  };

  const deleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const setSpeed = (id: string, speed: 0.25 | 0.5 | 1 | 2) => {
    setSegments((prev) =>
      prev.map((s) => (s.id === id ? { ...s, speed } : s))
    );
  };

  // Drag and drop
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

    setSegments((prev) => {
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

  const handleClearAll = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3500);
      return;
    }
    setSegments([]);
    setConfirmClear(false);
  };

  if (segments.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
          <Film className="w-6 h-6 stroke-[1.5]" />
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-semibold text-slate-700">尚未加入任何片段</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            在上方播放器拖動時間軸，按下「設為起點 (快捷鍵 I)」與「設為終點 (快捷鍵 O)」，再點擊「加入片段」。
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
      {/* Header toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <span>片段擷取列表</span>
            <span className="text-xs font-mono font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/50">
              共 {segments.length} 個片段
            </span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearAll}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1 ${
              confirmClear
                ? 'bg-rose-600 text-white font-semibold shadow-xs animate-pulse'
                : 'hover:bg-rose-50 text-rose-600 border border-transparent'
            }`}
          >
            {confirmClear ? (
              <>
                <AlertCircle className="w-3.5 h-3.5" />
                <span>確定清空所有片段？</span>
              </>
            ) : (
              <span>清空列表</span>
            )}
          </button>
        </div>
      </div>

      {/* Overlap Global Notice (Requirement 8) */}
      {anyOverlap && (
        <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300/80 text-amber-900 flex items-start gap-2.5 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-amber-950">區間重疊提示</p>
            <p className="text-amber-800 leading-relaxed">
              列表中有部分片段的時間範圍相互重疊。輸出時將依照列表由上至下的順序依序串接所有片段。
            </p>
          </div>
        </div>
      )}

      {/* Segments List Cards */}
      <div className="space-y-2.5">
        {segments.map((seg, index) => {
          const rawDuration = Math.max(0.01, seg.endTime - seg.startTime);
          const outputDuration = rawDuration / (seg.speed || 1);
          const isOverlapping = isSegmentOverlapping(seg, segments);
          const isOver = dragOverIndex === index;
          const isDragging = draggedIndex === index;

          return (
            <div
              key={seg.id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              className={`group rounded-xl border p-3 bg-slate-50/70 hover:bg-white transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 ${
                isOver
                  ? 'border-indigo-500 ring-2 ring-indigo-400 bg-indigo-50/40 shadow-sm'
                  : 'border-slate-200 hover:border-slate-300'
              } ${isDragging ? 'opacity-30' : ''}`}
            >
              {/* Left Zone: Drag handle + Index + Thumbnail + Timestamp Info */}
              <div className="flex items-center gap-3">
                {/* Drag Handle */}
                <div
                  className="cursor-grab active:cursor-grabbing p-1 text-slate-400 hover:text-slate-700 shrink-0"
                  title="按住拖曳以改變片段順序"
                >
                  <GripVertical className="w-4 h-4" />
                </div>

                {/* Index badge */}
                <span className="w-6 text-center font-mono text-xs font-bold text-slate-600 shrink-0">
                  #{index + 1}
                </span>

                {/* Thumbnail (Click to seek) */}
                <div
                  onClick={() => onSeekToTime(seg.startTime)}
                  className="relative w-24 h-15 rounded-lg overflow-hidden bg-slate-900 border border-slate-200 shrink-0 cursor-pointer group/thumb shadow-xs"
                  title="點擊跳轉至此片段起點"
                >
                  {seg.thumbnailUrl ? (
                    <img
                      src={seg.thumbnailUrl}
                      alt={`Segment ${index + 1}`}
                      className="w-full h-full object-cover transition-transform group-hover/thumb:scale-105"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-500 text-3xs">
                      無縮圖
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/20 group-hover/thumb:bg-black/0 transition-colors flex items-center justify-center">
                    <Play className="w-4 h-4 text-white drop-shadow-md opacity-80 group-hover/thumb:scale-110 transition-transform" />
                  </div>
                </div>

                {/* Time & Duration description */}
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-800">
                      {formatTime(seg.startTime)} ~ {formatTime(seg.endTime)}
                    </span>
                    {isOverlapping && (
                      <span className="px-1.5 py-0.5 rounded text-3xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        區間重疊
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-2xs text-slate-500 font-mono">
                    <span>原長度: {rawDuration.toFixed(2)}s</span>
                    <span>·</span>
                    <span className="text-indigo-600 font-semibold">
                      輸出長度: {outputDuration.toFixed(2)}s
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Zone: Speed selector & Action buttons */}
              <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200/60">
                {/* Speed buttons (Requirement 6) */}
                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-2xs font-semibold">
                  {([0.25, 0.5, 1, 2] as const).map((spd) => (
                    <button
                      key={spd}
                      type="button"
                      onClick={() => setSpeed(seg.id, spd)}
                      className={`px-2 py-1 rounded-lg transition-all cursor-pointer ${
                        seg.speed === spd
                          ? 'bg-indigo-600 text-white shadow-2xs font-bold'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                      title={`設定此片段為 ${spd} 倍速播放`}
                    >
                      {spd}x
                    </button>
                  ))}
                </div>

                {/* Move Up / Down */}
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => moveSegment(index, 'up')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="向上移 1 位"
                  >
                    <MoveUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === segments.length - 1}
                    onClick={() => moveSegment(index, 'down')}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title="向下移 1 位"
                  >
                    <MoveDown className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Delete */}
                <button
                  type="button"
                  onClick={() => deleteSegment(seg.id)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                  title="刪除此片段"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
