'use client';

import React, { createContext, useContext, useCallback, useState, useEffect } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-600 border-emerald-400',
  error:   'bg-red-600 border-red-400',
  warning: 'bg-amber-500 border-amber-300',
  info:    'bg-blue-600 border-blue-400',
};

const TYPE_ICONS: Record<ToastType, string> = {
  success: '✓',
  error:   '✕',
  warning: '⚠',
  info:    'ℹ',
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border text-white text-sm shadow-xl
                  min-w-[260px] max-w-[380px] animate-slide-in ${TYPE_STYLES[toast.type]}`}
      role="alert"
    >
      <span className="font-bold text-base leading-none mt-0.5">{TYPE_ICONS[toast.type]}</span>
      <span className="flex-1 leading-snug" dir="auto">{toast.message}</span>
      <button
        onClick={onDismiss}
        className="opacity-70 hover:opacity-100 transition-opacity text-lg leading-none"
        aria-label="إغلاق"
      >
        ×
      </button>
    </div>
  );
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast portal — fixed top-right, RTL-aware */}
      <div
        className="fixed top-4 left-4 z-[9999] flex flex-col gap-2"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map(t => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
