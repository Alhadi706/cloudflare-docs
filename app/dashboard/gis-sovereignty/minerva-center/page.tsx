'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Brain, RefreshCw } from 'lucide-react';

const MINERVAShell = dynamic(
  () => import('./command/CommandCenter'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#050c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-full border border-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 w-12 h-12 rounded-full border border-cyan-500/40 animate-ping [animation-delay:200ms]" />
            <Brain className="relative w-8 h-8 text-cyan-400 m-4" />
          </div>
          <span className="text-xs font-mono tracking-[0.3em] text-cyan-500/70 uppercase animate-pulse">
            MINERVA COMMAND CENTER
          </span>
        </div>
      </div>
    ),
  }
);

/** Error boundary isolated for MINERVA — does NOT trigger GIS error boundary */
class MINERVAErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorMsg: string }
> {
  state = { hasError: false, errorMsg: '' };

  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errorMsg: msg };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex flex-col items-center justify-center bg-slate-950 gap-4" dir="rtl">
          <Brain className="w-12 h-12 text-slate-700" />
          <p className="text-slate-400 font-semibold">تعذّر تحميل مركز MINERVA</p>
          <p className="text-slate-600 text-xs font-mono max-w-sm text-center">{this.state.errorMsg}</p>
          <button
            onClick={() => this.setState({ hasError: false, errorMsg: '' })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 border border-blue-500/40 text-blue-300 rounded-xl text-sm hover:bg-blue-600/30 transition-all"
          >
            <RefreshCw className="w-4 h-4" /> إعادة المحاولة
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function MINERVACenterPage() {
  return (
    <MINERVAErrorBoundary>
      <MINERVAShell />
    </MINERVAErrorBoundary>
  );
}
