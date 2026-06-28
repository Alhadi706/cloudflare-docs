'use client';

import { useState } from 'react';
import { ArrowRight, Copy, Check, RefreshCw, Trash2 } from 'lucide-react';

export default function DevTools() {
  const [storageItems, setStorageItems] = useState<[string, string][]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const loadStorage = () => {
    if (typeof window === 'undefined') return;
    
    const items = Object.entries(localStorage).filter(
      ([key]) => !key.startsWith('_next')
    );
    setStorageItems(items);
    setLoaded(true);
  };

  const copyValue = (value: string) => {
    navigator.clipboard.writeText(value);
    setCopied(value);
    setTimeout(() => setCopied(null), 2000);
  };

  const clearStorage = () => {
    if (confirm('هل أنت متأكد؟ سيتم حذف جميع بيانات التطبيق المحلية')) {
      localStorage.clear();
      setStorageItems([]);
    }
  };

  const clearKey = (key: string) => {
    localStorage.removeItem(key);
    setStorageItems(storageItems.filter(([k]) => k !== key));
  };

  return (
    <div className="min-h-screen bg-slate-950 p-6 space-y-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl font-bold text-white">Developer Tools</h1>
          <p className="text-slate-400">Local Storage Inspector • Cookies • Debug</p>
        </div>

        {/* Storage Inspector */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Local Storage</h2>
            <div className="flex gap-2">
              <button
                onClick={loadStorage}
                className="px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                تحديث
              </button>
              <button
                onClick={clearStorage}
                disabled={storageItems.length === 0}
                className="px-3 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg text-white text-sm flex items-center gap-2 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                حذف الكل
              </button>
            </div>
          </div>

          {!loaded ? (
            <button
              onClick={loadStorage}
              className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold transition-colors"
            >
              تحميل Local Storage
            </button>
          ) : storageItems.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              لا توجد عناصر في Local Storage
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {storageItems.map(([key, value]) => (
                <div
                  key={key}
                  className="bg-slate-700/30 border border-slate-600 rounded-lg p-3 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <code className="text-sm font-mono text-amber-300">{key}</code>
                    <button
                      onClick={() => clearKey(key)}
                      className="p-1 hover:bg-red-600/20 rounded transition-colors text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-slate-900/50 px-2 py-1 rounded text-xs font-mono text-slate-300 break-all overflow-auto">
                      {value.length > 100 ? value.substring(0, 100) + '...' : value}
                    </code>
                    <button
                      onClick={() => copyValue(value)}
                      className="p-1 hover:bg-slate-600 rounded transition-colors"
                    >
                      {copied === value ? (
                        <Check className="w-4 h-4 text-green-400" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-6">
          <button
            onClick={() => {
              const scope = prompt('أدخل الـ scope (مثل: maintenance)');
              if (scope) {
                localStorage.setItem('app_scope', scope);
                localStorage.setItem('launch_app', scope);
                loadStorage();
              }
            }}
            className="p-3 bg-green-600/20 hover:bg-green-600/30 border border-green-600 rounded-lg text-green-400 text-sm font-semibold transition-colors"
          >
            تعيين Scope
          </button>

          <button
            onClick={() => {
              const token = prompt('أدخل token:');
              if (token) {
                localStorage.setItem('auth_token', token);
                loadStorage();
              }
            }}
            className="p-3 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-600 rounded-lg text-blue-400 text-sm font-semibold transition-colors"
          >
            تعيين Token
          </button>

          <button
            onClick={() => {
              window.location.href = '/dashboard/admin-gateway/maintenance';
            }}
            className="p-3 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-600 rounded-lg text-purple-400 text-sm font-semibold transition-colors flex items-center justify-center gap-1"
          >
            <ArrowRight className="w-4 h-4" />
            اذهب للـ Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
