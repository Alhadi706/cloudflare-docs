'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { Brain, RefreshCw } from 'lucide-react';

const CommandCenter = dynamic(
  () => import('./CommandCenter'),
  {
    ssr: false,
    loading: () => (
      <div className="fixed inset-0 bg-[#050c14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 w-16 h-16 rounded-full border border-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 w-12 h-12 rounded-full border border-cyan-500/40 animate-ping [animation-delay:200ms]" />
            <div className="relative w-16 h-16 flex items-center justify-center">
              <Brain className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
          <div className="text-xs font-mono tracking-[0.3em] text-cyan-500/70 uppercase animate-pulse">
            MINERVA COMMAND CENTER
          </div>
          <div className="text-[10px] font-mono text-gray-700 tracking-widest">
            INITIALIZING...
          </div>
        </div>
      </div>
    ),
  }
);

export default function MINERVACommandPage() {
  return <CommandCenter />;
}
