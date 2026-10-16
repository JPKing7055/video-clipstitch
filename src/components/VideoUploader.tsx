import React, { useRef, useState, DragEvent, ChangeEvent } from 'react';
import { Upload, Film, AlertCircle, Sparkles, Loader2 } from 'lucide-react';
import { createSampleVideoBlob } from '../utils/sampleVideo';

interface VideoUploaderProps {
  onVideoLoaded: (file: File | Blob, name: string) => void;
  isLoadingSample?: boolean;
  setIsLoadingSample?: (loading: boolean) => void;
}

export const VideoUploader: React.FC<VideoUploaderProps> = ({
  onVideoLoaded,
  isLoadingSample,
  setIsLoadingSample,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const supportedTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v'];

  const validateAndProcessFile = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isSupportedExt = ['mp4', 'webm', 'mov', 'm4v'].includes(ext || '');

    if (!supportedTypes.includes(file.type) && !isSupportedExt) {
      setErrorMessage('不支援的檔案格式，請上傳 MP4、WebM 或 MOV 影片檔。');
      return;
    }

    if (file.size === 0) {
      setErrorMessage('所選取的影片檔案大小為 0，請選擇有效的影片。');
      return;
    }

    onVideoLoaded(file, file.name);
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcessFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcessFile(e.target.files[0]);
    }
  };

  const handleLoadSample = async () => {
    try {
      setErrorMessage(null);
      setIsLoadingSample?.(true);
      const sampleBlob = await createSampleVideoBlob();
      onVideoLoaded(sampleBlob, 'sample_animation.webm');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '載入範例影片失敗';
      setErrorMessage(`範例影片生成失敗: ${msg}`);
    } finally {
      setIsLoadingSample?.(false);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-2xl p-8 sm:p-12 text-center cursor-pointer transition-all duration-200 group ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50/70 scale-[0.99]'
            : 'border-slate-300 hover:border-indigo-400 bg-slate-50/50 hover:bg-slate-50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime,video/x-m4v,.mp4,.webm,.mov"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center max-w-md mx-auto space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center transition-transform group-hover:scale-105 shadow-sm">
            <Upload className="w-8 h-8 stroke-[1.75]" />
          </div>

          <div className="space-y-1">
            <h3 className="text-lg font-medium text-slate-800">
              點擊此處或拖曳影片檔至此
            </h3>
            <p className="text-sm text-slate-500">
              支援 MP4、WebM、MOV 格式 · 完全本機處理，無檔案外傳
            </p>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              className="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 shadow-sm transition-all"
            >
              選擇本機影片
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleLoadSample();
              }}
              disabled={isLoadingSample}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-indigo-200 bg-white hover:bg-indigo-50/60 text-indigo-700 text-sm font-medium shadow-2xs transition-all disabled:opacity-60"
            >
              {isLoadingSample ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>生成範例中...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-indigo-500" />
                  <span>試用範例動畫影片</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div className="mt-4 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 flex items-start gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-500 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">影片載入失敗</p>
            <p className="text-rose-600 mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}
    </div>
  );
};
