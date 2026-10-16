import React, { useRef, useState, useEffect } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  ChevronLeft,
  ChevronRight,
  Clock,
  Maximize2,
  BookmarkPlus,
  Repeat,
  Flag,
} from 'lucide-react';
import { VideoSegment } from '../types';
import { formatTime } from '../utils/formatters';

interface VideoPlayerProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  videoUrl: string;
  videoName: string;
  currentTime: number;
  duration: number;
  onTimeUpdate: (time: number) => void;
  onDurationChange: (dur: number) => void;
  inPoint: number;
  outPoint: number;
  setInPoint: (t: number) => void;
  setOutPoint: (t: number) => void;
  onAddSegment: () => void;
  segments: VideoSegment[];
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoRef,
  videoUrl,
  videoName,
  currentTime,
  duration,
  onTimeUpdate,
  onDurationChange,
  inPoint,
  outPoint,
  setInPoint,
  setOutPoint,
  onAddSegment,
  segments,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [isPreviewingRange, setIsPreviewingRange] = useState(false);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const progressBarRef = useRef<HTMLDivElement>(null);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPreviewingRange) {
      setIsPreviewingRange(false);
    }

    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const handleStep = (seconds: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.pause();
    setIsPlaying(false);
    setIsPreviewingRange(false);
    const newTime = Math.max(0, Math.min(duration || video.duration || 0, video.currentTime + seconds));
    video.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  const handleProgressBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !videoRef.current || !duration) return;
    setIsPreviewingRange(false);
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const ratio = clickX / rect.width;
    const newTime = ratio * duration;
    videoRef.current.currentTime = newTime;
    onTimeUpdate(newTime);
  };

  // Range preview loop handler
  const togglePreviewRange = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPreviewingRange) {
      video.pause();
      setIsPlaying(false);
      setIsPreviewingRange(false);
      return;
    }

    const start = Math.min(inPoint, outPoint);
    video.currentTime = start;
    video.play().catch(() => {});
    setIsPlaying(true);
    setIsPreviewingRange(true);
  };

  // Handle loop during range preview
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const time = e.currentTarget.currentTime;
    onTimeUpdate(time);

    if (isPreviewingRange) {
      const end = Math.max(inPoint, outPoint);
      const start = Math.min(inPoint, outPoint);
      if (time >= end || time < start) {
        e.currentTarget.currentTime = start;
        e.currentTarget.play().catch(() => {});
      }
    }
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  const handleFullscreen = () => {
    if (videoRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      } else {
        videoRef.current.requestFullscreen().catch(() => {});
      }
    }
  };

  // Keyboard shortcuts: I (In point), O (Out point)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key === 'i' || e.key === 'I') {
        e.preventDefault();
        setInPoint(Number(currentTime.toFixed(2)));
      } else if (e.key === 'o' || e.key === 'O') {
        e.preventDefault();
        setOutPoint(Number(currentTime.toFixed(2)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentTime, setInPoint, setOutPoint]);

  // Current selection span
  const currentSelectionStart = Math.min(inPoint, outPoint);
  const currentSelectionEnd = Math.max(inPoint, outPoint);
  const currentSelectionDuration = Math.max(0, currentSelectionEnd - currentSelectionStart);

  return (
    <div className="bg-slate-900 rounded-2xl overflow-hidden shadow-lg border border-slate-800 flex flex-col">
      {/* Top Video Header */}
      <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between text-xs text-slate-300">
        <span className="truncate max-w-[240px] sm:max-w-md font-medium text-slate-200">
          {videoName}
        </span>
        {videoDimensions.width > 0 && (
          <span className="font-mono text-slate-400 shrink-0">
            {videoDimensions.width} × {videoDimensions.height} px
          </span>
        )}
      </div>

      {/* Video Viewport */}
      <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
        <video
          ref={videoRef}
          src={videoUrl}
          playsInline
          muted={isMuted}
          crossOrigin="anonymous"
          onLoadedMetadata={(e) => {
            const vid = e.currentTarget;
            let dur = vid.duration;
            if (!Number.isFinite(dur) || dur === Infinity) {
              vid.currentTime = 1e101;
              vid.addEventListener(
                'timeupdate',
                () => {
                  vid.currentTime = 0;
                  const finalDur =
                    Number.isFinite(vid.duration) && vid.duration > 0 ? vid.duration : 3;
                  onDurationChange(finalDur);
                },
                { once: true }
              );
            } else {
              onDurationChange(dur || 0);
            }
            setVideoDimensions({
              width: vid.videoWidth,
              height: vid.videoHeight,
            });
          }}
          onTimeUpdate={handleTimeUpdate}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={() => {
            setIsPlaying(false);
            setIsPreviewingRange(false);
          }}
          onClick={togglePlay}
          className="max-h-full max-w-full object-contain cursor-pointer"
        />

        {/* Center overlay play button if paused */}
        {!isPlaying && (
          <button
            onClick={togglePlay}
            className="absolute w-14 h-14 rounded-full bg-indigo-600/90 text-white flex items-center justify-center shadow-xl backdrop-blur-xs hover:scale-105 active:scale-95 transition-all pointer-events-auto cursor-pointer"
            title="播放影片 (Space)"
          >
            <Play className="w-6 h-6 ml-0.5 fill-current" />
          </button>
        )}

        {/* Range preview active banner */}
        {isPreviewingRange && (
          <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-amber-500/90 text-white text-2xs font-semibold flex items-center gap-1.5 shadow-md">
            <Repeat className="w-3 h-3 animate-spin" />
            <span>循環預覽區間中...</span>
          </div>
        )}
      </div>

      {/* Timeline with Range Colored Highlights */}
      <div className="p-3 sm:p-4 bg-slate-900/95 flex flex-col gap-3">
        {/* Scrubber Bar Container */}
        <div className="space-y-1">
          <div
            ref={progressBarRef}
            onClick={handleProgressBarClick}
            className="relative h-3.5 w-full bg-slate-800 rounded-lg cursor-pointer transition-all group overflow-hidden border border-slate-700/60"
            title="點擊時間軸跳轉時間"
          >
            {/* 1. Saved Segments Colored Highlights */}
            {duration > 0 &&
              segments.map((seg, idx) => {
                const left = (seg.startTime / duration) * 100;
                const width = ((seg.endTime - seg.startTime) / duration) * 100;
                return (
                  <div
                    key={seg.id}
                    className="absolute top-0 bottom-0 bg-violet-600/40 border-l border-r border-violet-400/60 z-1"
                    style={{ left: `${left}%`, width: `${width}%` }}
                    title={`片段 #${idx + 1}: ${formatTime(seg.startTime)} ~ ${formatTime(seg.endTime)}`}
                  />
                );
              })}

            {/* 2. Currently Selected Range Block [inPoint, outPoint] */}
            {duration > 0 && currentSelectionDuration > 0 && (
              <div
                className="absolute top-0 bottom-0 bg-indigo-500/60 border-l-2 border-r-2 border-indigo-400 z-2 shadow-xs transition-none"
                style={{
                  left: `${(currentSelectionStart / duration) * 100}%`,
                  width: `${(currentSelectionDuration / duration) * 100}%`,
                }}
              />
            )}

            {/* 3. Progress fill up to currentTime */}
            <div
              className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 pointer-events-none transition-none"
              style={{
                width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            />

            {/* 4. Playhead scrubber thumb */}
            <div
              className="absolute top-0 bottom-0 w-1 bg-white shadow-md z-3 transition-none pointer-events-none -ml-0.5"
              style={{
                left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
              }}
            >
              <div className="w-2.5 h-2.5 rounded-full bg-white shadow-md -translate-x-0.75 -translate-y-0.5" />
            </div>
          </div>

          {/* Time markers and In/Out labels */}
          <div className="flex items-center justify-between text-2xs font-mono text-slate-400 px-0.5">
            <span className="flex items-center gap-1 text-slate-300">
              <Flag className="w-2.5 h-2.5 text-indigo-400" />
              <span>起: {formatTime(inPoint)}</span>
            </span>
            <span className="text-indigo-300 font-semibold">
              目前選取長度: {currentSelectionDuration.toFixed(2)}s
            </span>
            <span className="flex items-center gap-1 text-slate-300">
              <span>終: {formatTime(outPoint)}</span>
              <Flag className="w-2.5 h-2.5 text-indigo-400" />
            </span>
          </div>
        </div>

        {/* Primary Controls Row */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1 text-white">
          {/* Left: Playback & Step Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={togglePlay}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 transition-colors cursor-pointer"
              title={isPlaying ? '暫停 (Space)' : '播放 (Space)'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
            </button>

            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = 0;
                  onTimeUpdate(0);
                }
              }}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="回到開頭"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Frame stepping */}
            <div className="flex items-center bg-slate-800 rounded-lg p-0.5">
              <button
                onClick={() => handleStep(-0.04)}
                className="px-2 py-1.5 hover:bg-slate-700 rounded text-xs text-slate-300 hover:text-white flex items-center transition-colors cursor-pointer"
                title="後退 1 格 (-0.04s)"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                <span>-1格</span>
              </button>
              <span className="w-px h-4 bg-slate-700" />
              <button
                onClick={() => handleStep(0.04)}
                className="px-2 py-1.5 hover:bg-slate-700 rounded text-xs text-slate-300 hover:text-white flex items-center transition-colors cursor-pointer"
                title="前進 1 格 (+0.04s)"
              >
                <span>+1格</span>
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </button>
            </div>

            {/* Timecode */}
            <div className="flex items-center gap-1 font-mono text-xs sm:text-sm text-slate-200 pl-1.5">
              <Clock className="w-3.5 h-3.5 text-indigo-400 hidden sm:inline" />
              <span>{formatTime(currentTime)}</span>
              <span className="text-slate-500">/</span>
              <span className="text-slate-400">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Right: Audio & Fullscreen */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isMuted ? '開啟聲音' : '靜音'}
            >
              {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>

            <button
              onClick={handleFullscreen}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title="全螢幕預覽"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* SECTION 1: Segment Extraction Action Bar (Requirements 1, 2, 3) */}
        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {/* Mark In (快捷鍵 I) */}
            <button
              type="button"
              onClick={() => setInPoint(Number(currentTime.toFixed(2)))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-indigo-300 hover:text-white border border-indigo-500/40 transition-all cursor-pointer"
              title="將目前播放時間設為片段起點 (快捷鍵: I)"
            >
              <Flag className="w-3.5 h-3.5 text-indigo-400" />
              <span>設為起點 (I)</span>
            </button>

            {/* Mark Out (快捷鍵 O) */}
            <button
              type="button"
              onClick={() => setOutPoint(Number(currentTime.toFixed(2)))}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs font-semibold text-indigo-300 hover:text-white border border-indigo-500/40 transition-all cursor-pointer"
              title="將目前播放時間設為片段終點 (快捷鍵: O)"
            >
              <Flag className="w-3.5 h-3.5 text-indigo-400" />
              <span>設為終點 (O)</span>
            </button>

            {/* Preview Loop of range (Requirement 3) */}
            <button
              type="button"
              onClick={togglePreviewRange}
              disabled={currentSelectionDuration <= 0.05}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isPreviewingRange
                  ? 'bg-amber-500 text-slate-950 border-amber-400 font-bold'
                  : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
              }`}
              title="循環播放目前選取的起訖範圍"
            >
              <Repeat className={`w-3.5 h-3.5 ${isPreviewingRange ? 'animate-spin' : ''}`} />
              <span>{isPreviewingRange ? '停止預覽' : '預覽此區間'}</span>
            </button>
          </div>

          {/* Add Segment Action Button */}
          <button
            type="button"
            onClick={onAddSegment}
            disabled={currentSelectionDuration <= 0.05}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 active:scale-98 text-white text-xs font-bold shadow-md shadow-indigo-950 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="將此區段收錄到下方片段列表"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>加入片段 ({currentSelectionDuration.toFixed(2)}s)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
