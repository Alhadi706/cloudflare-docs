'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Bell, BellRing, Loader2, AlertCircle, CheckCircle2, Eye, EyeOff,
  Trash2, ChevronDown, ChevronUp, MapPin, ShieldAlert, Zap, Navigation2, CalendarDays,
} from 'lucide-react';
import type { SceneListItem } from '@/lib/satelliteIntelAPI';

// ── Types ────────────────────────────────────────────────────────────────────

type AlertType =
  // تعديات وبناء
  | 'construction_intrusion'
  | 'power_line_violation'
  | 'protected_area_violation'
  | 'road_cut'
  | 'unauthorized_access'
  | 'illegal_dump'
  // مياه وفيضان
  | 'moisture_anomaly'
  | 'flood_water'
  // حرائق وحرارة
  | 'fire_smoke'
  | 'heat_anomaly'
  // بيئة وأرض
  | 'vegetation_change'
  | 'ground_subsidence'
  // غاز وصناعة
  | 'gas_leak';

interface AlertDefinition {
  id: string;
  name: string;
  corridor_name: string;
  polygon: [number, number][];
  buffer_m: number;
  alert_types: AlertType[];
  sensitivity: 'low' | 'medium' | 'high';
  created_at: string;
  reference_scene_uid?: string;
  notify_emails: string[];
  notify_roles: string[];
  notify_employees: string[];
  notify_severity: 'all' | 'warning_up' | 'critical_only';
}

interface AlertEvent {
  id: string;
  alert_def_id: string;
  alert_type: AlertType;
  severity: 'info' | 'warning' | 'critical';
  detected_at: string;
  scene_uid: string;
  location: { lon: number; lat: number };
  area_m2: number;
  confidence: number;
  description_ar: string;
  change_pct: number;
}

interface CheckResult {
  status: 'ok';
  checked_at: string;
  scene_uid: string;
  corridor_name: string;
  date_before: string;
  date_after: string;
  summary: {
    total_events: number;
    critical_count: number;
    warning_count: number;
    info_count: number;
  };
  events: AlertEvent[];
  geojson: { type: 'FeatureCollection'; features: any[] };
  metadata: {
    sensor_note: string;
    image_quality?: { ssim_enhanced?: number; overall_change_pct?: number } | null;
    analysis_notes?: string[];
  };
}

interface Props {
  scenes: SceneListItem[];
  drawnPolygon?: [number, number][] | null;
  onResultReady: (geojson: any | null) => void;
  onFlyTo?: (lon: number, lat: number, zoom?: number) => void;
  onMarkersReady?: (markers: { lon: number; lat: number; severity: string; type: string; label: string }[]) => void;
}

// ── Constants ─────────────────────────────────────────────────────────────────

// تصنيف أنواع التنبيهات حسب الفئة
const ALERT_TYPE_GROUPS: { label: string; color: string; types: AlertType[] }[] = [
  {
    label: 'تعديات وبناء',
    color: 'text-red-400',
    types: ['construction_intrusion', 'power_line_violation', 'protected_area_violation', 'road_cut', 'unauthorized_access', 'illegal_dump'],
  },
  {
    label: 'مياه وفيضان',
    color: 'text-blue-400',
    types: ['moisture_anomaly', 'flood_water'],
  },
  {
    label: 'حرائق وحرارة',
    color: 'text-orange-400',
    types: ['fire_smoke', 'heat_anomaly'],
  },
  {
    label: 'بيئة وأرض',
    color: 'text-green-400',
    types: ['vegetation_change', 'ground_subsidence'],
  },
  {
    label: 'غاز وصناعة',
    color: 'text-purple-400',
    types: ['gas_leak'],
  },
];

const ALERT_TYPE_META: Record<AlertType, { label: string; icon: string; color: string }> = {
  // تعديات وبناء
  construction_intrusion:    { label: 'تعدية بناء',              icon: '🏗',  color: 'text-red-400' },
  power_line_violation:      { label: 'تحت خطوط الكهرباء',        icon: '⚡',  color: 'text-yellow-400' },
  protected_area_violation:  { label: 'تعدِ على أرض محمية',      icon: '🚫',  color: 'text-red-500' },
  road_cut:                  { label: 'قطع/حفر طريق',           icon: '⚠',  color: 'text-orange-400' },
  unauthorized_access:       { label: 'دخول غير مصرح',          icon: '🚧',  color: 'text-purple-400' },
  illegal_dump:              { label: 'ردم/نفايات غير قانوني',  icon: '🗑',  color: 'text-zinc-400' },
  // مياه وفيضان
  moisture_anomaly:          { label: 'رطوبة شاذة (تسرب)',      icon: '💧',  color: 'text-blue-400' },
  flood_water:               { label: 'فيضان',                    icon: '🌊',  color: 'text-cyan-400' },
  // حرائق وحرارة
  fire_smoke:                { label: 'حريق/دخان',               icon: '🔥',  color: 'text-red-500' },
  heat_anomaly:              { label: 'شذوذ حراري',              icon: '🌡',  color: 'text-amber-500' },
  // بيئة وأرض
  vegetation_change:         { label: 'تغيير نباتي',          icon: '🌿',  color: 'text-green-400' },
  ground_subsidence:         { label: 'هبوط أرضي',            icon: '⬇',  color: 'text-amber-400' },
  // غاز وصناعة
  gas_leak:                  { label: 'تسرب غاز (CH4)',        icon: '☢️',  color: 'text-purple-400' },
};

const SEV_STYLE: Record<string, string> = {
  critical: 'bg-red-900/50 text-red-300 border-red-700/50',
  warning:  'bg-amber-900/40 text-amber-300 border-amber-700/50',
  info:     'bg-blue-900/30 text-blue-300 border-blue-700/40',
};
const SEV_AR: Record<string, string> = {
  critical: 'حرج', warning: 'تحذير', info: 'معلومة',
};
const SEV_ICON: Record<string, React.ElementType> = {
  critical: ShieldAlert, warning: AlertCircle, info: Bell,
};

const LS_KEY = 'sic_smart_alerts_v1';

function loadAlerts(): AlertDefinition[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]'); } catch { return []; }
}
function saveAlerts(defs: AlertDefinition[]) {
  try { localStorage.setItem(LS_KEY, JSON.stringify(defs)); } catch { /* skip */ }
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SmartAlertsPanel({ scenes, drawnPolygon, onResultReady, onFlyTo, onMarkersReady }: Props) {
  const [alerts,       setAlerts]       = useState<AlertDefinition[]>([]);
  const [activeAlert,  setActiveAlert]  = useState<AlertDefinition | null>(null);
  const [mode,         setMode]         = useState<'list' | 'create' | 'results'>('list');
  const [loading,      setLoading]      = useState(false);
  const [error,        setError]        = useState<string | null>(null);
  const [checkResult,  setCheckResult]  = useState<CheckResult | null>(null);
  const [showOnMap,    setShowOnMap]    = useState(true);
  const [expandedEvt,  setExpandedEvt]  = useState<string | null>(null);

  // Create form state
  const [form, setForm] = useState({
    name: 'تنبيه مراقبة المسار',
    corridor_name: 'خط نقل القدرة الرئيسي',
    buffer_m: 50,
    notify_emails: '',
    notify_employees: '',
    notify_roles: { admin: true, owner: true, manager: true, supervisor: true, gis_supervisor: true, engineer: false, employee: false } as Record<string, boolean>,
    notify_severity: 'all' as 'all' | 'warning_up' | 'critical_only',
    sensitivity: 'medium' as 'low' | 'medium' | 'high',
    alert_types: {
      construction_intrusion:   true,
      power_line_violation:     true,
      protected_area_violation: false,
      road_cut:                 true,
      unauthorized_access:      false,
      illegal_dump:             false,
      moisture_anomaly:         true,
      flood_water:              false,
      fire_smoke:               true,
      heat_anomaly:             false,
      vegetation_change:        false,
      ground_subsidence:        false,
      gas_leak:                 false,
    } as Record<AlertType, boolean>,
  });

  const [selectedSceneUid, setSelectedSceneUid] = useState(scenes[0]?.scene_uid ?? '');

  useEffect(() => { setAlerts(loadAlerts()); }, []);

  const handleCreate = () => {
    if (!drawnPolygon || drawnPolygon.length < 3) {
      setError('ارسم حرم المسار على الخريطة أولاً (زر رسم في الشريط العلوي)');
      return;
    }
    const activeTypes = Object.entries(form.alert_types)
      .filter(([, v]) => v).map(([k]) => k as AlertType);
    if (!activeTypes.length) { setError('اختر نوع تنبيه واحداً على الأقل'); return; }

    const def: AlertDefinition = {
      id: `alert-${Date.now()}`,
      name: form.name,
      corridor_name: form.corridor_name,
      polygon: drawnPolygon,
      buffer_m: form.buffer_m,
      alert_types: activeTypes,
      sensitivity: form.sensitivity,
      created_at: new Date().toISOString(),
      reference_scene_uid: selectedSceneUid,
      notify_emails: form.notify_emails.split(',').map(s => s.trim()).filter(Boolean),
      notify_employees: form.notify_employees.split(',').map(s => s.trim()).filter(Boolean),
      notify_roles: Object.entries(form.notify_roles).filter(([,v]) => v).map(([k]) => k),
      notify_severity: form.notify_severity,
    };
    const updated = [def, ...alerts];
    setAlerts(updated);
    saveAlerts(updated);
    setActiveAlert(def);
    setMode('list');
    setError(null);
    // حفظ في خادم الفحص التلقائي
    fetch('/api/gis/alerts-registry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(def),
    }).catch(() => {/* silent */});
  };

  const handleDelete = (id: string) => {
    const updated = alerts.filter(a => a.id !== id);
    setAlerts(updated);
    saveAlerts(updated);
    if (activeAlert?.id === id) setActiveAlert(null);
    if (checkResult?.scene_uid && activeAlert?.id === id) {
      setCheckResult(null); onResultReady(null);
    }
    // حذف من الخادم أيضاً
    fetch(`/api/gis/alerts-registry?id=${id}`, { method: 'DELETE' }).catch(() => {/* silent */});
  };

  const handleCheck = useCallback(async (def: AlertDefinition) => {
    if (!selectedSceneUid) { setError('اختر صورة للمقارنة'); return; }
    setActiveAlert(def);
    setLoading(true); setError(null); setCheckResult(null); onResultReady(null);
    try {
      const scene = scenes.find(s => s.scene_uid === selectedSceneUid);
      const currentDate = scene?.acquisition_date ?? new Date().toISOString().slice(0, 10);

      // استخدام التاريخ المرجعي (قبل 90 يوم) للمقارنة
      const refDate = new Date(currentDate);
      refDate.setDate(refDate.getDate() - 90);
      const dateBefore = refDate.toISOString().slice(0, 10);

      // استدعاء محرك التحليل الحقيقي (NASA GIBS صور حقيقية)
      const res = await fetch('/api/gis/analyze-corridor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polygon:      def.polygon,
          date_before:  dateBefore,
          date_after:   currentDate,
          alert_types:  def.alert_types,
          sensitivity:  def.sensitivity,
        }),
      });
      if (!res.ok) throw new Error(await res.text().catch(() => `HTTP ${res.status}`));
      const raw = await res.json();

      // إذا كانت البيانات غير متوفرة أو لا توجد صور
      if (raw.status === 'no_data' || (raw.ok === false && raw.unavailable_reason)) {
        const reason = raw.unavailable_reason ?? 'الصور غير متوفرة لهذا التاريخ أو المنطقة';
        setError(`⚠️ البيانات غير متوفرة: ${reason}`);
        setLoading(false);
        return;
      }

      // تحويل استجابة المحرك إلى CheckResult
      const data: CheckResult = {
        status:       'ok',
        checked_at:   new Date().toISOString(),
        scene_uid:    selectedSceneUid,
        corridor_name: def.corridor_name,
        date_before:  dateBefore,
        date_after:   currentDate,
        summary:      raw.summary ?? { total_events: 0, critical_count: 0, warning_count: 0, info_count: 0 },
        events:       (raw.events ?? []).map((e: any, i: number) => ({
          id:            e.id ?? `ev-${i}`,
          alert_def_id:  def.id,
          alert_type:    e.alert_type,
          severity:      e.severity,
          detected_at:   currentDate,
          scene_uid:     selectedSceneUid,
          location:      e.location ?? { lon: 0, lat: 0 },
          area_m2:       e.area_m2 ?? 0,
          confidence:    e.confidence ?? 0,
          description_ar: e.description_ar ?? '',
          change_pct:    raw.image_quality?.overall_change_pct ?? 0,
          source:        e.source ?? 'satellite_real_analysis',
        })),
        geojson:  raw.geojson ?? { type: 'FeatureCollection', features: [] },
        metadata: {
          sensor_note: raw.image_source ?? 'NASA GIBS (MODIS/Landsat، مجاني دائماً)',
          image_quality: raw.image_quality ?? null,
          analysis_notes: raw.analysis_notes ?? [],
        },
      };
      setCheckResult(data);
      setShowOnMap(true);
      onResultReady(data.geojson);
      // إرسال markers الأحداث للخريطة
      if (onMarkersReady) {
        onMarkersReady(data.events
          .filter(e => e.location.lon !== 0 && e.location.lat !== 0)
          .map(e => ({
            lon: e.location.lon,
            lat: e.location.lat,
            severity: e.severity,
            type: e.alert_type,
            label: e.description_ar || e.alert_type,
          }))
        );
      }
      setMode('results');
      // حفظ إشعار في الخادم
      fetch('/api/gis/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_id:      def.id,
          alert_name:    def.name,
          corridor:      def.corridor_name,
          severity:      data.summary.critical_count > 0 ? 'critical' : data.summary.total_events > 0 ? 'warning' : 'info',
          summary:       data.summary.critical_count > 0
            ? `${data.summary.critical_count} حدث حرج في حرم ${def.corridor_name}`
            : data.summary.total_events > 0
            ? `${data.summary.total_events} حدث مكتشف في حرم ${def.corridor_name}`
            : `الحرم نظيف — لا تغييرات مرصودة`,
          total_events:   data.summary.total_events,
          critical_count: data.summary.critical_count,
          warning_count:  data.summary.warning_count,
          events:         data.events.slice(0, 5),
          geojson:        data.geojson,
          image_source:   data.metadata.sensor_note,
          checked_at:     currentDate,
          triggered_by:   'manual',
          image_quality:  data.metadata.image_quality,
        }),
      }).catch(() => {/* silent */});
    } catch (e: any) {
      setError(e?.message ?? 'فشل الفحص');
    } finally {
      setLoading(false);
    }
  }, [selectedSceneUid, scenes, onResultReady]);

  const handleToggleMap = () => {
    setShowOnMap(p => { onResultReady(p ? null : checkResult?.geojson ?? null); return !p; });
  };

  // ── Render: Create form ────────────────────────────────────────────────────
  if (mode === 'create') {
    return (
      <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
        <div className="flex items-center gap-2">
          <BellRing size={14} className="text-yellow-400 shrink-0" />
          <span className="text-[12px] font-bold text-slate-200">إنشاء تنبيه جديد</span>
          <button onClick={() => { setMode('list'); setError(null); }}
            className="mr-auto text-slate-500 hover:text-slate-300 text-[11px]">← رجوع</button>
        </div>

        {/* Polygon status */}
        <div className={`rounded-lg border px-2.5 py-2 text-[9px] ${
          drawnPolygon && drawnPolygon.length >= 3
            ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-400'
            : 'border-rose-700/40 bg-rose-900/20 text-rose-400'
        }`}>
          {drawnPolygon && drawnPolygon.length >= 3
            ? `✓ حرم المسار محدد (${drawnPolygon.length} نقطة)`
            : '⚠ ارسم حرم المسار على الخريطة باستخدام أداة الرسم'}
        </div>

        {/* Form fields */}
        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">اسم التنبيه</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">اسم المسار / الخط</label>
            <input value={form.corridor_name} onChange={e => setForm(p => ({ ...p, corridor_name: e.target.value }))}
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-yellow-500" />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">📧 بريد الإشعارات (يفصل بفاصلة للمتعدد)</label>
            <input
              type="text"
              value={form.notify_emails}
              onChange={e => setForm(p => ({ ...p, notify_emails: e.target.value }))}
              placeholder="a@company.com, b@company.com"
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-yellow-500 placeholder:text-slate-600"
            />
          </div>
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">👤 أرقام موظفين محددين (يفصل بفاصلة)</label>
            <input
              type="text"
              value={form.notify_employees}
              onChange={e => setForm(p => ({ ...p, notify_employees: e.target.value }))}
              placeholder="1023, 1045, 1088"
              className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-yellow-500 placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Notification Settings */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2">
          <p className="text-[10px] text-slate-400 font-semibold">🔔 إعدادات الإشعارات</p>

          {/* Severity filter */}
          <div>
            <p className="text-[9px] text-slate-500 mb-1">أرسل إشعار عند</p>
            <div className="grid grid-cols-3 gap-1">
              {([
                ['all',          'كل الأحداث'],
                ['warning_up',   'تحذير فأعلى'],
                ['critical_only','حرج فقط'],
              ] as const).map(([v, label]) => (
                <button key={v} onClick={() => setForm(p => ({ ...p, notify_severity: v }))}
                  className={`py-1 rounded text-[9px] border transition-colors ${
                    form.notify_severity === v
                      ? 'bg-blue-800/60 border-blue-500 text-blue-200'
                      : 'bg-slate-800/60 border-slate-700/40 text-slate-400 hover:border-slate-500'
                  }`}>{label}</button>
              ))}
            </div>
          </div>

          {/* Role checkboxes */}
          <div>
            <p className="text-[9px] text-slate-500 mb-1">أرسل Push للأدوار</p>
            <div className="grid grid-cols-2 gap-x-2 gap-y-1">
              {([
                ['admin',          '👑 مدير النظام'],
                ['owner',          '🏛 المالك'],
                ['manager',        '📋 مدير'],
                ['supervisor',     '🔍 مشرف'],
                ['gis_supervisor', '🛰 مشرف GIS'],
                ['engineer',       '⚙️ مهندس'],
                ['employee',       '👷 موظف'],
              ] as [string, string][]).map(([role, label]) => (
                <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                  <div onClick={() => setForm(p => ({ ...p, notify_roles: { ...p.notify_roles, [role]: !p.notify_roles[role] } }))}
                    className={`w-3.5 h-3.5 rounded border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                      form.notify_roles[role] ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-600'
                    }`}>
                    {form.notify_roles[role] && <CheckCircle2 size={8} className="text-white" />}
                  </div>
                  <span className="text-[9px] text-slate-300 select-none">{label}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <div>
            <label className="text-[9px] text-slate-500 block mb-0.5">منطقة الحرم (متر من المحور)</label>
            <div className="flex items-center gap-2">
              <input type="range" min={10} max={500} step={10} value={form.buffer_m}
                onChange={e => setForm(p => ({ ...p, buffer_m: Number(e.target.value) }))}
                className="flex-1 accent-yellow-400" />
              <span className="text-[11px] font-bold text-yellow-300 w-12 text-center">{form.buffer_m}م</span>
            </div>
          </div>
        </div>

        {/* Sensitivity */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1.5">
          <p className="text-[10px] text-slate-400 font-semibold">حساسية الكشف</p>
          <div className="grid grid-cols-3 gap-1">
            {(['low', 'medium', 'high'] as const).map(s => (
              <button key={s} onClick={() => setForm(p => ({ ...p, sensitivity: s }))}
                className={`py-1 rounded text-[10px] border transition-colors ${
                  form.sensitivity === s
                    ? 'bg-yellow-700/50 border-yellow-500 text-yellow-200'
                    : 'bg-slate-800/60 border-slate-700/40 text-slate-300 hover:border-slate-500'
                }`}>
                {s === 'low' ? 'منخفضة' : s === 'medium' ? 'متوسطة' : 'عالية'}
              </button>
            ))}
          </div>
        </div>

        {/* Alert types — grouped */}
        <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-2.5">
          <p className="text-[10px] text-slate-400 font-semibold">أنواع التنبيهات</p>
          {ALERT_TYPE_GROUPS.map(group => (
            <div key={group.label}>
              <p className={`text-[9px] font-bold mb-1 ${group.color}`}>{group.label}</p>
              <div className="space-y-1 pr-1">
                {group.types.map(k => {
                  const m = ALERT_TYPE_META[k];
                  return (
                    <label key={k} className="flex items-center gap-2 cursor-pointer">
                      <div onClick={() => setForm(p => ({ ...p, alert_types: { ...p.alert_types, [k]: !p.alert_types[k] } }))}
                        className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors shrink-0 ${
                          form.alert_types[k] ? 'bg-yellow-600 border-yellow-500' : 'bg-slate-800 border-slate-600'
                        }`}>
                        {form.alert_types[k] && <CheckCircle2 size={9} className="text-white" />}
                      </div>
                      <span className="text-[11px]">{m.icon}</span>
                      <span className={`text-[10px] ${m.color} select-none`}>{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
            <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-rose-300">{error}</p>
          </div>
        )}

        <button onClick={handleCreate}
          className="w-full py-2 rounded-lg bg-yellow-700 hover:bg-yellow-600 text-white text-[11px] font-bold flex items-center justify-center gap-2 transition-colors">
          <BellRing size={13} /> حفظ التنبيه
        </button>
      </div>
    );
  }

  // ── Render: Results ────────────────────────────────────────────────────────
  if (mode === 'results' && checkResult) {
    const { summary, events, metadata } = checkResult;
    return (
      <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
        <div className="flex items-center gap-2">
          <BellRing size={14} className="text-yellow-400 shrink-0" />
          <span className="text-[12px] font-bold text-slate-200">نتائج الفحص</span>
          <div className="flex items-center gap-1 mr-auto">
            <button onClick={handleToggleMap}
              className="flex items-center gap-1 text-[9px] text-slate-400 hover:text-slate-200 px-1.5 py-0.5 rounded border border-slate-700 transition-colors">
              {showOnMap ? <Eye size={9} /> : <EyeOff size={9} />}
            </button>
            <button onClick={() => { setMode('list'); onResultReady(null); }}
              className="text-slate-500 hover:text-slate-300 text-[11px]">← رجوع</button>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className={`rounded-lg border text-center py-2 ${summary.critical_count > 0 ? 'border-red-700/50 bg-red-900/20' : 'border-slate-700/40 bg-slate-800/30'}`}>
            <div className={`text-[18px] font-black ${summary.critical_count > 0 ? 'text-red-300' : 'text-slate-500'}`}>{summary.critical_count}</div>
            <div className="text-[9px] text-slate-500">حرج</div>
          </div>
          <div className={`rounded-lg border text-center py-2 ${summary.warning_count > 0 ? 'border-amber-700/50 bg-amber-900/20' : 'border-slate-700/40 bg-slate-800/30'}`}>
            <div className={`text-[18px] font-black ${summary.warning_count > 0 ? 'text-amber-300' : 'text-slate-500'}`}>{summary.warning_count}</div>
            <div className="text-[9px] text-slate-500">تحذير</div>
          </div>
          <div className="rounded-lg border border-slate-700/40 bg-slate-800/30 text-center py-2">
            <div className="text-[18px] font-black text-slate-300">{summary.total_events}</div>
            <div className="text-[9px] text-slate-500">إجمالي</div>
          </div>
        </div>

        {/* Sensor note + image quality */}
        <div className="rounded-lg border border-slate-700/30 bg-slate-900/40 px-2.5 py-2 space-y-1">
          <p className="text-[9px] text-slate-400 leading-relaxed">🛰 {metadata.sensor_note}</p>
          {metadata.image_quality?.ssim_enhanced != null && (
            <p className="text-[9px] text-slate-500">
              تشابه الصورتين: <span className="text-slate-300">{Math.round(metadata.image_quality.ssim_enhanced * 100)}%</span>
              {' · '}تغيير عام: <span className={`${(metadata.image_quality.overall_change_pct ?? 0) > 20 ? 'text-amber-400' : 'text-emerald-400'}`}>{metadata.image_quality.overall_change_pct ?? 0}%</span>
            </p>
          )}
          {(metadata.analysis_notes?.length ?? 0) > 0 && (
            <details className="mt-0.5">
              <summary className="text-[8px] text-slate-600 cursor-pointer hover:text-slate-400">سجل التحليل</summary>
              <div className="mt-1 space-y-0.5">
                {metadata.analysis_notes!.map((n, i) => (
                  <p key={i} className="text-[8px] text-slate-500">{n}</p>
                ))}
              </div>
            </details>
          )}
        </div>

        {/* Events list */}
        {events.length === 0 ? (
          <div className="rounded-lg border border-emerald-700/30 bg-emerald-900/15 px-3 py-4 text-center">
            <CheckCircle2 size={20} className="text-emerald-400 mx-auto mb-1.5" />
            <p className="text-[10px] text-emerald-300 font-semibold">الحرم نظيف</p>
            <p className="text-[9px] text-slate-500 mt-0.5">لا توجد تغييرات مرصودة في هذه الفترة</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            {events.map(evt => {
              const meta = ALERT_TYPE_META[evt.alert_type];
              const SevIcon = SEV_ICON[evt.severity];
              const isOpen = expandedEvt === evt.id;
              return (
                <div key={evt.id} className={`rounded-lg border overflow-hidden ${SEV_STYLE[evt.severity]}`}>
                  <button onClick={() => setExpandedEvt(p => p === evt.id ? null : evt.id)}
                    className="w-full flex items-center gap-2 px-2.5 py-2 text-right hover:bg-white/5 transition-colors">
                    <SevIcon size={11} className="shrink-0" />
                    <span className="text-[11px]">{meta.icon}</span>
                    <span className="text-[10px] font-medium flex-1">{meta.label}</span>
                    <span className="text-[9px] opacity-70">{evt.confidence}٪</span>
                    {isOpen ? <ChevronUp size={9} className="opacity-50" /> : <ChevronDown size={9} className="opacity-50" />}
                  </button>
                  {isOpen && (
                    <div className="px-3 pb-2.5 space-y-1.5 bg-black/20">
                      <p className="text-[9px] opacity-80 leading-relaxed">{evt.description_ar}</p>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] opacity-60">
                        <span>المساحة: <strong className="opacity-100">{evt.area_m2} م²</strong></span>
                        <span>التغيير: <strong className="opacity-100">{evt.change_pct}٪</strong></span>
                        <span>خط العرض: <strong className="opacity-100">{evt.location.lat.toFixed(4)}°</strong></span>
                        <span>خط الطول: <strong className="opacity-100">{evt.location.lon.toFixed(4)}°</strong></span>
                      </div>
                      {/* فترة التغيير */}
                      {checkResult?.date_before && checkResult?.date_after && (
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-400 bg-slate-800/40 rounded px-2 py-1">
                          <CalendarDays size={9} className="shrink-0 text-cyan-400" />
                          <span>فترة الرصد: </span>
                          <span className="font-mono text-cyan-300">{checkResult.date_before}</span>
                          <span>←</span>
                          <span className="font-mono text-cyan-300">{checkResult.date_after}</span>
                        </div>
                      )}
                      {/* زر الطيران للموقع */}
                      {evt.location.lon !== 0 && evt.location.lat !== 0 && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onFlyTo?.(evt.location.lon, evt.location.lat, 15); }}
                          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded bg-cyan-700/40 hover:bg-cyan-600/50 border border-cyan-600/40 text-cyan-200 text-[10px] font-semibold transition-colors"
                        >
                          <Navigation2 size={10} className="shrink-0" />
                          عرض على الخريطة
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Render: List ──────────────────────────────────────────────────────────
  return (
    <div className="h-full overflow-y-auto p-3 space-y-3" dir="rtl">
      {/* Header */}
      <div className="flex items-center gap-2">
        <Bell size={14} className="text-yellow-400 shrink-0" />
        <span className="text-[12px] font-bold text-slate-200">التنبيهات الذكية</span>
        <button onClick={() => { setMode('create'); setError(null); }}
          className="mr-auto flex items-center gap-1 text-[10px] px-2 py-1 rounded bg-yellow-800/50 border border-yellow-700/50 text-yellow-200 hover:bg-yellow-700/50 transition-colors">
          + جديد
        </button>
      </div>

      {/* Scene selector */}
      <div className="rounded-lg border border-slate-700/50 bg-slate-800/40 p-2.5 space-y-1">
        <p className="text-[9px] text-slate-500">الصورة الحالية للمقارنة</p>
        <select value={selectedSceneUid} onChange={e => setSelectedSceneUid(e.target.value)}
          className="w-full bg-slate-800 border border-slate-700 rounded text-[10px] text-slate-200 px-2 py-1.5 focus:outline-none focus:border-yellow-500">
          {scenes.map(s => (
            <option key={s.scene_uid} value={s.scene_uid}>
              {s.acquisition_date ?? s.scene_uid.slice(0, 24)}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-700/40 bg-rose-950/30 px-3 py-2 flex items-start gap-2">
          <AlertCircle size={12} className="text-rose-400 shrink-0 mt-0.5" />
          <p className="text-[10px] text-rose-300">{error}</p>
        </div>
      )}

      {/* No alerts state */}
      {alerts.length === 0 && (
        <div className="rounded-lg border border-slate-700/40 bg-slate-800/20 px-3 py-6 text-center">
          <Bell size={20} className="text-slate-600 mx-auto mb-1.5" />
          <p className="text-[10px] text-slate-500">لا توجد تنبيهات محفوظة</p>
          <p className="text-[9px] text-slate-600 mt-0.5">ارسم حرم مسار على الخريطة ثم أنشئ تنبيهاً</p>
        </div>
      )}

      {/* Alert cards */}
      {alerts.map(def => (
        <div key={def.id} className="rounded-lg border border-slate-700/50 bg-slate-800/30 overflow-hidden">
          <div className="flex items-start gap-2 px-2.5 py-2">
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-slate-200 truncate">{def.name}</p>
              <p className="text-[9px] text-slate-500 truncate">{def.corridor_name}</p>
              <div className="flex flex-wrap gap-1 mt-1">
                {def.alert_types.map(t => (
                  <span key={t} className="text-[8px] px-1 rounded bg-slate-700/60 text-slate-400">
                    {ALERT_TYPE_META[t].icon} {ALERT_TYPE_META[t].label}
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 shrink-0">
              <button onClick={() => handleCheck(def)} disabled={loading}
                className="flex items-center gap-1 px-2 py-1 rounded bg-yellow-800/60 hover:bg-yellow-700/60 border border-yellow-700/50 text-yellow-200 text-[9px] transition-colors disabled:opacity-40">
                {loading && activeAlert?.id === def.id
                  ? <Loader2 size={9} className="animate-spin" />
                  : <Zap size={9} />}
                فحص
              </button>
              <button onClick={() => handleDelete(def.id)}
                className="flex items-center gap-1 px-2 py-1 rounded bg-slate-800/60 hover:bg-rose-900/40 border border-slate-700/40 text-slate-500 hover:text-rose-400 text-[9px] transition-colors">
                <Trash2 size={9} /> حذف
              </button>
            </div>
          </div>
          <div className="px-2.5 pb-2 flex items-center gap-3 text-[8px] text-slate-600">
            <span><MapPin size={7} className="inline ml-0.5" />{def.polygon.length} نقطة</span>
            <span>عازل {def.buffer_m}م</span>
            <span>حساسية: {def.sensitivity === 'low' ? 'منخفضة' : def.sensitivity === 'medium' ? 'متوسطة' : 'عالية'}</span>
          </div>
        </div>
      ))}

      {/* Intro tip */}
      <div className="rounded-lg border border-slate-700/30 bg-slate-900/20 p-2.5 space-y-1">
        <p className="text-[9px] text-slate-500 font-semibold">كيفية الاستخدام:</p>
        <p className="text-[9px] text-slate-600 leading-relaxed">١. ارسم حرم مسار الأنبوب على الخريطة</p>
        <p className="text-[9px] text-slate-600 leading-relaxed">٢. أنشئ تنبيهاً وحدد أنواع الكشف</p>
        <p className="text-[9px] text-slate-600 leading-relaxed">٣. اضغط "فحص" لمقارنة آخر صورة فضائية</p>
        <p className="text-[9px] text-slate-600 leading-relaxed">٤. النتائج تظهر على الخريطة ملوّنة حسب الشدة</p>
      </div>
    </div>
  );
}
