'use client';

// ═══════════════════════════════════════════════════════════════
// PHASE 13 — TRUE DIGITAL BRAIN
// ALL input → /api/v1/ask (orchestrator)
// NO keyword parsing. NO local routing. LLM decides everything.
// ═══════════════════════════════════════════════════════════════

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname } from 'next/navigation';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useProjectStore } from '@/store/projectStore';
import { useLayerStore } from '@/store/layerStore';
import { useMapStore } from '@/store/mapStore';
import { workspaceApi } from '@/store/apiService';
import { Brain, ChevronRight, ChevronLeft, Send, User, Loader2, Zap } from 'lucide-react';

const TOOL_CONTEXT: Record<string, string | null> = {
  buffer:               'تم تفعيل **نطاق التأثير**. انقر على الخريطة لتحديد مركز الدائرة — سيظهر النطاق باللون البرتقالي ويُعرض عدد الأصول داخله.',
  nearby:               'تم تفعيل **البحث القريب**. انقر على نقطة في الخريطة للبحث عن الأصول ضمن نطاق دائري.',
  intersect:            'تم تفعيل **التقاطع المكاني**. ارسم مضلعاً على الخريطة — كل الأصول داخله ستُحدَّد ويُعرض عددها.',
  polygon:              'تم تفعيل **رسم منطقة**. انقر لتحديد النقاط، انقر مرتين للإغلاق وحفظ المنطقة.',
  line:                 'تم تفعيل **رسم خط**. انقر لإضافة نقاط المسار، انقر مرتين للإنهاء.',
  point:                'تم تفعيل **إضافة نقطة**. انقر على الخريطة لتثبيت الموقع.',
  'measure-distance':   'تم تفعيل **قياس المسافة**. انقر لتحديد نقاط المسار، انقر مرتين للنتيجة.',
  'measure-area':       'تم تفعيل **قياس المساحة**. ارسم المنطقة، انقر مرتين لمعرفة المساحة بالكيلومترات.',
  'inspect-coordinate': 'تم تفعيل **فحص الإحداثيات**. انقر على أي نقطة لرؤية إحداثياتها الدقيقة.',
  modify:               'تم تفعيل **تعديل المعالم**. انقر على معلم ثم اسحب نقاطه لتغيير شكله.',
  delete:               'تم تفعيل **حذف المعالم**. انقر على أي معلم لحذفه نهائياً.',
  idle:                 null,
};

// Quick commands still set input text — orchestrator decides what to do with them
const QUICK_COMMANDS = ['حرم 400 متر', 'ابحث 300م', 'تقاطع منطقة', 'خريطة حرارية', 'تحليل المخاطر', 'اعطيني بيانات المستشفيات'];

// ── Spatial shortcuts that can be applied instantly (UX only, no LLM needed) ──
// These are EXCEPTION cases per Phase 13 spec — even these pass through orchestrator
// but we also set UI state immediately for instant feedback.
function detectSpatialShortcut(cmd: string): { action: string; distance: number } | null {
  const m = cmd.match(/(?:حرم|نطاق|دائرة|buffer)\s+(\d+)\s*(?:م|متر|meter|m)?/i);
  if (m) return { action: 'buffer', distance: parseInt(m[1]) };
  const n = cmd.match(/(?:ابحث|بحث|أقرب|قريب|nearby)\s+(\d+)\s*(?:م|متر|meter|m)?/i);
  if (n) return { action: 'nearby', distance: parseInt(n[1]) };
  return null;
}

function renderContent(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.+?)\*\*/g);
    return (
      <p key={i} className={i > 0 ? 'mt-1' : ''}>
        {parts.map((part, pi) =>
          pi % 2 === 1 ? <strong key={pi} className="text-white font-semibold">{part}</strong> : <span key={pi}>{part}</span>
        )}
      </p>
    );
  });
}

interface Message {
  id: string;
  role: 'assistant' | 'user';
  content: string;
  timestamp: number;
}

export default function CognitiveSidebar() {
  const [collapsed, setCollapsed] = useState(true);
  const [width, setWidth] = useState(320);
  const [messages, setMessages] = useState<Message[]>([{
    id: 'init',
    role: 'assistant',
    content: 'مرحباً — أنا **المساعد الذكي** للفضاء الهندسي.\n\nاختر مشروعاً وطبقة من القائمة اليسرى، ثم اسألني عن البيانات، المستشفيات، المخاطر، التحليل المكاني... أي شيء.',
    timestamp: Date.now(),
  }]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  // Track last actions for context injection
  const lastActionsRef = useRef<string[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ startX: number; startW: number } | null>(null);
  const lastEditingState = useRef<string>('idle');
  const lastSummaryTs = useRef<number>(0);

  const {
    editingState, setEditingState,
    lastActionSummary,
    bufferDistance, setBufferDistance,
    nearbyRadius, setNearbyRadius,
    heatmapVisible, setHeatmapVisible,
    features,
    selectedFeatureId,
  } = useWorkspaceStore();

  const activeProjectId = useProjectStore(s => s.activeProjectId);
  const projects = useProjectStore(s => s.projects);
  const activeLayerId = useLayerStore(s => s.activeLayerId);
  const layers = useLayerStore(s => s.layers);
  // Phase 6: read live viewport bounds directly — set by MapCanvas on every moveend
  const mapBounds = useMapStore(s => s.mapBounds);
  // Phase 8: pending map zoom — used by zoom_to_location and fit_bounds actions
  const setPendingFitExtent = useMapStore(s => s.setPendingFitExtent);
  // Phase 7: current route for page context
  const pathname = usePathname();
  const activeProject = projects.find((p: any) => p.id === activeProjectId);
  const activeLayer = layers.find((l: any) => l.id === activeLayerId);

  const pushMsg = useCallback((content: string, role: 'assistant' | 'user' = 'assistant') => {
    setMessages(prev => [...prev, { id: Math.random().toString(36).slice(2), role, content, timestamp: Date.now() }]);
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
  }, []);

  useEffect(() => {
    if (editingState === lastEditingState.current) return;
    lastEditingState.current = editingState;
    const msg = TOOL_CONTEXT[editingState];
    if (msg) {
      setTimeout(() => pushMsg(msg), 80);
      // Track tool activations as user actions for context
      lastActionsRef.current = [`activated_tool:${editingState}`, ...lastActionsRef.current].slice(0, 5);
    }
  }, [editingState, pushMsg]);

  useEffect(() => {
    if (!lastActionSummary || lastActionSummary.timestamp === lastSummaryTs.current) return;
    lastSummaryTs.current = lastActionSummary.timestamp;
    const countPart = lastActionSummary.count !== undefined ? ` وُجد **${lastActionSummary.count} عنصر**.` : '';
    pushMsg(`✅ **${lastActionSummary.title}**\n\n${lastActionSummary.body}${countPart}`);
    lastActionsRef.current = [`spatial_result:${lastActionSummary.title}(${lastActionSummary.count})`, ...lastActionsRef.current].slice(0, 5);
    if (collapsed) setCollapsed(false);
  }, [lastActionSummary, pushMsg, collapsed]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: width };
    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      setWidth(Math.max(280, Math.min(520, dragRef.current.startW + dragRef.current.startX - ev.clientX)));
    };
    const onUp = () => { dragRef.current = null; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

  // ════════════════════════════════════════════════════════════
  // PHASE 13: sendToOrchestrator — SINGLE ENTRY POINT
  // Injects full workspace context so LLM is never blind
  // ════════════════════════════════════════════════════════════
  const sendToOrchestrator = async (question: string) => {
    // Phase 7: only layers with visible=true — matches canonical spec
    const visibleLayerNames = layers.filter((l: any) => l.visible).map((l: any) => l.name).filter(Boolean);
    const featureCount = activeLayerId
      ? features.filter(f => f.properties?.layerId === activeLayerId).length
      : features.length;

    if (!activeProjectId) {
      pushMsg('يبدو أنه لم يتم اختيار **مشروع** بعد.\n\nيرجى اختيار مشروع من القائمة اليسرى حتى أستطيع الإجابة بدقة.');
      return;
    }

    // Build conversation context (last 5 messages for better follow-up handling)
    const recentHistory = messages
      .filter(m => m.id !== 'init')
      .slice(-5)
      .map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content.slice(0, 400)}`)
      .join('\n');
    const conversationContext = recentHistory || undefined;

    // ── PHASE 13: Rich context injection ──────────────────────
    const selectedFeature = selectedFeatureId
      ? features.find(f => f.id === selectedFeatureId)
      : undefined;

    const result = await workspaceApi.askOrchestrator(question, {
      project_id: activeProjectId,
      project_name: activeProject?.name,
      layer_id: activeLayerId,
      layer_name: activeLayer?.name,
      feature_count: featureCount,
      visible_layer_names: visibleLayerNames,
      active_layer: activeLayer?.name || null,
      visible_layers: visibleLayerNames,
      last_user_actions: lastActionsRef.current,
      editing_state: editingState,
      // Phase 8: correct module identifier + live page path
      module: 'gis',
      page: pathname ?? undefined,
      // Phase 8: site_id from active layer — reliable if a layer is selected
      site_id: activeLayer?.siteId != null ? String(activeLayer.siteId) : undefined,
      context: conversationContext,
      // Phase 5: selected feature
      selected_feature_id: selectedFeatureId || undefined,
      selected_feature_type: selectedFeature?.properties?.asset_type,
      // Phase 6: live viewport bounds from MapCanvas moveend — never static
      map_bounds: mapBounds ?? undefined,
      // Phase 16: assistant role
      role: 'engineering',
      // Phase 15: report mode — user can trigger 'detailed' via keywords
      report_mode: 'short',
    });

    // Track this as a user action
    lastActionsRef.current = [`asked:${question.slice(0, 40)}`, ...lastActionsRef.current].slice(0, 5);

    // ── PHASE 13 + Phase 8: Expanded map action execution ─────
    if (result.map_actions?.length) {
      for (const action of result.map_actions) {
        switch (action.type) {
          case 'buffer':
            if (action.params?.distance) setBufferDistance(action.params.distance);
            setEditingState('buffer');
            break;
          case 'nearby':
            if (action.params?.radius) setNearbyRadius(action.params.radius);
            setEditingState('nearby');
            break;
          case 'intersect':
            setEditingState('intersect');
            break;
          // Phase 8: fix show_heatmap string (backend sends 'show_heatmap', was only 'heatmap')
          case 'heatmap':
          case 'show_heatmap':
            setHeatmapVisible(true);
            break;
          case 'highlight_features':
          case 'zoom_to_features':
            if (action.features?.length) {
              useWorkspaceStore.getState().setSpatialResults(action.features);
            }
            break;
          // Phase 8: highlight_assets from spatial engine — zoom to asset location
          case 'highlight_assets': {
            const aLat = action.lat ?? action.data?.lat;
            const aLng = action.lng ?? action.data?.lng;
            if (aLat != null && aLng != null) {
              const margin = 0.008;
              setPendingFitExtent([aLng - margin, aLat - margin, aLng + margin, aLat + margin]);
            }
            break;
          }
          // Phase 8: zoom_to_location from spatial engine — convert point to extent
          case 'zoom_to_location': {
            const zLat = action.lat ?? action.data?.lat;
            const zLng = action.lng ?? action.data?.lng ?? action.data?.lon;
            if (zLat != null && zLng != null) {
              const margin = 0.008;
              setPendingFitExtent([zLng - margin, zLat - margin, zLng + margin, zLat + margin]);
            }
            break;
          }
          // Phase 8: fit_bounds from spatial engine
          // backend sends: { bounds: [[min_lat, min_lon], [max_lat, max_lon]] }
          case 'fit_bounds': {
            const bnds = action.bounds ?? action.data?.bounds;
            if (Array.isArray(bnds) && bnds.length === 2) {
              const [[minLat, minLon], [maxLat, maxLon]] = bnds;
              setPendingFitExtent([minLon, minLat, maxLon, maxLat]);
            }
            break;
          }
          case 'draw_geometry':
            if (action.params?.geometry_type === 'polygon') setEditingState('polygon');
            else if (action.params?.geometry_type === 'line') setEditingState('line');
            else if (action.params?.geometry_type === 'point') setEditingState('point');
            break;
          case 'zoom_to_extent':
            // Future: call map zoom with action.params.bbox
            break;
          case 'filter_layers':
            // Future: call layer filter with action.params.filter
            break;
          default:
            if (action.features?.length) {
              useWorkspaceStore.getState().setSpatialResults(action.features);
            }
        }
      }
    }

    if (!result.response) {
      throw new Error('AI_EMPTY_RESPONSE');
    }
    pushMsg(result.response);

    // ── Phase 11A.5: Prediction & Decision — structured consumption ──
    // Log both fields so they are always visible in browser devtools.
    if (result.prediction || result.decision) {
      console.log('[Brain] decision:', result.decision ?? null);
      console.log('[Brain] prediction:', result.prediction ?? null);
    }

    // Append trend insight if a meaningful signal is available
    // (trend !== 'unknown' means we have at least 3 grounded historical traces)
    const pred = result.prediction;
    if (pred && pred.trend !== 'unknown' && pred.grounded === true) {
      const trendIcon = pred.trend === 'increasing' ? '📈' : pred.trend === 'decreasing' ? '📉' : '➡️';
      pushMsg(
        `${trendIcon} **اتجاه تاريخي** · ${pred.confidence === 'high' ? 'ثقة عالية' : pred.confidence === 'medium' ? 'ثقة متوسطة' : 'ثقة منخفضة'}\n${pred.insight}`
      );
    }

    // ── Phase 11B: Simulation — controlled scenario consumption ──
    const sim = result.simulation;
    if (sim) {
      console.log('[Brain] simulation:', sim);
      // Only surface meaningful grounded scenarios to the user
      if (sim.grounded && sim.scenario !== 'insufficient_basis') {
        const scenarioIcons: Record<string, string> = {
          alert_escalation: '🚨',
          asset_worsening:  '⚠️',
          scope_expansion:  '🔍',
          no_change:        '✅',
        };
        const icon = scenarioIcons[sim.scenario] ?? '🎬';
        const shiftLabel = sim.risk_shift === 'escalating'
          ? 'تصعيد محتمل'
          : sim.risk_shift === 'stable'
          ? 'مستقر'
          : sim.risk_shift === 'de_escalating'
          ? 'تراجع متوقع'
          : 'غير محدد';
        pushMsg(
          `${icon} **سيناريو محتمل** · ${shiftLabel}\n${sim.expected_effect}\n💡 ${sim.recommended_action}`
        );
      }
    }
  };

  // ════════════════════════════════════════════════════════════
  // PHASE 13: handleSend — ALL INPUT → ORCHESTRATOR
  // Spatial shortcuts get instant UI feedback BUT still route
  // through orchestrator for analytical enrichment
  // ════════════════════════════════════════════════════════════
  const handleSend = async () => {
    const cmd = input.trim();
    if (!cmd || isProcessing) return;
    setInput('');
    pushMsg(cmd, 'user');
    setIsProcessing(true);
    try {
      // ── Exception: spatial shortcuts → instant UI + orchestrator ──
      const spatial = detectSpatialShortcut(cmd);
      if (spatial) {
        // Instant UI feedback (zero latency feel)
        if (spatial.action === 'buffer') {
          setBufferDistance(spatial.distance);
          setEditingState('buffer');
        } else if (spatial.action === 'nearby') {
          setNearbyRadius(spatial.distance);
          setEditingState('nearby');
        }
        // STILL route through orchestrator for enrichment
        await sendToOrchestrator(cmd);
      } else {
        // ── ALL OTHER INPUT → ORCHESTRATOR (no local parsing) ──────
        await sendToOrchestrator(cmd);
      }
    } catch (err: unknown) {
      // Phase 13D: display connection error as a system notification,
      // NOT as an AI-generated assistant message.
      const errCode = (err instanceof Error && err.message) ? err.message : 'connection_failed';
      pushMsg(`[SYSTEM_ERROR] code=connection_failed | ${errCode}`);
      console.error('[CognitiveSidebar] orchestrator failed:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  if (collapsed) {
    return (
      <div className="flex flex-col items-center bg-slate-900 border-r border-slate-700 w-10 flex-shrink-0 py-3 gap-4 z-10">
        <button onClick={() => setCollapsed(false)} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors" title="فتح المساعد الذكي">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <Brain className="w-5 h-5 text-blue-400 opacity-60" />
        {lastActionSummary && <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />}
      </div>
    );
  }

  return (
    <div className="relative flex flex-col bg-slate-950 border-r border-slate-800 flex-shrink-0 z-10 overflow-hidden" style={{ width }} dir="rtl">
      <div className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-blue-500/30 transition-colors z-20" onMouseDown={onMouseDown} />

      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Brain className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span className="text-xs font-semibold text-slate-200 flex-shrink-0">المساعد الذكي</span>
          <span className="text-[8px] px-1 py-0.5 rounded bg-emerald-900/50 border border-emerald-700/40 text-emerald-400 flex-shrink-0">Brain</span>
          {activeProject && <span className="text-xs text-slate-500 truncate">— {activeProject.name}</span>}
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {activeLayer && <span className="text-xs px-1.5 py-0.5 rounded bg-indigo-900/60 border border-indigo-700/40 text-indigo-300 truncate max-w-[80px]">{activeLayer.name}</span>}
          <button onClick={() => setCollapsed(true)} className="p-1 rounded hover:bg-slate-800 text-slate-500 hover:text-slate-200 transition-colors mr-1">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.map(msg => (
          <div key={msg.id} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5 ${msg.role === 'assistant' ? 'bg-blue-600/30' : 'bg-slate-700'}`}>
              {msg.role === 'assistant' ? <Brain className="w-3 h-3 text-blue-400" /> : <User className="w-3 h-3 text-slate-400" />}
            </div>
            <div className={`max-w-[85%] rounded-xl px-3 py-2 text-[12px] leading-relaxed ${msg.role === 'assistant' ? 'bg-slate-800 text-slate-200' : 'bg-blue-800/30 text-blue-100 border border-blue-700/30'}`}>
              {renderContent(msg.content)}
              <p className="text-xs text-slate-600 mt-1.5">{new Date(msg.timestamp).toLocaleTimeString('ar-LY')}</p>
            </div>
          </div>
        ))}
        {isProcessing && (
          <div className="flex gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600/30 flex items-center justify-center"><Brain className="w-3 h-3 text-blue-400" /></div>
            <div className="bg-slate-800 rounded-xl px-3 py-2.5 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-3 py-1.5 border-t border-slate-800/60 flex gap-1.5 flex-wrap flex-shrink-0">
        {QUICK_COMMANDS.map(cmd => (
          <button key={cmd} onClick={() => setInput(cmd)}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors">
            <Zap className="w-2.5 h-2.5 text-yellow-500" />
            {cmd}
          </button>
        ))}
      </div>

      <div className="p-3 border-t border-slate-800 flex-shrink-0 bg-slate-900/40">
        <div className="flex gap-2">
          <input type="text" value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder='اسأل أو اكتب أمراً...' dir="rtl" disabled={isProcessing}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg text-[12px] text-slate-200 placeholder:text-slate-600 px-3 py-2 focus:outline-none focus:border-blue-500/60 transition-colors min-w-0" />
          <button onClick={handleSend} disabled={isProcessing || !input.trim()}
            className="p-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:cursor-not-allowed rounded-lg text-white transition-colors flex-shrink-0">
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
