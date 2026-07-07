'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

type Props = {
  children: React.ReactNode;
  title?: string;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export class GisErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: unknown): State {
    const msg = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { hasError: true, errorMessage: msg };
  }

  componentDidCatch(error: unknown) {
    console.error('[GIS] page crash guarded by boundary', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-full w-full flex items-center justify-center bg-slate-950 text-slate-200">
          <div className="max-w-lg text-center border border-slate-700 rounded-xl p-6 bg-slate-900/80">
            <AlertTriangle className="w-8 h-8 text-amber-400 mx-auto mb-3" />
            <h3 className="text-lg font-bold mb-2">{this.props.title ?? 'تعذر عرض صفحة GIS'}</h3>
            <p className="text-sm text-slate-400 mb-2">حصل خطأ غير متوقع. تمت حماية الواجهة من الانهيار الكامل.</p>
            {this.state.errorMessage && (
              <pre className="text-xs text-rose-300 bg-slate-800 rounded-lg px-3 py-2 mb-4 text-left overflow-auto max-h-24 whitespace-pre-wrap">
                {this.state.errorMessage}
              </pre>
            )}
            <button
              className="px-4 py-2 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-sm"
              onClick={() => this.setState({ hasError: false, errorMessage: undefined })}
            >
              إعادة المحاولة
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
