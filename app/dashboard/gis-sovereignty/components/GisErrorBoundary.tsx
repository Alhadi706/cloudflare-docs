'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
};

export class GisErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('[GIS] page crash guarded by boundary', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-slate-950 text-slate-200">
          <div className="max-w-md text-center border border-slate-700 rounded-xl p-6 bg-slate-900/80">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">{this.props.title ?? 'تعذر عرض صفحة GIS'}</h3>
            <p className="text-sm text-slate-400 mb-4">حصل خطأ غير متوقع. تمت حماية الواجهة من الانهيار الكامل.</p>
            <button
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
              onClick={() => window.location.reload()}
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
