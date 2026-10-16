import React, { useState } from 'react';
import {
  X,
  Download,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  FileCheck,
  Film,
  Info,
} from 'lucide-react';
import { ExportResult } from '../types';
import { formatBytes } from '../utils/formatters';

interface ExportResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  isGenerating: boolean;
  generatingFormat: 'gif' | 'mp4';
  progress: {
    percent: number;
    currentFrame: number;
    totalFrames: number;
    message: string;
  };
  onCancel: () => void;
  result: ExportResult | null;
  videoFileName?: string;
}

export const ExportResultModal: React.FC<ExportResultModalProps> = ({
  isOpen,
  onClose,
  isGenerating,
  generatingFormat,
  progress,
  onCancel,
  result,
  videoFileName = 'video',
}) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    if (!result) return;
    const baseName = videoFileName.replace(/\.[^/.]+$/, '');
    const ext = result.format;
    const a = document.createElement('a');
    a.href = result.url;
    a.download = `${baseName}_${ext}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCopy = async () => {
    if (!result) return;
    try {
      if (result.format === 'gif' && navigator.clipboard && 'write' in navigator.clipboard) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'image/gif': result.blob,
          }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const isOver10Mb = result ? result.sizeBytes > 10 * 1024 * 1024 : false;

  const formatLabel =
    result?.format === 'mp4'
      ? 'MP4 影片 (H.264)'
      : result?.format === 'webm'
      ? 'WebM 影片'
      : 'GIF 動畫';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-xl w-full overflow-hidden shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {isGenerating ? (
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            ) : (
              <FileCheck className="w-5 h-5 text-emerald-600" />
            )}
            <h3 className="text-base font-semibold text-slate-800">
              {isGenerating
                ? generatingFormat === 'mp4'
                  ? '正在透過 WebCodecs 編碼 MP4...'
                  : '正在由 Web Worker 編碼 GIF...'
                : `${formatLabel} 製作完成！`}
            </h3>
          </div>

          {!isGenerating && (
            <button
              onClick={onClose}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* While Generating */}
          {isGenerating && (
            <div className="space-y-4 py-4 text-center">
              <div className="space-y-1">
                <p className="text-sm font-medium text-slate-700">
                  {progress.message || '正在處理...'}
                </p>
                <p className="text-xs text-slate-400">
                  {generatingFormat === 'mp4'
                    ? '使用 WebCodecs VideoEncoder 硬體加速與 mp4-muxer 本機封裝'
                    : '使用背景 Web Worker 進行調色盤量化與 LZW 編碼，介面不卡頓'}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 max-w-md mx-auto">
                <div className="flex justify-between text-xs font-mono text-slate-600">
                  <span>進度</span>
                  <span className="font-semibold text-indigo-600">
                    {progress.percent}%
                  </span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-violet-600 transition-all duration-200 rounded-full"
                    style={{ width: `${progress.percent}%` }}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={onCancel}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  取消製作
                </button>
              </div>
            </div>
          )}

          {/* Finished Result */}
          {!isGenerating && result && (
            <div className="space-y-4">
              {/* Fallback Notice if WebM was used */}
              {result.fallbackNotice && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
                  <Info className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>
                    <p className="font-semibold text-amber-900">相容性降級通知</p>
                    <p className="text-amber-800 mt-0.5">{result.fallbackNotice}</p>
                  </div>
                </div>
              )}

              {/* Media Preview Player */}
              <div className="relative aspect-video rounded-xl bg-slate-900 border border-slate-200 overflow-hidden flex items-center justify-center group shadow-inner">
                {result.format === 'gif' ? (
                  <img
                    src={result.url}
                    alt="Generated animated GIF"
                    className="max-h-full max-w-full object-contain"
                  />
                ) : (
                  <video
                    src={result.url}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="max-h-full max-w-full object-contain"
                  />
                )}
              </div>

              {/* Meta stats bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-2xs text-slate-500">檔案大小</div>
                  <div
                    className={`font-mono text-sm font-bold ${
                      isOver10Mb ? 'text-amber-600' : 'text-slate-800'
                    }`}
                  >
                    {formatBytes(result.sizeBytes)}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-2xs text-slate-500">解析度</div>
                  <div className="font-mono text-sm font-bold text-slate-800">
                    {result.width} × {result.height}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-2xs text-slate-500">影格總數</div>
                  <div className="font-mono text-sm font-bold text-slate-800">
                    {result.frameCount} 格
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="text-2xs text-slate-500">影片時長</div>
                  <div className="font-mono text-sm font-bold text-slate-800">
                    {result.durationSec.toFixed(2)} 秒
                  </div>
                </div>
              </div>

              {/* 10MB Warning */}
              {isOver10Mb && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div className="space-y-0.5">
                    <p className="font-semibold text-amber-900">
                      檔案大小超過 10MB ({formatBytes(result.sizeBytes)})
                    </p>
                    <p className="text-amber-800">
                      若要上傳至社群或聊天軟體，建議返回調整將寬度調小，或調低位元率 (Bitrate)。
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-full sm:flex-1 py-3 px-5 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:scale-98 text-white text-sm font-semibold shadow-sm flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>
                    下載 {result.format.toUpperCase()} 檔案 (.{result.format})
                  </span>
                </button>

                {result.format === 'gif' && (
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    title="複製 GIF 至剪貼簿"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700 font-semibold">已複製！</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-slate-500" />
                        <span>複製到剪貼簿</span>
                      </>
                    )}
                  </button>
                )}

                <a
                  href={result.url}
                  target="_blank"
                  rel="noreferrer"
                  download={`${videoFileName.replace(/\.[^/.]+$/, '')}.${result.format}`}
                  className="w-full sm:w-auto py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center justify-center gap-2 transition-colors"
                  title="新分頁檢視"
                >
                  <ExternalLink className="w-4 h-4 text-slate-500" />
                  <span>新分頁開啟</span>
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
