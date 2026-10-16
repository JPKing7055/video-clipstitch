import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Header } from './components/Header';
import { VideoUploader } from './components/VideoUploader';
import { VideoPlayer } from './components/VideoPlayer';
import { SegmentList } from './components/SegmentList';
import { OutputConfigPanel } from './components/OutputConfigPanel';
import { ExportResultModal } from './components/ExportResultModal';
import {
  VideoSegment,
  OutputConfig,
  ExportResult,
} from './types';
import { captureFrameFromVideo, seekVideo } from './utils/videoExtractor';
import { exportSegments, SegmentExportProgress } from './utils/segmentExporter';
import { AlertCircle } from 'lucide-react';

export default function App() {
  // Video State
  const [videoFile, setVideoFile] = useState<File | Blob | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoName, setVideoName] = useState<string>('');
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Segment Selection Range State (In / Out points)
  const [inPoint, setInPoint] = useState<number>(0);
  const [outPoint, setOutPoint] = useState<number>(3);

  // Saved Segments List
  const [segments, setSegments] = useState<VideoSegment[]>([]);

  // Output Config State (Requirement 10: default 480px, 15fps, MP4/GIF format)
  const [outputConfig, setOutputConfig] = useState<OutputConfig>({
    width: 480,
    fps: 15,
    format: 'mp4',
    bitrateMbps: 2.5,
    repeat: 0,
    maxColors: 256,
  });

  // Export & Progress State
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [exportProgress, setExportProgress] = useState<{
    percent: number;
    currentFrame: number;
    totalFrames: number;
    message: string;
  }>({
    percent: 0,
    currentFrame: 0,
    totalFrames: 0,
    message: '',
  });
  const [exportResult, setExportResult] = useState<ExportResult | null>(null);
  const [isExportModalOpen, setIsExportModalOpen] = useState<boolean>(false);
  const abortExportRef = useRef<(() => void) | null>(null);

  // UI feedback
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isLoadingSample, setIsLoadingSample] = useState<boolean>(false);

  // Handle Video Load
  const handleVideoLoaded = useCallback(
    (file: File | Blob, name: string) => {
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
      }
      const newUrl = URL.createObjectURL(file);
      setVideoFile(file);
      setVideoUrl(newUrl);
      setVideoName(name);
      setSegments([]);
      setCurrentTime(0);
      setDuration(0);
      setInPoint(0);
      setOutPoint(3);
      setExportResult(null);
      setErrorMessage(null);
    },
    [videoUrl]
  );

  // When duration loads, adjust out point default
  const handleDurationChange = (dur: number) => {
    const validDur = Number.isFinite(dur) && dur > 0 ? dur : 3;
    setDuration(validDur);
    setInPoint(0);
    setOutPoint(Number(Math.min(validDur, Math.max(0.5, 3)).toFixed(2)));
  };

  // Reset Video
  const handleResetVideo = () => {
    if (videoUrl) {
      URL.revokeObjectURL(videoUrl);
    }
    setVideoFile(null);
    setVideoUrl(null);
    setVideoName('');
    setSegments([]);
    setCurrentTime(0);
    setDuration(0);
    setExportResult(null);
  };

  // Add Segment from [inPoint, outPoint]
  const handleAddSegment = () => {
    const video = videoRef.current;
    if (!video) return;

    const start = Math.min(inPoint, outPoint);
    const end = Math.max(inPoint, outPoint);

    if (end - start < 0.05) {
      setErrorMessage('片段長度過短，請選取至少 0.05 秒的區間。');
      return;
    }

    try {
      // Capture thumbnail of the start frame
      const thumb = captureFrameFromVideo(video, start);

      const newSegment: VideoSegment = {
        id: `seg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        startTime: start,
        endTime: end,
        speed: 1, // default 1x
        thumbnailUrl: thumb.dataUrl,
      };

      setSegments((prev) => [...prev, newSegment]);
      setErrorMessage(null);

      // Advance inPoint to current end
      setInPoint(end);
      const nextOut = Math.min(duration || end + 3, end + 3);
      setOutPoint(Number(nextOut.toFixed(2)));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '加入片段失敗';
      setErrorMessage(msg);
    }
  };

  // Seek video from segment click
  const handleSeekToTime = async (time: number) => {
    const video = videoRef.current;
    if (!video) return;
    try {
      await seekVideo(video, time);
      setCurrentTime(time);
    } catch {}
  };

  // Start Export Concatenation
  const handleStartExport = async () => {
    const video = videoRef.current;
    if (!video || segments.length === 0) {
      setErrorMessage('請先加入至少 1 個片段！');
      return;
    }

    try {
      setIsExporting(true);
      setIsExportModalOpen(true);
      setExportResult(null);
      setErrorMessage(null);

      const { promise, abort } = exportSegments(
        video,
        segments,
        outputConfig,
        (prog: SegmentExportProgress) => {
          setExportProgress({
            percent: prog.percent,
            currentFrame: prog.currentFrame,
            totalFrames: prog.totalFrames,
            message: prog.message,
          });
        }
      );

      abortExportRef.current = abort;
      const result = await promise;
      setExportResult(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '輸出時發生錯誤';
      if (msg !== '已取消輸出') {
        setErrorMessage(`輸出失敗: ${msg}`);
      }
    } finally {
      setIsExporting(false);
      abortExportRef.current = null;
    }
  };

  const handleCancelExport = () => {
    if (abortExportRef.current) {
      abortExportRef.current();
    }
    setIsExporting(false);
    setIsExportModalOpen(false);
  };

  // Keyboard shortcut Space for play/pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.code === 'Space' && videoRef.current) {
        e.preventDefault();
        if (videoRef.current.paused) {
          videoRef.current.play().catch(() => {});
        } else {
          videoRef.current.pause();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 flex flex-col font-sans">
      {/* Top Header */}
      <Header onReset={handleResetVideo} hasVideo={!!videoUrl} />

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Error Notification */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start justify-between gap-3 shadow-xs">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-semibold">系統提示</p>
                <p className="text-rose-700 mt-0.5">{errorMessage}</p>
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-500 hover:text-rose-700 text-xs px-2 py-1 rounded-lg cursor-pointer"
            >
              關閉
            </button>
          </div>
        )}

        {/* View 1: When no video is loaded */}
        {!videoUrl ? (
          <div className="space-y-6">
            <div className="text-center max-w-2xl mx-auto space-y-2 py-4">
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
                本機影片多片段擷取 · 依序串接輸出 MP4 與 GIF
              </h2>
              <p className="text-sm sm:text-base text-slate-600">
                支援自訂起訖區間（快捷鍵 I / O）、時間軸色塊標示、片段循環預覽與獨立播放速度，全程本機高速輸出。
              </p>
            </div>

            <VideoUploader
              onVideoLoaded={handleVideoLoaded}
              isLoadingSample={isLoadingSample}
              setIsLoadingSample={setIsLoadingSample}
            />

            {/* Feature Highlights Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-sm">
                  1
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">
                  起訖標記與區間循環預覽
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  隨時拖動時間軸按 I 鍵設為起點、O 鍵設為終點，時間軸即時顯示選取色塊並支援循環播放預覽。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold text-sm">
                  2
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">
                  多片段拖曳排序與獨立倍速
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  各片段均可獨立設定 0.25x / 0.5x / 1x / 2x 速度，並自動進行時間區間重疊提醒。
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-sm">
                  3
                </div>
                <h3 className="font-semibold text-slate-800 text-sm">
                  流暢串接 MP4 / GIF 輸出
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  按列表順序嚴格等待 seeked 渲染，自動串接成 MP4 影片或 GIF 動畫，預設 480px 與 15fps。
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* View 2: Video loaded - Editing Workspace */
          <div className="space-y-6">
            {/* Top Workspace Grid: Video Player + Output Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Video Player with In/Out Controls (7 cols) */}
              <div className="lg:col-span-7 space-y-3">
                <VideoPlayer
                  videoRef={videoRef}
                  videoUrl={videoUrl}
                  videoName={videoName}
                  currentTime={currentTime}
                  duration={duration}
                  onTimeUpdate={setCurrentTime}
                  onDurationChange={handleDurationChange}
                  inPoint={inPoint}
                  outPoint={outPoint}
                  setInPoint={setInPoint}
                  setOutPoint={setOutPoint}
                  onAddSegment={handleAddSegment}
                  segments={segments}
                />
              </div>

              {/* Right Column: Output Settings (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <OutputConfigPanel
                  config={outputConfig}
                  setConfig={setOutputConfig}
                  segments={segments}
                  onStartExport={handleStartExport}
                  isExporting={isExporting}
                  videoNativeWidth={videoRef.current?.videoWidth || 640}
                  videoNativeHeight={videoRef.current?.videoHeight || 360}
                />
              </div>
            </div>

            {/* Bottom Section: Segments List & Management */}
            <SegmentList
              segments={segments}
              setSegments={setSegments}
              onSeekToTime={handleSeekToTime}
            />
          </div>
        )}
      </main>

      {/* Export / Progress Modal */}
      <ExportResultModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        isGenerating={isExporting}
        generatingFormat={outputConfig.format}
        progress={exportProgress}
        onCancel={handleCancelExport}
        result={exportResult}
        videoFileName={videoName}
      />

      {/* Footer */}
      <footer className="border-t border-slate-200/80 bg-white/70 py-4 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <span>影片多片段串接工具 · 純前端本機處理無伺服器</span>
          <div className="flex items-center gap-4">
            <span>支援 MP4 · WebM · MOV</span>
            <span>·</span>
            <span>預設寬度 480px / 幀率 15fps</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
