'use client';

/**
 * 🤖 Unified AI Assistant Component
 * 
 * المساعد الذكي الموحد - يعمل في جميع الصفحات ويتكيف حسب السياق
 * 
 * Features:
 * - Context-aware prompts (map, projects, finance, etc.)
 * - Shared conversation history
 * - Floating & fullscreen modes
 * - Real-time backend health check
 * 
 * Usage:
 * <UnifiedAIAssistant context="map" projectId="123" />
 */

import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Send, Sparkles, Minimize2, Maximize2, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { 
  ContextMode, 
  detectContextFromRoute, 
  getContextGreeting, 
  buildContextPayload,
  saveContext,
  loadContext
} from '@/lib/aiContext';
import { aiAPI } from '@/lib/aiAPI';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  mode?: string;
  confidence?: number;
}

interface UnifiedAIAssistantProps {
  context?: ContextMode;          // السياق: map, projects, finance, etc.
  mode?: 'floating' | 'fullscreen'; // الوضع: عائم أو ملء الشاشة
  projectId?: string;              // معرف المشروع (اختياري)
  additionalContext?: Record<string, any>; // سياق إضافي
}

export default function UnifiedAIAssistant({ 
  context,
  mode = 'floating',
  projectId,
  additionalContext = {}
}: UnifiedAIAssistantProps) {
  // Auto-detect context if not provided
  const initialContext = context || (typeof window !== 'undefined' 
    ? detectContextFromRoute(window.location.pathname)
    : 'generic');

  const [isOpen, setIsOpen] = useState(mode === 'fullscreen');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [contextMode, setContextMode] = useState<ContextMode>(initialContext);
  const [isExpanded, setIsExpanded] = useState(mode === 'fullscreen');
  const [backendStatus, setBackendStatus] = useState<'connected' | 'disconnected' | 'checking'>('checking');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Initialize: Load context and add welcome message
  useEffect(() => {
    const savedContext = loadContext();
    if (savedContext && !context) {
      setContextMode(savedContext.mode);
    }

    // Welcome message
    const welcomeMessage: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content: getContextGreeting(savedContext?.mode || initialContext),
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
      page: typeof window !== 'undefined' ? window.location.pathname : ''
    });
  }, [contextMode]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check backend health
  const checkBackendHealth = async () => {
    try {
      const response = await fetch('/api/v1/ai/health');
      if (response.ok) {
        setBackendStatus('connected');
      } else {
        setBackendStatus('disconnected');
      }
    } catch (error) {
      setBackendStatus('disconnected');
    }
  };

  // Send message
  const handleSend = async () => {
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
      // Build context payload
      const contextPayload = buildContextPayload(contextMode, {
        ...additionalContext,
        project_id: projectId
      });

      console.log('🚀 Sending to AI:', {
        question: userMessage.content,
        context: contextPayload
      });

      // Call AI API
      const response = await aiAPI.ask({
        question: userMessage.content,
        mode: 'auto',
        context: contextPayload
      });

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.answer || response.error || 'لا يوجد رد',
        timestamp: new Date(),
        mode: response.mode_used,
        confidence: response.confidence
      };

      setMessages(prev => [...prev, assistantMessage]);

    } catch (error: any) {
      console.error('❌ AI Error:', error);
      
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ حدث خطأ: ${error.message || 'تعذر الاتصال بالخادم'}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Floating button (collapsed)
  if (!isOpen && mode === 'floating') {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-24 right-6 z-[100] bg-gradient-to-r from-purple-600 to-indigo-600 p-4 rounded-full shadow-2xl hover:scale-110 transition-transform group border border-purple-400/30"
        title="استشر المساعد الذكي"
      >
        <Bot className="text-white w-7 h-7 group-hover:animate-pulse" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-slate-900 animate-pulse"></span>
      </button>
    );
  }

  // Container classes
  const containerClass = isExpanded 
    ? 'fixed inset-0 z-[100] bg-slate-900' 
    : 'fixed bottom-24 right-6 z-[100] w-96 h-[550px] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl shadow-purple-900/20';

  return (
    <div className={`${containerClass} flex flex-col overflow-hidden transition-all duration-300`}>
      {/* Header */}
      <div className="h-16 bg-slate-950 border-b border-slate-800 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center border border-purple-500/30">
            <Bot className="text-purple-400 w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-slate-200 text-sm flex items-center gap-2">
              المساعد الذكي الموحد
              <Sparkles className="w-4 h-4 text-yellow-400" />
            </h3>
            <p className="text-xs flex items-center gap-1.5">
              {backendStatus === 'connected' && (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-emerald-400">متصل</span>
                </>
              )}
              {backendStatus === 'disconnected' && (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-red-400">غير متصل</span>
                </>
              )}
              {backendStatus === 'checking' && (
                <>
                  <Loader2 className="w-3 h-3 text-slate-400 animate-spin" />
                  <span className="text-slate-400">جاري الفحص...</span>
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {mode === 'floating' && (
            <button 
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
              title={isExpanded ? 'تصغير' : 'ملء الشاشة'}
            >
              {isExpanded ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
          )}
          
          <button 
            onClick={() => setIsOpen(false)}
            className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </div>
      </div>

      {/* Context indicator */}
      <div className="px-4 py-2 bg-slate-950/50 border-b border-slate-800/50 text-xs text-slate-400 flex items-center gap-2">
        <span>السياق:</span>
        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded border border-purple-500/30">
          {contextMode}
        </span>
        {projectId && (
          <>
            <span>•</span>
            <span className="text-slate-500">مشروع #{projectId}</span>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white'
                  : 'bg-slate-800 text-slate-200 border border-slate-700'
              }`}
            >
              <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                {msg.content}
              </div>
              
              {msg.role === 'assistant' && msg.mode && (
                <div className="mt-2 pt-2 border-t border-slate-700/50 text-xs text-slate-500 flex items-center gap-2">
                  <span>Mode: {msg.mode}</span>
                  {msg.confidence && (
                    <>
                      <span>•</span>
                      <span>ثقة: {(msg.confidence * 100).toFixed(0)}%</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              <span className="text-sm text-slate-400">جاري التفكير...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/50 shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="اكتب سؤالك هنا... (Enter للإرسال)"
            className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
            rows={2}
            disabled={isLoading}
          />
          
          <button
            onClick={handleSend}
            disabled={isLoading || !inputValue.trim()}
            className="shrink-0 w-12 h-12 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed self-end"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 text-white animate-spin" />
            ) : (
              <Send className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
