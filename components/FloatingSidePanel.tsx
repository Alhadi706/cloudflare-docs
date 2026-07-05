'use client';
/**
 * FloatingSidePanel — لوحة عائمة فوق الخريطة
 * ================================================
 * تُعرض على يسار الشاشة كـ overlay شفاف فوق الخريطة الحية.
 * الخريطة تبقى حية وتفاعلية خلف اللوحة.
 */

import React, { useEffect, useRef } from 'react';
import { X, PanelLeftClose, PanelLeftOpen } from 'lucide-react';

interface FloatingSidePanelProps {
  /** عنوان اللوحة — يظهر في الشريط العلوي */
  title: string;
  /** أيقونة اختيارية بجانب العنوان */
  icon?: React.ReactNode;
  /** المحتوى */
  children: React.ReactNode;
  /** دالة الإغلاق — اختيارية (تُخفي زر الإغلاق إذا لم تُحدَّد) */
  onClose?: () => void;
  /** عرض اللوحة — الافتراضي 440px */
  width?: number;
  /** السماح بزر التوسيع/التصغير */
  expandable?: boolean;
  /** z-index — الافتراضي 40 */
  zIndex?: number;
  /** محتوى إضافي في الشريط العلوي */
  headerExtra?: React.ReactNode;
}

export default function FloatingSidePanel({
  title,
  icon,
  children,
  onClose,
  width = 440,
  expandable = false,
  zIndex = 40,
  headerExtra,
}: FloatingSidePanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);
  const [customWidth, setCustomWidth] = React.useState<number>(width);
  const [isResizing, setIsResizing] = React.useState(false);

  const minPanelWidth = 320;
  const maxPanelWidth =
    typeof window !== 'undefined'
      ? Math.min(Math.floor(window.innerWidth * 0.75), 1300)
      : 980;

  useEffect(() => {
    setCustomWidth(width);
  }, [width]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const key = 'admin-gateway-panel-width';
    const saved = Number(window.localStorage.getItem(key));
    if (Number.isFinite(saved) && saved >= minPanelWidth) {
      setCustomWidth(Math.min(saved, maxPanelWidth));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('admin-gateway-panel-width', String(customWidth));
  }, [customWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const onMove = (e: MouseEvent) => {
      const next = Math.max(minPanelWidth, Math.min(e.clientX, maxPanelWidth));
      setCustomWidth(next);
      setIsExpanded(false);
    };

    const onUp = () => setIsResizing(false);

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, maxPanelWidth]);

  // Stop wheel events from propagating to map when scrolling inside panel
  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.stopPropagation();
    el.addEventListener('wheel', handler, { passive: true });
    return () => el.removeEventListener('wheel', handler);
  }, []);

  const compactWidth = `${customWidth}px`;
  const resolvedWidth = isExpanded ? 'min(75vw, 1300px)' : compactWidth;

  return (
    <div
      ref={panelRef}
      className="fixed left-0 flex flex-col pointer-events-auto"
      style={{
        top: '2.75rem',           /* 44px — below the dashboard top bar (h-11) */
        height: 'calc(100vh - 2.75rem)',
        width: resolvedWidth,
        transition: 'width 320ms cubic-bezier(0.22, 1, 0.36, 1)',
        zIndex,
        background: 'linear-gradient(160deg, rgba(15, 23, 42, 0.56), rgba(15, 23, 42, 0.34))',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        boxShadow: '6px 0 28px rgba(0,0,0,0.35)',
      }}
      dir="rtl"
    >
      {/* Resize handle */}
      <div
        onMouseDown={() => setIsResizing(true)}
        className="absolute -right-1 top-0 h-full w-2 cursor-col-resize z-20"
        title="اسحب لتغيير عرض اللوحة"
      >
        <div className="mx-auto h-full w-[2px] bg-white/10 hover:bg-cyan-300/80 transition-colors" />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-2 text-slate-100">
          {icon && <span className="text-blue-400">{icon}</span>}
          <h2 className="font-semibold text-sm tracking-wide">{title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {expandable && (
            <button
              type="button"
              onClick={() => setIsExpanded((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-300 hover:text-white transition-colors"
              title={isExpanded ? 'تصغير اللوحة' : 'توسيع اللوحة (حتى 75%)'}
              aria-label={isExpanded ? 'تصغير اللوحة' : 'توسيع اللوحة (حتى 75%)'}
            >
              {isExpanded ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
            </button>
          )}
          {headerExtra}
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-700/60 text-slate-400 hover:text-slate-200 transition-colors"
              title="إغلاق"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
        {children}
      </div>
    </div>
  );
}
