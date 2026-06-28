'use client';

/**
 * Phase 16 — Embedded Role-Based Assistant
 *
 * مساعد مُدمَج خفيف الوزن يُحقَن في كل وحدة من الواجهة.
 *
 * المبادئ:
 *  - نفس brain_gateway_internal الخلفي (POST /api/v1/ask)
 *  - لا منطق مستقل — يُحقن فقط سياق الدور
 *  - كشف تلقائي للدور من مسار الصفحة
 *  - زر عائم خفيف + لوحة محادثة جانبية
 *
 * الأدوار الثلاثة:
 *  engineering → وحدة GIS / مساحة العمل الهندسية
 *  financial   → الوحدة المالية (محاسبة، ميزانيات، إيرادات)
 *  admin       → البوابة الإدارية الشاملة
 */

import React, { useState, useRef, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { Bot, X, Send, Loader2, ChevronDown } from 'lucide-react';
import { workspaceApi } from '@/store/apiService';

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// إعدادات الأدوار
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export type AssistantRole = 'engineering' | 'financial' | 'hr' | 'admin' | 'generic';

interface RoleConfig {
  module: string;
  label: string;
  greeting: string;
  prompts: string[];
  accentColor: string;    // text + border color
  buttonBg: string;       // زر الإطلاق
  icon: string;
}

const ROLE_CONFIGS: Record<AssistantRole, RoleConfig> = {
  engineering: {
    module: 'gis',
    label: 'المساعد الهندسي',
    greeting: '🗺️ مرحباً! أنا المساعد الهندسي.\nيمكنك أن تسألني:',
    prompts: [
      'تحليل أصول المشروع',
      'تقرير حالة الطبقات',
      'عدد الأصول النشطة',
      'أعطني تقريراً مفصلاً',
    ],
    accentColor: 'text-emerald-400 border-emerald-500/40',
    buttonBg:    'bg-emerald-600 hover:bg-emerald-700',
    icon: '🗺️',
  },
  financial: {
    module: 'finance',
    label: 'المساعد المالي',
    greeting: '💰 مرحباً! أنا المساعد المالي.\nيمكنك أن تسألني:',
    prompts: [
      'تحليل الميزانية الحالية',
      'تقرير المصروفات',
      'حالة العقود المالية',
      'تقرير مالي مفصل',
    ],
    accentColor: 'text-amber-400 border-amber-500/40',
    buttonBg:    'bg-amber-600 hover:bg-amber-700',
    icon: '💰',
  },
  hr: {
    module: 'hr',
    label: 'مساعد الموارد البشرية',
    greeting: '👥 مرحباً! أنا مساعد الموارد البشرية.\nيمكنك أن تسألني:',
    prompts: [
      'إجمالي عدد الموظفين',
      'تقرير الحضور',
      'حالة الإجازات',
      'تقرير الموارد البشرية',
    ],
    accentColor: 'text-blue-400 border-blue-500/40',
    buttonBg:    'bg-blue-600 hover:bg-blue-700',
    icon: '👥',
  },
  admin: {
    module: 'admin',
    label: 'المساعد الإداري',
    greeting: '⚙️ مرحباً! أنا المساعد الإداري الشامل.\nيمكنك أن تسألني:',
    prompts: [
      'نظرة عامة على المنظومة',
      'متابعة المهام المعلقة',
      'تقرير شامل للنظام',
      'حالة المشاريع الكلية',
    ],
    accentColor: 'text-purple-400 border-purple-500/40',
    buttonBg:    'bg-purple-600 hover:bg-purple-700',
    icon: '⚙️',
  },
  generic: {
    module: 'general',
    label: 'المساعد الذكي',
    greeting: '👋 مرحباً! كيف يمكنني مساعدتك؟',
    prompts: ['ما الذي يمكنك فعله؟', 'أحتاج مساعدة'],
    accentColor: 'text-slate-400 border-slate-500/40',
    buttonBg:    'bg-slate-600 hover:bg-slate-700',
    icon: '🤖',
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// كشف الدور من مسار الصفحة
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function detectRole(pathname: string): AssistantRole {
  if (
    pathname.includes('gis-sovereignty') ||
    pathname.includes('engineering-workspace') ||
    pathname.includes('spatial-analytics') ||
    pathname.includes('satellite-monitor')
  ) return 'engineering';

  if (
    pathname.includes('/finance') ||
    pathname.includes('/accounting') ||
    pathname.includes('/revenue') ||
    pathname.includes('/procurement') ||
    pathname.includes('/inventory') ||
    pathname.includes('/contracts')
  ) return 'financial';

  if (
    pathname.includes('/hr') ||
    pathname.includes('/employees')
  ) return 'hr';

  if (
    pathname.includes('admin-gateway') ||
    pathname.includes('admin-control') ||
    pathname.includes('command-center')
  ) return 'admin';

  return 'generic';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Message type
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

interface Msg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Props
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface EmbeddedAssistantProps {
  /** تجاوز كشف الدور التلقائي (اختياري). */
  forceRole?: AssistantRole;
  /** وضع التقرير — short أو detailed. */
  reportMode?: 'short' | 'detailed';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// المكوِّن الرئيسي
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function EmbeddedAssistant({
  forceRole,
  reportMode = 'short',
}: EmbeddedAssistantProps) {
  const pathname = usePathname() ?? '';
  const role = forceRole ?? detectRole(pathname);
  const cfg  = ROLE_CONFIGS[role];

  const [open, setOpen]     = useState(false);
  const [input, setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [msgs, setMsgs]     = useState<Msg[]>([
    { id: 'init', role: 'assistant', content: cfg.greeting },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textRef   = useRef<HTMLTextAreaElement>(null);

  // تمرير تلقائي للأسفل
  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgs, open]);

  // تركيز تلقائي عند الفتح
  useEffect(() => {
    if (open) setTimeout(() => textRef.current?.focus(), 100);
  }, [open]);

  // ─── إرسال السؤال ────────────────────────────────────────────
  const send = async (question: string) => {
    if (!question.trim() || loading) return;

    setMsgs(prev => [...prev, { id: Date.now().toString(), role: 'user', content: question }]);
    setInput('');
    setLoading(true);

    try {
      const result = await workspaceApi.askOrchestrator(question, {
        module:      cfg.module,
        page:        pathname,
        role:        role,
        report_mode: reportMode,
      });

      setMsgs(prev => [
        ...prev,
        {
          id:      (Date.now() + 1).toString(),
          role:    'assistant',
          content: result.response || 'لا يوجد رد',
        },
      ]);
    } catch {
      setMsgs(prev => [
        ...prev,
        {
          id:      'err_' + Date.now(),
          role:    'assistant',
          content: '⚠️ تعذّر الاتصال بالدماغ. تحقق من الخادم.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // ─── الألوان المشتقة ─────────────────────────────────────────
  const accentText   = cfg.accentColor.split(' ')[0]; // e.g. text-amber-400
  const accentBorder = cfg.accentColor.split(' ')[1]; // e.g. border-amber-500/40

  // ─── العرض ───────────────────────────────────────────────────
  return (
    <>
      {/* ── لوحة المحادثة ──────────────────────────────────── */}
      {open && (
        <div
          dir="rtl"
          className="fixed bottom-24 right-6 z-50 w-80 max-h-[540px] flex flex-col
                     bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
        >
          {/* رأس اللوحة */}
          <div
            className={`flex items-center justify-between px-4 py-3 border-b ${accentBorder}
                        bg-slate-950`}
          >
            <span className={`font-semibold text-sm ${accentText}`}>
              {cfg.icon} {cfg.label}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-white transition-colors"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </div>

          {/* الرسائل */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
            {msgs.map(m => (
              <div
                key={m.id}
                className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
              >
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap
                              break-words leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-800 text-slate-200 border border-slate-700'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-end">
                <div className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                                flex items-center gap-2">
                  <Loader2 className="w-3 h-3 animate-spin text-purple-400" />
                  <span className="text-xs text-slate-400">جاري التفكير…</span>
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* اقتراحات سريعة — تظهر فقط في بداية المحادثة */}
          {msgs.length <= 2 && (
            <div className="px-3 pb-2 flex flex-wrap gap-1">
              {cfg.prompts.map(p => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  disabled={loading}
                  className="text-xs bg-slate-800 hover:bg-slate-700 border border-slate-700
                             text-slate-300 rounded-lg px-2 py-1 transition-colors
                             disabled:opacity-50"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* صندوق الإدخال */}
          <div className="p-3 border-t border-slate-800 bg-slate-950 flex gap-2 shrink-0">
            <textarea
              ref={textRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              placeholder="اكتب سؤالك… (Enter للإرسال)"
              rows={2}
              disabled={loading}
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2
                         text-sm text-slate-200 placeholder-slate-500 resize-none
                         focus:outline-none focus:ring-1 focus:ring-purple-500/50"
            />
            <button
              onClick={() => send(input)}
              disabled={loading || !input.trim()}
              className="shrink-0 self-end w-9 h-9 bg-indigo-600 hover:bg-indigo-700
                         rounded-xl flex items-center justify-center transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="إرسال"
            >
              {loading
                ? <Loader2 size={14} className="text-white animate-spin" />
                : <Send size={14} className="text-white" />
              }
            </button>
          </div>
        </div>
      )}

      {/* ── زر الإطلاق العائم ──────────────────────────────── */}
      <button
        onClick={() => setOpen(v => !v)}
        className={`fixed bottom-6 right-6 z-50 w-14 h-14 ${cfg.buttonBg}
                    rounded-full shadow-xl flex items-center justify-center
                    transition-all hover:scale-105 active:scale-95`}
        title={cfg.label}
        aria-label={cfg.label}
      >
        {open
          ? <ChevronDown size={22} className="text-white" />
          : <Bot        size={22} className="text-white" />
        }
      </button>
    </>
  );
}
