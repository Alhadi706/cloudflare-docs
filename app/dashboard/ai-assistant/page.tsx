'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Sparkles, Loader2, Settings, ChevronDown, CheckCircle2, AlertCircle, FolderOpen, MapPin, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { 
  ContextMode, 
  detectContextFromRoute, 
  getContextGreeting, 
  buildContextPayload,
  saveContext,
  loadContext
} from '@/lib/aiContext';
import { aiAPI } from '@/lib/aiAPI';
import { useErpContextStore } from '@/store/erpContextStore';
import { useAIBridge } from '@/hooks/useAIBridge';
import { useOperationalContext } from '@/store/operationalContext';
import { getClientTenantHeaders } from '@/lib/getClientTenantId';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: string;
  confidence?: number;
  mapActions?: Array<{ type: string; params?: Record<string, any> }>;
  metadata?: Record<string, any>;
  // Sprint 0: BrainResponse fields
  source?: string;
  evidence?: Array<Record<string, any>>;
  entities?: Array<{ type: string; id?: string; name?: string; [key: string]: any }>;
  actions?: Array<{ type: string; label: string; policy: 'auto' | 'approval' | 'blocked'; payload?: Record<string, any> }>;
  alerts?: Array<{ level: 'info' | 'warning' | 'critical'; message: string; [key: string]: any }>;
}

interface AIResponse {
  answer: string;
  mode: string;
  confidence: number;
  metadata: {
    has_context: boolean;
    user_id: string;
    employee_type: string;
  };
  suggestions?: string[];
}

function getTenantHeader(): Record<string, string> {
  return getClientTenantHeaders();
}

export default function AIAssistantPage() {
  // ── ERP Context ────────────────────────────────────────────
  const { activeProjectId, activeSiteId, getActiveProject, getActiveSite } = useErpContextStore();

  // ── AI Bridge: propagates AI answers into shared operational context ──
  const { processAIResponse } = useAIBridge();
  const { pending_navigation, clearPendingNavigation } = useOperationalContext();

  // ── Context Summary (fetched from backend) ─────────────────
  const [contextSummary, setContextSummary] = useState<{
    summary?: { project?: { sites: number; layers: number; assets: number }; site?: { layers: number; assets: number } };
    alerts?: Array<{ level: 'warning' | 'info'; msg: string }>;
    ai_context_text?: string;
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);

  const fetchContextSummary = useCallback(async () => {
    if (!activeProjectId && !activeSiteId) {
      setContextSummary(null);
      return;
    }
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      if (activeProjectId) params.set('project_id', String(activeProjectId));
      if (activeSiteId) params.set('site_id', String(activeSiteId));
      const res = await fetch(`/api/v1/workspace/context-summary?${params}`, {
        headers: { ...getTenantHeader() }
      });
      if (res.ok) setContextSummary(await res.json());
    } catch (e) {
      console.warn('[AIAssistant] context-summary fetch failed:', e);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeProjectId, activeSiteId]);

  useEffect(() => { fetchContextSummary(); }, [fetchContextSummary]);

  // Initialize context from session or route
  const initialMode = typeof window !== 'undefined' 
    ? detectContextFromRoute(window.location.pathname)
    : 'generic';

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>(initialMode);
  const [showSettings, setShowSettings] = useState(false);
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize: Load context and check backend
  useEffect(() => {
    const savedContext = loadContext();
    if (savedContext) {
      setContextMode(savedContext.mode);
    }

    // Add welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: getContextGreeting(savedContext?.mode || initialMode),
      timestamp: new Date(),
      mode: 'system',
      confidence: 1.0
    };
    setMessages([welcomeMessage]);

    // Check backend health
    checkBackendHealth();
  }, []);

  // Save context when mode changes
  useEffect(() => {
    saveContext({
      mode: contextMode,
      page: window.location.pathname
    });
  }, [contextMode]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check Backend Health
  const checkBackendHealth = async () => {
    console.log('🏥 [Health Check] Starting...');
    try {
      // NEW: Use hybrid AI health endpoint
      const healthData = await aiAPI.health();
      console.log('✅ [Health Check] Backend is connected:', healthData);
      setBackendStatus('connected');
    } catch (error) {
      console.error('❌ [Health Check] Backend health check failed:', error);
      console.error('💡 [Health Check] Ensure backend is running: uvicorn main:app --host 0.0.0.0 --port 7860');
      setBackendStatus('disconnected');
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
      inputRef.current.style.height = inputRef.current.scrollHeight + 'px';
    }
  }, [inputValue]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      console.log('💬 [AI Assistant] Sending message:', inputValue);
      
      // 🧠 Brain Direct: Direct SQL → Groq (no hallucination)
      const data = await aiAPI.askDirect(inputValue, {
        project_id: activeProjectId ?? undefined,
        site_id: activeSiteId ?? undefined,
      });

      console.log('📩 [AI Assistant] Received response:', data);

      if (!data.answer) {
        console.error('⚠️ [AI Assistant] Empty response:', data);
        throw new Error(data.error || 'AI assistant response failed');
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.answer,
        timestamp: new Date(),
        mode: data.mode_used || 'auto',
        confidence: data.confidence || 0.9,
        mapActions: data.map_actions || [],
        metadata: data.metadata || undefined,
        // Sprint 0: BrainResponse fields
        source: data.source,
        evidence: data.evidence || [],
        entities: data.entities || [],
        actions: data.actions || [],
        alerts: data.alerts || [],
      };

      console.log('✅ [AI Assistant] Adding message to chat:', assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);

      // ── Bridge: propagate AI answer into shared operational context ──
      processAIResponse({
        question: userMessage.content,
        answer: data.answer,
        mode: data.mode_used ?? 'auto',
      });

    } catch (error) {
      console.error('💥 [AI Assistant] Error occurred:', error);
      
      const errorDetails = error instanceof Error ? error.message : String(error);
      // Phase 13D: display as a structured system error, NOT as an AI-generated message.
      // role='assistant' + invented Arabic text is forbidden.
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `[SYSTEM_ERROR] code=connection_failed | ${errorDetails}`,
        timestamp: new Date(),
        mode: 'error',
        confidence: 0
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getModeIcon = (mode: ContextMode) => {
    const icons = {
      generic: '🤖',
      gis: '🗺️',
      satellite: '🛰️',
      terrain: '⛰️',
      admin: '👔',
      finance: '💰'
    };
    return icons[mode] || '🤖';
  };

  const getModeLabel = (mode: ContextMode) => {
    const labels = {
      generic: 'عام',
      gis: 'نظم المعلومات الجغرافية',
      satellite: 'صور الأقمار الصناعية',
      terrain: 'التضاريس والخرائط',
      admin: 'الإدارة والموارد البشرية',
      finance: 'المالية والمحاسبة'
    };
    return labels[mode] || 'عام';
  };

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="bg-slate-800/40 border-b border-slate-700 p-4 rounded-t-2xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl flex items-center justify-center">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                المساعد الذكي
                <Sparkles className="w-5 h-5 text-yellow-400" />
              </h2>
              <p className="text-sm text-slate-400">
                Context-Aware AI Assistant
              </p>
            </div>
          </div>

          {/* Context Mode Selector */}
          <div className="relative">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors border border-slate-600"
            >
              <span className="text-2xl">{getModeIcon(contextMode)}</span>
              <span className="text-sm text-slate-300">{getModeLabel(contextMode)}</span>
              <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showSettings ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Menu */}
            {showSettings && (
              <div className="absolute left-0 mt-2 w-64 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50">
                <div className="p-2">
                  <div className="text-xs text-slate-500 px-2 py-1 mb-1">اختر سياق العمل:</div>
                  {(['generic', 'gis', 'satellite', 'terrain', 'admin', 'finance'] as ContextMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setContextMode(mode);
                        setShowSettings(false);
                      }}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                        contextMode === mode
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/50'
                          : 'hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      <span className="text-xl">{getModeIcon(mode)}</span>
                      <span className="text-sm">{getModeLabel(mode)}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Active Context & Backend Status */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 px-3 py-2 bg-purple-500/10 border border-purple-500/20 rounded-lg flex-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <span className="text-sm text-purple-300">
              وضع العمل: {getModeLabel(contextMode)}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${
            backendStatus === 'connected' 
              ? 'bg-emerald-500/10 border-emerald-500/20' 
              : backendStatus === 'disconnected'
              ? 'bg-red-500/10 border-red-500/20'
              : 'bg-yellow-500/10 border-yellow-500/20'
          }`}>
            {backendStatus === 'connected' ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-300">متصل</span>
              </>
            ) : backendStatus === 'disconnected' ? (
              <>
                <AlertCircle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-300">غير متصل</span>
              </>
            ) : (
              <>
                <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                <span className="text-sm text-yellow-300">تحقق...</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Project / Site Context Bar ──────────────────────────────── */}
      {(activeProjectId || activeSiteId) && (
        <div className="mx-0 px-4 pt-3 pb-0 space-y-2">
          {/* Context Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {activeProjectId && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-blue-300 font-medium">
                  {getActiveProject()?.name ?? `مشروع #${activeProjectId}`}
                </span>
                {contextSummary?.summary?.project && (
                  <span className="text-xs text-blue-400/60 mr-1">
                    ({contextSummary.summary.project.sites} موقع · {contextSummary.summary.project.layers} طبقة · {contextSummary.summary.project.assets} أصل)
                  </span>
                )}
              </div>
            )}
            {activeSiteId && (
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-500/10 border border-teal-500/30 rounded-lg">
                <MapPin className="w-3.5 h-3.5 text-teal-400" />
                <span className="text-xs text-teal-300 font-medium">
                  {getActiveSite()?.name ?? `موقع #${activeSiteId}`}
                </span>
                {contextSummary?.summary?.site && (
                  <span className="text-xs text-teal-400/60 mr-1">
                    ({contextSummary.summary.site.layers} طبقة · {contextSummary.summary.site.assets} أصل)
                  </span>
                )}
              </div>
            )}
            {summaryLoading && <Loader2 className="w-3.5 h-3.5 text-slate-500 animate-spin" />}
          </div>
          {/* Alerts */}
          {contextSummary?.alerts && contextSummary.alerts.length > 0 && (
            <div className="space-y-1">
              {contextSummary.alerts.map((alert, i) => (
                <div key={i} className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs ${
                  alert.level === 'warning'
                    ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300'
                    : 'bg-sky-500/10 border border-sky-500/30 text-sky-300'
                }`}>
                  {alert.level === 'warning'
                    ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    : <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />}
                  <span>{alert.msg}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/30">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl p-4 ${
                message.role === 'user'
                  ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white'
                  : message.mode === 'error'
                  ? 'bg-red-500/10 border border-red-500/30 text-red-300'
                  : message.mode === 'suggestions'
                  ? 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-300'
                  : 'bg-slate-800/60 border border-slate-700 text-slate-200'
              }`}
            >
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {message.content}
              </div>

              {/* Sprint 0: Source badge */}
              {message.source && message.role === 'assistant' && message.mode !== 'error' && (
                <div className="mt-2 flex items-center gap-1.5">
                  <span className={`px-2 py-0.5 rounded text-xs font-mono ${
                    message.source === 'sql'        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
                    message.source === 'spatial'    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' :
                    message.source === 'monitoring' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                    message.source === 'tool'       ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' :
                    message.source === 'memory_reuse' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' :
                    'bg-slate-700/50 text-slate-400 border border-slate-600'
                  }`}>
                    {message.source === 'sql'         ? '🗄️ SQL' :
                     message.source === 'spatial'     ? '🗺️ GIS' :
                     message.source === 'monitoring'  ? '📡 Monitor' :
                     message.source === 'tool'        ? '🔧 Tool' :
                     message.source === 'memory_reuse'? '🧠 Memory' :
                     message.source === 'llm_fallback'? '💬 LLM' :
                     message.source}
                  </span>
                </div>
              )}

              {/* Sprint 0: Evidence cards */}
              {message.evidence && message.evidence.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  <div className="text-xs text-slate-400 font-medium">📋 الأدلة ({message.evidence.length} سجل)</div>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {message.evidence.slice(0, 5).map((rec, i) => (
                      <div key={i} className="p-2 rounded-lg bg-slate-900/60 border border-slate-700 text-xs text-slate-300 font-mono">
                        {Object.entries(rec)
                          .filter(([, v]) => v !== null && v !== undefined && v !== '')
                          .slice(0, 4)
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(' · ')}
                      </div>
                    ))}
                    {message.evidence.length > 5 && (
                      <div className="text-xs text-slate-500 text-center">... و {message.evidence.length - 5} سجل آخر</div>
                    )}
                  </div>
                </div>
              )}

              {/* Sprint 0: Alerts */}
              {message.alerts && message.alerts.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {message.alerts.map((alert, i) => (
                    <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-xs ${
                      alert.level === 'critical' ? 'bg-red-500/10 border border-red-500/30 text-red-300' :
                      alert.level === 'warning'  ? 'bg-amber-500/10 border border-amber-500/30 text-amber-300' :
                      'bg-sky-500/10 border border-sky-500/30 text-sky-300'
                    }`}>
                      <span>{alert.level === 'critical' ? '🔴' : alert.level === 'warning' ? '🟡' : 'ℹ️'}</span>
                      <span>{alert.message}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Sprint 0: Actions */}
              {message.actions && message.actions.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {message.actions.map((action, i) => (
                    <button
                      key={i}
                      disabled={action.policy === 'blocked'}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        action.policy === 'auto'
                          ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/30'
                          : action.policy === 'approval'
                          ? 'bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30'
                          : 'bg-slate-700/50 border border-slate-600 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      {action.policy === 'auto' ? '⚡' : action.policy === 'approval' ? '✋' : '🔒'}
                      {action.label}
                    </button>
                  ))}
                </div>
              )}

              {message.mapActions && message.mapActions.length > 0 && (
                <div className="mt-2 p-2 rounded-lg bg-slate-900/50 border border-slate-600 text-xs text-cyan-300">
                  🗺️ map_actions: {message.mapActions.length}
                </div>
              )}
              
              {/* Metadata */}
              <div className="mt-2 flex items-center gap-3 text-xs opacity-60">
                <span>{message.timestamp.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                {message.mode && message.mode !== 'system' && (
                  <span className="px-2 py-0.5 bg-slate-900/50 rounded">
                    {message.mode}
                  </span>
                )}
                {message.confidence !== undefined && message.confidence > 0 && (
                  <span className="px-2 py-0.5 bg-slate-900/50 rounded">
                    ثقة {Math.round(message.confidence * 100)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800/60 border border-slate-700 rounded-2xl p-4">
              <div className="flex items-center gap-2 text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">جاري التفكير...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Navigation chip — shown when AI detects a cross-system navigation intent */}
      {pending_navigation && (
        <div className="px-6 py-2 bg-yellow-500/10 border-t border-yellow-500/20 flex items-center justify-between text-sm">
          <span className="text-yellow-300 flex items-center gap-2">
            <ArrowRight className="w-4 h-4" />
            اقتراح: {pending_navigation.labelAr}
          </span>
          <div className="flex gap-2">
            <a
              href={pending_navigation.route}
              onClick={clearPendingNavigation}
              className="bg-yellow-500 hover:bg-yellow-400 text-black font-semibold px-3 py-1 rounded-lg transition-colors"
            >
              انتقل
            </a>
            <button
              onClick={clearPendingNavigation}
              className="text-slate-400 hover:text-slate-300 px-2 py-1"
            >
              تجاهل
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="bg-slate-800/40 border-t border-slate-700 p-4 rounded-b-2xl">
        <div className="flex gap-3">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="اكتب سؤالك هنا... (Shift+Enter لسطر جديد)"
            className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 resize-none min-h-[50px] max-h-[200px]"
            rows={1}
            disabled={isLoading}
          />
          
          <button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            className="px-6 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 self-end"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
            <span className="font-medium">إرسال</span>
          </button>
        </div>

        {/* Quick Actions - Real Tools */}
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            { text: '📤 رفع ملف KMZ', action: 'upload' },
            { text: '📄 إنشاء تقرير PDF', action: 'report' },
            { text: '🔍 تحليل النظام', action: 'analyze' },
            { text: '📊 إحصائيات المشاريع', action: 'query' }
          ].map((tool, index) => (
            <button
              key={index}
              onClick={() => {
                if (tool.action === 'upload') {
                  // Trigger file upload
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.kmz,.kml';
                  input.onchange = async (e: any) => {
                    const file = e.target.files[0];
                    if (file) {
                      await handleKMZUpload(file);
                    }
                  };
                  input.click();
                } else if (tool.action === 'report') {
                  handleReportGeneration();
                } else if (tool.action === 'analyze') {
                  handleSystemAnalysis();
                } else if (tool.action === 'query') {
                  setInputValue('كم عدد المشاريع النشطة؟');
                }
              }}
              className="px-3 py-1.5 text-xs bg-gradient-to-r from-purple-500/20 to-pink-500/20 hover:from-purple-500/30 hover:to-pink-500/30 text-purple-300 rounded-lg transition-colors border border-purple-500/30 hover:border-purple-500/50"
            >
              {tool.text}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // TOOL HANDLERS
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  
  async function handleKMZUpload(file: File) {
    try {
      setIsLoading(true);
      
      const formData = new FormData();
      formData.append('file', file);
      // project_id will be resolved server-side from session context
      
      const response = await fetch('/api/v1/tools/upload-kmz', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error('Upload failed');
      }
      
      const result = await response.json();
      
      // Add success message to chat
      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ **تم رفع الملف بنجاح!**\n\n` +
                 `📁 الملف: ${result.filename}\n` +
                 `📊 عدد العناصر: ${result.features_count}\n` +
                 `🗺️ الطبقات: ${result.layers.join(', ')}\n\n` +
                 `تم تحليل وتخزين البيانات الجغرافية في قاعدة البيانات.`,
        timestamp: new Date(),
        mode: 'tool_success'
      };
      
      setMessages(prev => [...prev, successMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ حدث خطأ أثناء رفع الملف: ${error}`,
        timestamp: new Date(),
        mode: 'tool_error'
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }
  
  async function handleReportGeneration() {
    try {
      setIsLoading(true);
      
      // Add "generating" message
      const generatingMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '📄 جاري إنشاء التقرير...',
        timestamp: new Date(),
        mode: 'tool_progress'
      };
      setMessages(prev => [...prev, generatingMessage]);
      
      const response = await fetch('/api/v1/tools/generate-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          report_type: 'intelligence_summary',
          project_id: null
        }),
      });
      
      if (!response.ok) {
        throw new Error('Report generation failed');
      }
      
      const result = await response.json();
      
      // Replace progress message with success + download link
      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `✅ **تم إنشاء التقرير بنجاح!**\n\n` +
                 `📄 معرف التقرير: ${result.report_id}\n` +
                 `💾 الحجم: ${result.file_size_kb} كيلوبايت\n\n` +
                 `[⬇️ تحميل التقرير](${result.download_url})`,
        timestamp: new Date(),
        mode: 'tool_success'
      };
      
      setMessages(prev => [...prev.slice(0, -1), successMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ حدث خطأ أثناء إنشاء التقرير: ${error}`,
        timestamp: new Date(),
        mode: 'tool_error'
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }
  
  async function handleSystemAnalysis() {
    try {
      setIsLoading(true);
      
      // Add "analyzing" message
      const analyzingMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: '🔍 جاري تحليل النظام...',
        timestamp: new Date(),
        mode: 'tool_progress'
      };
      setMessages(prev => [...prev, analyzingMessage]);
      
      const response = await fetch('/api/v1/tools/run-system-analysis', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error('Analysis failed');
      }
      
      const result = await response.json();
      
      // Replace progress with results
      const successMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `🔍 **نتائج التحليل الذكي:**\n\n` +
                 `${result.summary}\n\n` +
                 `📊 إجمالي التنبيهات: ${result.total_insights}\n` +
                 `🔴 حرجة: ${result.critical_count}\n` +
                 `🟠 عالية: ${result.high_count}\n\n` +
                 `**إجراءات عاجلة:**\n${result.urgent_actions.slice(0, 3).map((a: string, i: number) => `${i+1}. ${a}`).join('\n')}`,
        timestamp: new Date(),
        mode: 'tool_success'
      };
      
      setMessages(prev => [...prev.slice(0, -1), successMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ حدث خطأ أثناء التحليل: ${error}`,
        timestamp: new Date(),
        mode: 'tool_error'
      };
      
      setMessages(prev => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  }
}
