'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Send, Brain, Loader2, User, Sparkles } from 'lucide-react';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface Message {
  role: 'user' | 'brain';
  text: string;
  ms?: number;
  intent?: string;
  source?: string;
}

interface BrainChatModalProps {
  open: boolean;
  onClose: () => void;
}

const SUGGESTIONS = [
  'كم عدد الموظفين؟',
  'اعرض قائمة المشاريع',
  'افتح أمر صيانة للمضخة الرئيسية',
  'ما هي الأصول المتاحة؟',
  'كم عدد الأقسام؟',
];

export default function BrainChatModal({ open, onClose }: BrainChatModalProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      if (messages.length === 0) {
        setMessages([{
          role: 'brain',
          text: 'مرحباً! أنا **العقل الرقمي**.\n\nاسألني عن الموظفين، المشاريع، الأصول، أو أعطني أمراً للتنفيذ مثل فتح أمر صيانة.',
        }]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (question: string) => {
    const q = question.trim();
    if (!q || loading) return;

    setMessages(prev => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/v1/brain-v2', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getClientTenantHeaders(),
          'X-User-Role': 'tenant_admin',
        },
        body: JSON.stringify({ question: q }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      setMessages(prev => [...prev, {
        role: 'brain',
        text: data.answer ?? 'لم أتلقَّ إجابة.',
        ms: data.metadata?.total_ms,
        intent: data.intent,
        source: data.source,
      }]);
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'brain',
        text: `❌ تعذّر الاتصال بالعقل الرقمي: ${err instanceof Error ? err.message : 'خطأ غير معروف'}`,
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="relative w-full max-w-2xl h-[80vh] max-h-[700px] bg-slate-900 border border-purple-500/30 rounded-2xl shadow-2xl shadow-purple-900/30 flex flex-col overflow-hidden">

        {/* ─── Header ─── */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-800 bg-slate-900/80 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Brain className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white">مركز العقل الرقمي</h2>
            <p className="text-xs text-slate-500">Brain V2 · محلي · سريع</p>
          </div>
          <button
            onClick={onClose}
            className="ml-auto p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ─── Messages ─── */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {msg.role === 'brain' && (
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0 mt-0.5">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                </div>
              )}
              <div className={`max-w-[80%] flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-tr-sm'
                      : 'bg-slate-800 text-slate-200 rounded-tl-sm border border-slate-700/50'
                  }`}
                  dir="auto"
                >
                  {msg.text}
                </div>
                {msg.role === 'brain' && (msg.ms || msg.intent) && (
                  <div className="flex gap-2 px-1">
                    {msg.intent && (
                      <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        {msg.intent}
                      </span>
                    )}
                    {msg.source && (
                      <span className="text-[10px] text-slate-600 bg-slate-800/50 px-1.5 py-0.5 rounded">
                        {msg.source}
                      </span>
                    )}
                    {msg.ms !== undefined && (
                      <span className="text-[10px] text-slate-600">
                        {msg.ms}ms
                      </span>
                    )}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 justify-start">
              <div className="w-7 h-7 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="bg-slate-800 border border-slate-700/50 px-4 py-3 rounded-2xl rounded-tl-sm flex items-center gap-2">
                <Loader2 className="w-4 h-4 text-purple-400 animate-spin" />
                <span className="text-sm text-slate-500">العقل يفكر...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ─── Suggestions ─── */}
        {messages.length <= 1 && (
          <div className="px-4 pb-3 flex gap-2 flex-wrap shrink-0">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="text-xs text-purple-300/80 bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 px-3 py-1.5 rounded-full transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* ─── Input ─── */}
        <div className="px-4 pb-4 pt-2 border-t border-slate-800 shrink-0">
          <div className="flex gap-2 bg-slate-800 border border-slate-700 rounded-xl overflow-hidden focus-within:border-purple-500/50 transition-colors">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="اسأل العقل الرقمي... (Enter للإرسال)"
              disabled={loading}
              dir="auto"
              className="flex-1 bg-transparent px-4 py-3 text-sm text-slate-200 placeholder-slate-600 outline-none disabled:opacity-50"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              className="px-4 m-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors flex items-center justify-center"
              aria-label="إرسال"
            >
              {loading
                ? <Loader2 className="w-4 h-4 text-white animate-spin" />
                : <Send className="w-4 h-4 text-white" />
              }
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
