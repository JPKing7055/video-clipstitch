import React from 'react';
import { Film, ShieldCheck, RefreshCw } from 'lucide-react';

interface HeaderProps {
  onReset?: () => void;
  hasVideo?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ onReset, hasVideo }) => {
  return (
    <header className="border-b border-slate-200 bg-white/90 backdrop-blur-md sticky top-0 z-40 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
        {/* Brand Zone */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200">
            <Film className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold text-slate-900 tracking-tight flex items-center gap-2">
              <span>影片轉 GIF 動畫工具</span>
            </h1>
            <p className="text-xs text-slate-500 hidden sm:block">
              純本機影格擷取與 Web Worker 高速編碼
            </p>
          </div>
        </div>

        {/* Feature / Privacy Assurance */}
        <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50/80 border border-emerald-200/80 px-3 py-1.5 rounded-full shrink-0">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span className="hidden md:inline">100% 瀏覽器本機運算 · 影片不上傳伺服器</span>
          <span className="md:hidden">本機離線安全</span>
        </div>

        {/* Actions Zone */}
        {hasVideo && onReset && (
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200/80 rounded-lg transition-colors cursor-pointer shrink-0"
            title="更換或重置目前影片"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">更換影片</span>
          </button>
        )}
      </div>
    </header>
  );
};
