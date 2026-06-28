'use client';
/**
 * ElectronTitleBar — شريط عنوان مخصص يظهر فقط داخل تطبيق Electron
 * يحل محل شريط ويندوز الافتراضي — يعطي مظهر تطبيق احترافي
 */
import { Minus, Square, X } from 'lucide-react';

export default function ElectronTitleBar({ title = 'DSF Gateway' }: { title?: string }) {
  // لا يظهر إذا كان في المتصفح
  if (typeof window === 'undefined' || !(window as any).electronAPI) return null;

  const api = (window as any).electronAPI;

  return (
    <div
      className="flex items-center justify-between select-none bg-[#0d0d14] border-b border-white/5"
      style={{ height: 36, WebkitAppRegion: 'drag' } as any}
    >
      {/* الشعار + الاسم */}
      <div className="flex items-center gap-2 px-4">
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600" />
        <span className="text-[11px] font-semibold text-white/60 tracking-widest uppercase">
          {title}
        </span>
      </div>

      {/* أزرار التحكم */}
      <div
        className="flex items-center h-full"
        style={{ WebkitAppRegion: 'no-drag' } as any}
      >
        <button
          onClick={() => api.minimize()}
          className="flex items-center justify-center w-10 h-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="تصغير"
        >
          <Minus className="w-3 h-3" />
        </button>
        <button
          onClick={() => api.maximize()}
          className="flex items-center justify-center w-10 h-full text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          title="تكبير"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => api.close()}
          className="flex items-center justify-center w-10 h-full text-white/40 hover:text-red-400 hover:bg-red-500/20 transition-colors"
          title="إغلاق"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
