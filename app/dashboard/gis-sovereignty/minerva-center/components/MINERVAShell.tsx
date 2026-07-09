'use client';
/**
 * MINERVA Shell v3 — Full Spatial Intelligence Center
 * First question: "ماذا تريد أن تحلل؟"
 * Then: Map + Reports
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import {
  Brain, Play, RefreshCw, AlertTriangle, CheckCircle2, MapPin, FileText,
  Eye, BarChart2, ChevronDown, ChevronUp, ArrowRight, DollarSign, Zap,
  TrendingUp, Clock, Download, Activity, Target, HelpCircle, ChevronRight,
  ChevronLeft, Layers, Crosshair, Square, Circle, Minus, MousePointer,
  Upload, Database, Map, Building2, Edit3, X, Sliders, Shield, Droplets,
  Flame, Bolt, Anchor, TreePine, Factory, Radio
} from 'lucide-react';
import type { MINERVAMapHandle, DrawMode, LayerVisibility, AnomalyPoint } from './MINERVAMap';

const MINERVAMap = dynamic(() => import('./MINERVAMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-slate-900/60">
      <span className="text-slate-500 text-sm flex items-center gap-2"><RefreshCw className="w-4 h-4 animate-spin"/>تحميل الخريطة...</span>
    </div>
  ),
});

/* ─── Asset Types (comprehensive) ─────────────────────────────────────────── */
const ASSET_TYPES = [
  { value:'WATER_PIPELINE_MAIN',   label:'خط مياه رئيسي',          color:'#3b82f6', buffer:50,  icon:'💧', group:'مياه' },
  { value:'WATER_PIPELINE_DIST',   label:'شبكة توزيع مياه',        color:'#60a5fa', buffer:20,  icon:'💧', group:'مياه' },
  { value:'WATER_STATION',         label:'محطة مياه',               color:'#0ea5e9', buffer:80,  icon:'🏭', group:'مياه' },
  { value:'OIL_PIPELINE_MAIN',     label:'خط نفط رئيسي',           color:'#f97316', buffer:100, icon:'🛢️', group:'نفط وغاز' },
  { value:'GAS_PIPELINE',          label:'خط غاز طبيعي',           color:'#a855f7', buffer:100, icon:'🔥', group:'نفط وغاز' },
  { value:'OIL_FACILITY',          label:'منشأة نفطية',             color:'#fb923c', buffer:200, icon:'⚙️', group:'نفط وغاز' },
  { value:'POWER_LINE_HV',         label:'خط كهرباء ضغط عالي',     color:'#eab308', buffer:30,  icon:'⚡', group:'كهرباء' },
  { value:'POWER_LINE_MV',         label:'خط كهرباء ضغط متوسط',    color:'#fbbf24', buffer:15,  icon:'⚡', group:'كهرباء' },
  { value:'SUBSTATION',            label:'محطة تحويل كهرباء',       color:'#d97706', buffer:50,  icon:'🔌', group:'كهرباء' },
  { value:'ROAD_PRIMARY',          label:'طريق رئيسي',              color:'#64748b', buffer:10,  icon:'🛣️', group:'نقل' },
  { value:'ROAD_SECONDARY',        label:'طريق فرعي',               color:'#94a3b8', buffer:5,   icon:'🛤️', group:'نقل' },
  { value:'BRIDGE_TUNNEL',         label:'جسر أو نفق',              color:'#78716c', buffer:30,  icon:'🌉', group:'نقل' },
  { value:'DAM_RESERVOIR',         label:'سد أو خزان',              color:'#06b6d4', buffer:200, icon:'🏞️', group:'مياه' },
  { value:'COASTAL_STRUCTURE',     label:'منشأة ساحلية',            color:'#0284c7', buffer:150, icon:'⚓', group:'ساحلي' },
  { value:'TELECOM_LINE',          label:'خط اتصالات',              color:'#8b5cf6', buffer:10,  icon:'📡', group:'اتصالات' },
  { value:'CRITICAL_BUILDING',     label:'مبنى حيوي',               color:'#ef4444', buffer:30,  icon:'🏛️', group:'منشآت' },
  { value:'INDUSTRIAL_FACILITY',   label:'منشأة صناعية',            color:'#f43f5e', buffer:100, icon:'🏗️', group:'منشآت' },
  { value:'AGRICULTURAL_AREA',     label:'منطقة زراعية',            color:'#22c55e', buffer:50,  icon:'🌱', group:'زراعي' },
  { value:'CUSTOM_AREA',           label:'منطقة مخصصة',            color:'#e2e8f0', buffer:30,  icon:'📍', group:'أخرى' },
];

/* ─── Setup Wizard ────────────────────────────────────────────────────────── */
type SetupStep = 'what' | 'asset-select' | 'draw-map' | 'upload' | 'admin-area' | 'configure';
type AnalysisMode = 'existing-asset' | 'draw-area' | 'map-click' | 'upload-gis' | 'admin-area';

const SETUP_OPTIONS: { id: AnalysisMode; icon: React.ElementType; label: string; desc: string; color: string }[] = [
  { id:'existing-asset', icon:Database,    label:'اختيار أصل موجود',   desc:'ابحث في قاعدة بيانات الأصول',          color:'text-blue-300 border-blue-500/40 bg-blue-500/8' },
  { id:'draw-area',      icon:Square,      label:'رسم منطقة',           desc:'ارسم المنطقة مباشرة على الخريطة',       color:'text-emerald-300 border-emerald-500/40 bg-emerald-500/8' },
  { id:'map-click',      icon:Crosshair,   label:'اختيار من الخريطة',  desc:'انقر على الخريطة لتحديد الموقع',        color:'text-violet-300 border-violet-500/40 bg-violet-500/8' },
  { id:'upload-gis',     icon:Upload,      label:'رفع ملف GIS',         desc:'GeoJSON, KML, Shapefile',               color:'text-amber-300 border-amber-500/40 bg-amber-500/8' },
  { id:'admin-area',     icon:Building2,   label:'منطقة إدارية',        desc:'اختر من المناطق الإدارية المعروفة',     color:'text-rose-300 border-rose-500/40 bg-rose-500/8' },
];

const ADMIN_AREAS = [
  { name:'طرابلس الكبرى',   lat:32.89, lon:13.18 },
  { name:'بنغازي',          lat:32.12, lon:20.07 },
  { name:'مصراتة',          lat:32.38, lon:15.09 },
  { name:'الزاوية',         lat:32.75, lon:12.73 },
  { name:'الخمس',           lat:32.64, lon:14.27 },
  { name:'صبراتة',          lat:32.79, lon:12.49 },
  { name:'زليتن',           lat:32.47, lon:14.57 },
  { name:'الجبل الأخضر',   lat:32.79, lon:21.70 },
];

/* ─── Main types ────────────────────────────────────────────────────────────── */
interface MINERVAResult {
  ok:boolean; asset_id:string; asset_type:string; analysis_date:string;
  peak:{ date:string; anomaly_score:number; severity:string; z_scores:Record<string,number>; context:string; precipitation_30d:number; precipitation_7d:number; };
  diagnosis:{ winner_event:string; winner_probability:number; confidence_level:string; evidence_completeness:number; causal_alignment:number; is_unknown:boolean; supporting_evidence:string[]; refuting_evidence:string[]; missing_evidence:string[]; all_hypotheses:{event:string;probability:number}[]; counterfactual:string; recommendation:string; field_priority:string; };
  hypothesis_competition:Array<{event:string;probability:number;prior:number;supporting:number;refuting:number;causal_alignment:number}>;
  root_cause:{ most_probable:string; confidence:string; causes:Array<{id:string;description:string;probability:number;factors:string[]}>; next_events:Array<{event:string;probability:number;timeframe_months:[number,number];reason:string}>; prevention:string[]; };
  decision:{ do_nothing_loss_usd:number; best_action:string; best_voi_usd:number; actions:Array<{id:string;description:string;cost_usd:number;voi_usd:number;confidence_gain:number;recommendation:string}>; };
  missing_evidence:{ items:Array<{evidence_id:string;gain:number;cheapest_source:string;cost_usd:number;reason:string}>; projected_confidence:number; };
  timeline:Array<{date:string;score:number;severity:string;is_event:boolean;z_scores:Record<string,number>}>;
  signal_stats:Record<string,{mean:number;std:number;min:number;max:number}>;
  baseline_cells:number; training_observations:number;
}

interface Params { lat:number; lon:number; asset_type:string; asset_id:string; buffer_m:number; }

type ViewMode = 'executive' | 'expert' | 'timeline' | 'decision';

const EVENT_AR: Record<string,string> = {
  WATER_LEAK:'تسرب مياه محتمل', IRRIGATION_EFFECT:'تأثير ري زراعي',
  NATURAL_RAIN_EFFECT:'تأثير هطول مطري', MAINTENANCE_SPILLAGE:'رش مياه (صيانة)',
  SUBSIDENCE:'هبوط أرض', EXCAVATION_DAMAGE:'حفر أو أعمال قريبة',
  DATA_ERROR:'خطأ في الاستشعار', OIL_SPILL:'تسرب نفط',
};
const RC_AR: Record<string,string> = {
  RC_PIPE_AGING:'تقادم الأنبوب', RC_CORROSION:'تآكل الأنبوب',
  RC_THIRD_PARTY_DMG:'ضرر طرف ثالث', RC_HIGH_PRESSURE:'ضغط مرتفع',
  RC_SOIL_MOVEMENT:'حركة التربة', RC_MANUFACTURING_DEFECT:'عيب تصنيعي',
};
const PRIORITY: Record<string,{bg:string;border:string;text:string;label:string;days:string}> = {
  CRITICAL:{ bg:'bg-red-500/15',    border:'border-red-500/50',    text:'text-red-300',    label:'حرج',    days:'فوري — 24 ساعة' },
  HIGH:    { bg:'bg-orange-500/15', border:'border-orange-500/50', text:'text-orange-300', label:'عالي',   days:'48 ساعة' },
  MEDIUM:  { bg:'bg-yellow-500/15', border:'border-yellow-500/50', text:'text-yellow-300', label:'متوسط',  days:'7 أيام' },
  LOW:     { bg:'bg-slate-500/15',  border:'border-slate-500/50',  text:'text-slate-400',  label:'منخفض',  days:'30 يومًا' },
  WATCH:   { bg:'bg-blue-500/15',   border:'border-blue-500/50',   text:'text-blue-300',   label:'مراقبة', days:'مستمر' },
};

/* ─── Layer Manager ──────────────────────────────────────────────────────── */
function LayerManager({ layers, onChange }: { layers:LayerVisibility; onChange:(k:keyof LayerVisibility,v:boolean)=>void }) {
  const ITEMS: { key:keyof LayerVisibility; label:string; color:string }[] = [
    { key:'pipeline', label:'خط الأصل',   color:'bg-blue-400' },
    { key:'buffer',   label:'حرم الأصل',  color:'bg-blue-400/40' },
    { key:'anomalies',label:'الشذوذات',   color:'bg-orange-400' },
    { key:'labels',   label:'التسميات',   color:'bg-slate-400' },
  ];
  return (
    <div className="bg-slate-950/90 border border-slate-700/50 rounded-xl p-3 shadow-xl backdrop-blur-sm">
      <p className="text-xs font-semibold text-slate-400 mb-2 flex items-center gap-1.5"><Layers className="w-3.5 h-3.5"/>الطبقات</p>
      {ITEMS.map(({key,label,color}) => (
        <label key={key} className="flex items-center gap-2 cursor-pointer mb-1.5 last:mb-0">
          <div className={`w-3 h-3 rounded-sm ${color} shrink-0`}/>
          <span className="text-xs text-slate-300 flex-1">{label}</span>
          <div onClick={()=>onChange(key,!layers[key])}
            className={`w-8 h-4 rounded-full transition-all cursor-pointer ${layers[key]?'bg-blue-600':'bg-slate-700'}`}>
            <div className={`w-3 h-3 bg-white rounded-full m-0.5 transition-all ${layers[key]?'translate-x-4':''}`}/>
          </div>
        </label>
      ))}
    </div>
  );
}

/* ─── Drawing Toolbar ─────────────────────────────────────────────────────── */
function DrawToolbar({ mode, onMode, onClear }: { mode:DrawMode; onMode:(m:DrawMode)=>void; onClear:()=>void }) {
  const TOOLS: { id:DrawMode; icon:React.ElementType; label:string }[] = [
    { id:'none',      icon:MousePointer, label:'تحديد' },
    { id:'point',     icon:MapPin,       label:'نقطة' },
    { id:'rectangle', icon:Square,       label:'مستطيل' },
    { id:'circle',    icon:Circle,       label:'دائرة' },
    { id:'line',      icon:Minus,        label:'خط' },
  ];
  return (
    <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-700/50 rounded-xl p-1.5 shadow-xl backdrop-blur-sm">
      {TOOLS.map(({id,icon:Icon,label}) => (
        <button key={id} onClick={()=>onMode(id)} title={label}
          className={`p-1.5 rounded-lg transition-all ${mode===id?'bg-blue-600 text-white':'text-slate-400 hover:text-slate-200 hover:bg-slate-800'}`}>
          <Icon className="w-3.5 h-3.5"/>
        </button>
      ))}
      <div className="w-px h-4 bg-slate-700 mx-0.5"/>
      <button onClick={onClear} title="مسح" className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-all">
        <X className="w-3.5 h-3.5"/>
      </button>
    </div>
  );
}

/* ─── Setup Wizard ────────────────────────────────────────────────────────── */
function SetupWizard({ onComplete, mapRef }: {
  onComplete:(params:Params,mode:AnalysisMode)=>void;
  mapRef:React.RefObject<MINERVAMapHandle>;
}) {
  const [step, setStep]   = useState<SetupStep>('what');
  const [mode, setMode]   = useState<AnalysisMode>('existing-asset');
  const [assetType, setAssetType] = useState(ASSET_TYPES[0]);
  const [assetId, setAssetId] = useState('PIPE-WTR-TEST-001');
  const [lat, setLat]     = useState(32.89);
  const [lon, setLon]     = useState(13.18);
  const [bufferM, setBufM]= useState(50);
  const fileRef           = useRef<HTMLInputElement>(null);

  const assetMeta = ASSET_TYPES.find(a => a.value === assetType.value) ?? ASSET_TYPES[0];

  function confirm() {
    onComplete({ lat, lon, asset_type: assetType.value, asset_id: assetId, buffer_m: bufferM }, mode);
  }

  // Group asset types
  const groups = [...new Set(ASSET_TYPES.map(a => a.group))];

  if (step === 'what') return (
    <div className="h-full flex flex-col items-center justify-center p-6 bg-slate-950" dir="rtl">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/40 flex items-center justify-center">
            <Brain className="w-5 h-5 text-blue-400"/>
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">MINERVA</h1>
            <p className="text-xs text-slate-500">Spatial Intelligence Center</p>
          </div>
          <span className="mr-auto text-xs px-2 py-0.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400">تجريبي</span>
        </div>

        <h2 className="text-2xl font-bold text-white mb-2">ماذا تريد أن تحلل؟</h2>
        <p className="text-slate-500 text-sm mb-6">اختر طريقة تحديد منطقة الدراسة أو الأصل المستهدف</p>

        <div className="space-y-2.5">
          {SETUP_OPTIONS.map(({id,icon:Icon,label,desc,color}) => (
            <button key={id} onClick={()=>{ setMode(id);
              if(id==='existing-asset')setStep('asset-select');
              else if(id==='draw-area')setStep('configure');
              else if(id==='map-click')setStep('configure');
              else if(id==='upload-gis')setStep('upload');
              else setStep('admin-area');
            }}
              className={`w-full flex items-center gap-4 p-4 rounded-2xl border ${color} hover:opacity-90 transition-all text-right`}>
              <div className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-5 h-5"/>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-white">{label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
              </div>
              <ChevronLeft className="w-4 h-4 text-slate-600 shrink-0"/>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (step === 'asset-select') return (
    <div className="h-full flex flex-col bg-slate-950 p-5" dir="rtl">
      <button onClick={()=>setStep('what')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-5 transition-colors">
        <ChevronRight className="w-4 h-4"/>رجوع
      </button>
      <h2 className="text-lg font-bold text-white mb-1">اختيار نوع الأصل</h2>
      <p className="text-slate-500 text-xs mb-4">اختر نوع البنية التحتية التي تريد تحليلها</p>

      <div className="flex-1 overflow-y-auto space-y-4">
        {groups.map(group => (
          <div key={group}>
            <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-2">{group}</p>
            <div className="grid grid-cols-1 gap-1.5">
              {ASSET_TYPES.filter(a => a.group === group).map(at => (
                <button key={at.value} onClick={()=>{setAssetType(at);setBufM(at.buffer);setStep('configure');}}
                  className={`flex items-center gap-3 p-3 rounded-xl border text-right transition-all
                    ${assetType.value===at.value?'border-blue-500/50 bg-blue-500/10':'border-slate-700/50 bg-slate-900/40 hover:border-slate-600'}`}>
                  <span className="text-lg w-8 text-center">{at.icon}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-200">{at.label}</p>
                    <p className="text-xs text-slate-500">حرم: {at.buffer}م</p>
                  </div>
                  <div className="w-3 h-3 rounded-full shrink-0" style={{background:at.color}}/>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (step === 'admin-area') return (
    <div className="h-full flex flex-col bg-slate-950 p-5" dir="rtl">
      <button onClick={()=>setStep('what')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-5 transition-colors">
        <ChevronRight className="w-4 h-4"/>رجوع
      </button>
      <h2 className="text-lg font-bold text-white mb-4">اختيار منطقة إدارية</h2>
      <div className="grid grid-cols-2 gap-2">
        {ADMIN_AREAS.map(area => (
          <button key={area.name} onClick={()=>{setLat(area.lat);setLon(area.lon);setStep('configure');}}
            className="p-3 rounded-xl border border-slate-700/50 bg-slate-900/40 hover:border-blue-500/40 text-right transition-all">
            <MapPin className="w-4 h-4 text-blue-400 mb-1"/>
            <p className="text-sm font-medium text-slate-200">{area.name}</p>
          </button>
        ))}
      </div>
    </div>
  );

  if (step === 'upload') return (
    <div className="h-full flex flex-col items-center justify-center bg-slate-950 p-6" dir="rtl">
      <button onClick={()=>setStep('what')} className="self-start flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-6 transition-colors">
        <ChevronRight className="w-4 h-4"/>رجوع
      </button>
      <div className="text-center max-w-sm">
        <Upload className="w-12 h-12 text-amber-400 mx-auto mb-3"/>
        <h2 className="text-lg font-bold text-white mb-1">رفع ملف GIS</h2>
        <p className="text-slate-500 text-sm mb-4">GeoJSON, KML, أو Shapefile ZIP</p>
        <input ref={fileRef} type="file" accept=".geojson,.json,.kml,.zip" className="hidden"
          onChange={e=>{
            const file=e.target.files?.[0];if(!file)return;
            const reader=new FileReader();
            reader.onload=ev=>{
              try{
                let gj=JSON.parse(ev.target?.result as string);
                mapRef.current?.loadGeoJSON(gj);
                // Extract center from GeoJSON
                setStep('configure');
              }catch{alert('الملف غير صالح — يرجى استخدام GeoJSON صحيح');}
            };
            reader.readAsText(file);
          }}/>
        <button onClick={()=>fileRef.current?.click()}
          className="w-full py-3 rounded-xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 text-amber-300 hover:border-amber-400 transition-all text-sm font-semibold mb-3">
          اختر ملفًا
        </button>
        <p className="text-xs text-slate-600">الحجم الأقصى: 10MB</p>
      </div>
    </div>
  );

  // Configure step (final before analysis)
  return (
    <div className="h-full flex flex-col bg-slate-950 p-5 overflow-y-auto" dir="rtl">
      <button onClick={()=>setStep('what')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-300 mb-4 transition-colors shrink-0">
        <ChevronRight className="w-4 h-4"/>رجوع
      </button>
      <h2 className="text-lg font-bold text-white mb-1 shrink-0">إعداد التحليل</h2>
      <p className="text-slate-500 text-xs mb-5 shrink-0">اضبط معاملات الدراسة</p>

      <div className="space-y-4">
        {/* Asset type summary */}
        <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-700/50 bg-slate-900/40">
          <span className="text-2xl">{assetMeta.icon}</span>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-200">{assetMeta.label}</p>
            <p className="text-xs text-slate-500">نوع الأصل</p>
          </div>
          <button onClick={()=>setStep('asset-select')} className="text-xs text-blue-400 hover:text-blue-300">تغيير</button>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1">معرّف الأصل</label>
          <input type="text" value={assetId} onChange={e=>setAssetId(e.target.value)}
            className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500/60"/>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-slate-500 mb-1">خط العرض</label>
            <input type="number" step="0.001" value={lat} onChange={e=>setLat(parseFloat(e.target.value)||0)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"/>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">خط الطول</label>
            <input type="number" step="0.001" value={lon} onChange={e=>setLon(parseFloat(e.target.value)||0)}
              className="w-full bg-slate-800/80 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500/60"/>
          </div>
        </div>

        <div>
          <label className="block text-xs text-slate-500 mb-1.5 flex items-center justify-between">
            <span>عرض الحرم: <b className="text-slate-300">{bufferM} متر</b></span>
            <span className="text-slate-600">المعيار: {assetMeta.buffer}م</span>
          </label>
          <input type="range" min={10} max={500} step={10} value={bufferM} onChange={e=>setBufM(Number(e.target.value))}
            className="w-full accent-blue-500 h-1.5 cursor-pointer"/>
          <div className="flex justify-between text-xs text-slate-600 mt-0.5">
            <span>10م</span><span>500م</span>
          </div>
        </div>

        <div className="bg-slate-900/60 rounded-xl p-3 border border-slate-700/40 text-xs text-slate-500">
          <p className="font-semibold text-slate-400 mb-1.5">مصادر البيانات المستخدمة:</p>
          {['بيانات الطقس الحقيقية (Open-Meteo)','NDMI / NDVI (Sentinel-2)','SAR Backscatter (Sentinel-1)','درجة حرارة السطح (Landsat-9)'].map(s=>(
            <p key={s} className="flex items-center gap-1.5 mb-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"/>{s}</p>
          ))}
        </div>

        <button onClick={confirm}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-sm font-bold text-white transition-all flex items-center justify-center gap-2">
          <Brain className="w-4 h-4"/>بدء تحليل MINERVA
        </button>
      </div>
    </div>
  );
}

/* ─── Headline Card ───────────────────────────────────────────────────────── */
function HeadlineCard({ r, onShowMap }: { r:MINERVAResult; onShowMap:()=>void }) {
  const d=r.diagnosis; const rc=r.root_cause;
  const pc=PRIORITY[d.field_priority]??PRIORITY.MEDIUM;
  const ev=EVENT_AR[d.winner_event]??d.winner_event;
  const rcl=RC_AR[rc.most_probable]??rc.most_probable;
  const pct=Math.round(d.winner_probability*100);
  return (
    <div className={`rounded-2xl border ${pc.border} ${pc.bg} px-4 py-3 backdrop-blur-sm`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-4 h-4 ${pc.text} shrink-0 mt-0.5`}/>
        <div className="flex-1 min-w-0">
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${pc.border} ${pc.bg} ${pc.text} mr-2`}>{pc.label}</span>
          <span className="text-xs text-slate-500">{r.analysis_date}</span>
          <p className="text-sm text-slate-100 leading-snug mt-1 font-medium">
            تم رصد <b className={pc.text}>{ev}</b> عند <b className="text-slate-300">{r.asset_id}</b>.{' '}
            السبب الأرجح: <b className="text-slate-200">{rcl}</b> ({pct}%).
          </p>
          <p className={`text-xs ${pc.text} flex items-center gap-1 mt-1`}>
            <ArrowRight className="w-3 h-3 shrink-0"/>{d.recommendation}
          </p>
        </div>
        <button onClick={onShowMap}
          className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-semibold hover:bg-blue-600/30 transition-all">
          <MapPin className="w-3.5 h-3.5"/>الخريطة
        </button>
      </div>
    </div>
  );
}

/* ─── Report Panels ───────────────────────────────────────────────────────── */
function ExecutiveReport({ r }: { r:MINERVAResult }) {
  const d=r.diagnosis; const rc=r.root_cause;
  const pc=PRIORITY[d.field_priority]??PRIORITY.MEDIUM;
  const peakDate=new Date(r.peak.date).toLocaleDateString('ar-SA',{year:'numeric',month:'long',day:'numeric'});
  const rows=[
    {q:'ماذا حدث؟',          a:EVENT_AR[d.winner_event]??d.winner_event, hi:true},
    {q:'أين حدث؟',           a:`${r.asset_id} — ${peakDate}`},
    {q:'لماذا نعتقد ذلك؟',  a:d.supporting_evidence.slice(0,2).join(' | ')||'أدلة متعددة متوافقة'},
    {q:'ما درجة الثقة؟',    a:`${{HIGH:'عالية',MEDIUM:'متوسطة',LOW:'منخفضة'}[d.confidence_level as 'HIGH'|'MEDIUM'|'LOW']||d.confidence_level} — ${Math.round(d.winner_probability*100)}%`},
    {q:'ما مستوى الخطورة؟', a:`${pc.label} — ${Math.round(r.peak.anomaly_score*100)}%`, hi:true},
    {q:'ما الإجراء؟',       a:d.recommendation, hi:true},
    {q:'متى؟',               a:pc.days},
  ];
  return (
    <div className="space-y-3 p-1">
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40 space-y-2">
        {rows.map(({q,a,hi})=>(
          <div key={q} className={hi?'bg-slate-900/60 border border-slate-700/50 rounded-lg p-2':''}>
            <p className="text-xs text-slate-500">{q}</p>
            <p className="text-sm text-slate-100 font-medium leading-snug">{a}</p>
          </div>
        ))}
      </div>
      {rc.next_events.length>0&&(
        <div className="bg-orange-500/5 rounded-xl p-3 border border-orange-500/20">
          <p className="text-xs text-orange-400 mb-2 font-semibold flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5"/>إذا لم يُعالَج</p>
          {rc.next_events.slice(0,2).map((ev,i)=>(
            <div key={i} className="flex gap-2 text-xs mb-1">
              <span className="text-orange-400 font-bold shrink-0">{(ev.probability*100).toFixed(0)}%</span>
              <span className="text-slate-400">{ev.event} خلال {ev.timeframe_months[0]}-{ev.timeframe_months[1]} شهر — {ev.reason}</span>
            </div>
          ))}
        </div>
      )}
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <p className="text-xs text-rose-400 mb-2 font-semibold flex items-center gap-1.5"><Eye className="w-3.5 h-3.5"/>السبب الجذري</p>
        <p className="text-sm text-slate-200 font-medium mb-2">{RC_AR[rc.most_probable]??rc.most_probable}</p>
        {rc.causes.slice(0,3).map(c=>(
          <div key={c.id} className="flex items-center gap-2 mb-1.5 text-xs">
            <div className="flex-1 h-1.5 bg-slate-700 rounded"><div className="h-full bg-rose-500/70 rounded" style={{width:`${c.probability*100}%`}}/></div>
            <span className="text-slate-400 w-8 text-right">{(c.probability*100).toFixed(0)}%</span>
            <span className="text-slate-500 flex-1 truncate">{c.description}</span>
          </div>
        ))}
        {rc.prevention.slice(0,2).map((h,i)=>(
          <p key={i} className="text-xs text-slate-500 flex gap-1.5 mt-1"><ChevronRight className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5"/>{h}</p>
        ))}
      </div>
    </div>
  );
}

function ExpertView({ r, onHighlight }: { r:MINERVAResult; onHighlight?:(idx:number)=>void }) {
  const d=r.diagnosis;
  const [showCF, setShowCF]=useState(false);
  return (
    <div className="space-y-3 p-1">
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <p className="text-xs text-slate-500 mb-2 font-semibold">انحرافات الإشارات (z-score)</p>
        {Object.entries(r.peak.z_scores).map(([sig,z])=>(
          <div key={sig} className="flex items-center gap-2 mb-1.5">
            <span className="text-xs text-slate-500 w-28 truncate">{sig}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden">
              <div className={`h-full rounded ${z>0?'bg-sky-500':'bg-rose-500'}`} style={{width:`${Math.min(Math.abs(z)/5,1)*100}%`}}/>
            </div>
            <span className={`text-xs tabular-nums w-12 text-right ${z>0?'text-sky-400':'text-rose-400'}`}>{z>0?'+':''}{z.toFixed(1)}σ</span>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-1.5 mt-2 text-xs">
          {[
            ['اكتمال الأدلة', `${(d.evidence_completeness*100).toFixed(0)}%`],
            ['تطابق سببي',    `${(d.causal_alignment*100).toFixed(0)}%`],
            ['هطول 30 يوم',   `${r.peak.precipitation_30d} mm`],
            ['هطول 7 أيام',   `${r.peak.precipitation_7d} mm`],
          ].map(([k,v])=>(<div key={k} className="bg-slate-900/40 rounded p-1.5"><p className="text-slate-500">{k}</p><p className="text-slate-200 font-semibold">{v}</p></div>))}
        </div>
      </div>
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <p className="text-xs text-slate-500 mb-2 font-semibold">منافسة الفرضيات</p>
        {r.hypothesis_competition.slice(0,6).map((h,i)=>(
          <div key={h.event} className="flex items-center gap-2 mb-1.5 cursor-pointer hover:opacity-80" onClick={()=>onHighlight?.(i)}>
            <span className={`text-xs w-32 truncate ${i===0?'text-blue-300 font-semibold':'text-slate-400'}`}>{EVENT_AR[h.event]??h.event}</span>
            <div className="flex-1 h-1.5 bg-slate-700 rounded overflow-hidden"><div className={`h-full rounded ${i===0?'bg-blue-500':'bg-slate-600'}`} style={{width:`${h.probability*100}%`}}/></div>
            <span className="text-xs text-slate-300 w-8 text-right">{(h.probability*100).toFixed(1)}%</span>
          </div>
        ))}
      </div>
      {d.supporting_evidence.length>0&&(
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          {d.supporting_evidence.slice(0,3).map((e,i)=><p key={i} className="text-xs text-slate-400 flex gap-1.5 mb-1"><CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0 mt-0.5"/>{e}</p>)}
          {d.refuting_evidence.slice(0,2).map((e,i)=><p key={i} className="text-xs text-slate-400 flex gap-1.5 mb-1 mt-1"><AlertTriangle className="w-3 h-3 text-rose-500 shrink-0 mt-0.5"/>{e}</p>)}
        </div>
      )}
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <button onClick={()=>setShowCF(!showCF)} className="flex items-center gap-1.5 w-full text-xs text-violet-400 font-semibold">
          <HelpCircle className="w-3.5 h-3.5"/>ما الذي سيغير الاستنتاج؟{showCF?<ChevronUp className="w-3 h-3 ml-auto"/>:<ChevronDown className="w-3 h-3 ml-auto"/>}
        </button>
        {showCF&&<p className="text-xs text-slate-500 mt-1.5 leading-relaxed whitespace-pre-line">{d.counterfactual}</p>}
      </div>
    </div>
  );
}

function TimelineView({ r, idx, onIdx }: { r:MINERVAResult; idx:number; onIdx:(i:number)=>void }) {
  const data=r.timeline; const max=Math.max(...data.map(d=>d.score),.01);
  const cur=data[idx]; const peak=data.reduce((a,b)=>a.score>b.score?a:b);
  const cc=(s:number)=>s>=.8?'bg-red-400':s>=.6?'bg-orange-400':s>=.3?'bg-yellow-400':'bg-slate-700';
  return (
    <div className="space-y-3 p-1">
      <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
        <p className="text-xs text-slate-500 mb-2 font-semibold">Anomaly Score</p>
        <div className="flex items-end gap-0.5 h-16 mb-2">
          {data.map((d,i)=>(
            <button key={i} onClick={()=>onIdx(i)} title={`${d.date}: ${d.score.toFixed(3)}`}
              className={`flex-1 rounded-sm transition-all ${cc(d.score)} ${i===idx?'ring-1 ring-white/60 opacity-100':'opacity-60 hover:opacity-80'}`}
              style={{height:`${Math.max((d.score/max)*100,2)}%`,minHeight:2}}/>
          ))}
        </div>
        <input type="range" min={0} max={data.length-1} value={idx} onChange={e=>onIdx(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 cursor-pointer"/>
        <div className="flex justify-between text-xs text-slate-600 mt-0.5"><span>{data[0]?.date.slice(0,7)}</span><span>{data[data.length-1]?.date.slice(0,7)}</span></div>
      </div>
      {cur&&(
        <div className="bg-slate-800/50 rounded-xl p-3 border border-slate-700/40">
          <p className="text-xs text-slate-500 font-semibold mb-1">اللحظة المحددة</p>
          <p className="text-sm font-mono text-slate-200">{cur.date}</p>
          <div className="flex items-center gap-3 mt-1">
            <span className={`text-lg font-bold ${cur.score>=.8?'text-red-400':cur.score>=.6?'text-orange-400':cur.score>=.3?'text-yellow-400':'text-slate-400'}`}>{cur.score.toFixed(3)}</span>
            <span className="text-xs text-slate-500">{cur.severity}</span>
            {cur.is_event&&<span className="text-xs font-bold text-red-400">◄ حدث مؤكد</span>}
          </div>
        </div>
      )}
      {peak&&<div className="bg-red-500/5 rounded-xl p-3 border border-red-500/20">
        <p className="text-xs text-red-400 font-semibold mb-1">ذروة الشذوذ</p>
        <p className="text-sm font-mono text-slate-200">{peak.date}</p>
        <p className="text-xl font-bold text-red-400">{peak.score.toFixed(3)}</p>
      </div>}
    </div>
  );
}

function DecisionView({ r }: { r:MINERVAResult }) {
  const dec=r.decision;
  return (
    <div className="space-y-3 p-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-xs text-red-400 mb-1">خسارة بدون إجراء</p>
          <p className="text-xl font-bold text-red-300">${dec.do_nothing_loss_usd.toFixed(0)}</p>
          <p className="text-xs text-slate-500">30 يومًا</p>
        </div>
        <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-xs text-emerald-400 mb-1">أفضل إجراء</p>
          <p className="text-xl font-bold text-emerald-300">${dec.best_voi_usd.toFixed(0)}</p>
          <p className="text-xs text-slate-500">قيمة VoI</p>
        </div>
      </div>
      <div className="space-y-2">
        {dec.actions.slice(0,5).map(a=>(
          <div key={a.id} className={`rounded-xl p-3 text-xs border ${a.id===dec.best_action?'bg-emerald-500/10 border-emerald-500/30':'bg-slate-800/40 border-slate-700/40'}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <p className={`font-semibold ${a.id===dec.best_action?'text-emerald-300':'text-slate-300'}`}>{a.id===dec.best_action&&'★ '}{a.description}</p>
                <p className="text-slate-500 mt-0.5 leading-snug">{a.recommendation.slice(0,70)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-slate-400">${a.cost_usd.toFixed(0)}</p>
                <p className={`font-bold ${a.voi_usd>0?'text-emerald-400':'text-red-400'}`}>${a.voi_usd.toFixed(0)}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main Shell ─────────────────────────────────────────────────────────── */
export default function MINERVAShell() {
  const [step, setStep]   = useState<'setup'|'results'>('setup');
  const [params, setParams]= useState<Params>({ lat:32.89, lon:13.18, asset_type:'WATER_PIPELINE_MAIN', asset_id:'PIPE-WTR-TEST-001', buffer_m:50 });
  const [mode, setMode]   = useState<AnalysisMode>('existing-asset');
  const [loading, setLoading]= useState(false);
  const [result, setResult]  = useState<MINERVAResult|null>(null);
  const [error, setError]    = useState<string|null>(null);
  const [viewMode, setViewMode]= useState<ViewMode>('executive');
  const [timelineIdx, setTLIdx]= useState(0);
  const [showAll, setShowAll]  = useState(true);
  const [drawMode, setDrawModeS]= useState<DrawMode>('none');
  const [layers, setLayers]  = useState<LayerVisibility>({ pipeline:true, buffer:true, anomalies:true, labels:true });
  const [showLayerMgr, setShowLM]= useState(false);
  const [panelOpen, setPanelOpen]= useState(true);
  const mapRef = useRef<MINERVAMapHandle>(null);

  const assetMeta = ASSET_TYPES.find(a => a.value === params.asset_type) ?? ASSET_TYPES[0];

  const handleRun = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/minerva/analyze', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(params) });
      const data: MINERVAResult = await res.json();
      if (!data.ok) { setError((data as any).error ?? 'فشل التحليل'); return; }
      setResult(data);
      if (data.timeline) {
        const pkIdx = data.timeline.reduce((b,c,i,a)=>c.score>a[b].score?i:b, 0);
        setTLIdx(pkIdx);
      }
    } catch (e: any) { setError(e.message ?? 'خطأ'); }
    finally { setLoading(false); }
  }, [params]);

  function handleSetupComplete(p: Params, m: AnalysisMode) {
    setParams(p); setMode(m); setStep('results');
    // Auto-run analysis
    setTimeout(()=>{
      (async()=>{
        setLoading(true); setError(null);
        try {
          const res = await fetch('/api/minerva/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(p)});
          const data:MINERVAResult=await res.json();
          if(!data.ok){setError((data as any).error??'فشل التحليل');return;}
          setResult(data);
          if(data.timeline){const pkIdx=data.timeline.reduce((b,c,i,a)=>c.score>a[b].score?i:b,0);setTLIdx(pkIdx);}
        }catch(e:any){setError(e.message??'خطأ');}
        finally{setLoading(false);}
      })();
    }, 100);
  }

  function handleShowMap() {
    if (result && mapRef.current) {
      const peak = result.timeline.reduce((a,b)=>a.score>b.score?a:b);
      mapRef.current.flyToAnomaly(params.lat, params.lon, 14.5);
    }
  }

  function handleSetDrawMode(dm: DrawMode) {
    setDrawModeS(dm);
    mapRef.current?.setDrawMode(dm);
  }

  function toggleLayer(k: keyof LayerVisibility) {
    setLayers(prev => ({ ...prev, [k]: !prev[k] }));
  }

  // Apply layer changes to map
  useEffect(()=>{ mapRef.current?.['toggleLayer']?.(layers as any); }, [layers]);

  const timelinePoints: AnomalyPoint[] = result?.timeline.map(t=>({ lat:params.lat, lon:params.lon, score:t.score, date:t.date, severity:t.severity, is_event:t.is_event })) ?? [];

  const TABS: {id:ViewMode;label:string;icon:React.ElementType}[] = [
    {id:'executive',label:'تقرير',  icon:FileText},
    {id:'expert',   label:'خبير',   icon:Eye},
    {id:'timeline', label:'زمني',   icon:BarChart2},
    {id:'decision', label:'قرار',   icon:DollarSign},
  ];

  if (step === 'setup') return (
    <SetupWizard onComplete={handleSetupComplete} mapRef={mapRef}/>
  );

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden" dir="rtl">
      {/* HEADER */}
      <div className="flex-none h-11 border-b border-slate-800/80 bg-slate-950/95 px-4 flex items-center gap-3 shrink-0">
        <button onClick={()=>setStep('setup')} className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">
          <ChevronRight className="w-4 h-4"/>
          <Brain className="w-4 h-4 text-blue-400"/>
          <span className="font-bold text-slate-300">MINERVA</span>
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-xs text-slate-400 flex items-center gap-1">
          <span>{assetMeta.icon}</span>{assetMeta.label}
        </span>
        <div className="flex-1"/>
        {result && <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/>{result.analysis_date}</span>}
        {result && <button onClick={()=>window.print()} className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1 px-2 py-1 rounded border border-slate-700/50 hover:border-slate-600 transition-all"><Download className="w-3.5 h-3.5"/>تصدير</button>}
        <button onClick={handleRun} disabled={loading} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold transition-all">
          {loading?<><RefreshCw className="w-3.5 h-3.5 animate-spin"/>جارٍ...</>:<><Play className="w-3.5 h-3.5"/>تحليل</>}
        </button>
      </div>

      {/* BODY */}
      <div className="flex-1 flex overflow-hidden">
        {/* MAP AREA */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* Headline */}
          {result && (
            <div className="flex-none px-3 pt-2">
              <HeadlineCard r={result} onShowMap={handleShowMap}/>
            </div>
          )}

          {/* Map */}
          <div className="flex-1 relative px-3 py-2 min-h-0">
            <div className="w-full h-full rounded-xl overflow-hidden border border-slate-800/60 bg-slate-900">
              <MINERVAMap ref={mapRef}
                lat={params.lat} lon={params.lon}
                bufferMeters={params.buffer_m}
                assetColor={assetMeta.color}
                assetLabel={`${assetMeta.icon} ${params.asset_id}`}
                timeline={timelinePoints}
                timelineIndex={timelineIdx}
                showAllAnomalies={showAll}
                layers={layers}
                onMapClick={(lat,lon)=>setParams(p=>({...p,lat,lon}))}
                onDrawComplete={(g)=>console.log('drawn',g)}
                onAnomalyClick={(pt)=>{const i=timelinePoints.findIndex(t=>t.date===pt.date);if(i>=0)setTLIdx(i);}}
              />

              {/* Empty/Loading overlays */}
              {!result && !loading && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center bg-slate-950/70 rounded-2xl px-8 py-6 backdrop-blur-sm border border-slate-800/60">
                    <Brain className="w-10 h-10 text-slate-700 mx-auto mb-2"/>
                    <p className="text-slate-500 text-sm">اضغط "تحليل" لبدء تشغيل MINERVA</p>
                  </div>
                </div>
              )}
              {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/70 backdrop-blur-sm">
                  <Brain className="w-10 h-10 text-blue-400 animate-pulse mb-3"/>
                  <p className="text-slate-300 text-sm font-semibold">تشغيل محرك MINERVA...</p>
                  <p className="text-slate-600 text-xs mt-1">يستغرق 20-40 ثانية</p>
                </div>
              )}
              {error && (
                <div className="absolute top-4 right-4 bg-red-500/10 border border-red-500/30 rounded-xl p-3 max-w-xs">
                  <p className="text-red-300 text-xs font-mono">{error}</p>
                </div>
              )}

              {/* Map toolbar (top-left) */}
              <div className="absolute top-3 right-3 flex flex-col gap-2">
                {/* Draw tools */}
                <DrawToolbar mode={drawMode} onMode={handleSetDrawMode} onClear={()=>{handleSetDrawMode('none');mapRef.current?.clearDraw();}}/>
                {/* Layer manager toggle */}
                <div className="relative">
                  <button onClick={()=>setShowLM(!showLayerMgr)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium shadow-xl backdrop-blur-sm border transition-all
                      ${showLayerMgr?'bg-blue-600/20 border-blue-500/40 text-blue-300':'bg-slate-950/90 border-slate-700/50 text-slate-400 hover:text-slate-200'}`}>
                    <Layers className="w-3.5 h-3.5"/>الطبقات
                  </button>
                  {showLayerMgr && (
                    <div className="absolute top-full mt-1 right-0 z-20">
                      <LayerManager layers={layers} onChange={toggleLayer}/>
                    </div>
                  )}
                </div>
              </div>

              {/* Map legend (bottom right) */}
              {result && (
                <div className="absolute bottom-3 left-3 bg-slate-950/85 border border-slate-800/60 rounded-xl p-2.5 backdrop-blur-sm">
                  <p className="text-xs text-slate-500 mb-1.5 font-semibold">الشذوذات</p>
                  {[{c:'bg-red-400',l:'حرج (>0.8)'},{c:'bg-orange-400',l:'شذوذ (>0.6)'},{c:'bg-yellow-400',l:'مراقبة (>0.3)'},{c:'bg-blue-500',l:`${assetMeta.icon} الأصل`}].map(({c,l})=>(
                    <div key={l} className="flex items-center gap-1.5 text-xs text-slate-400 mb-1 last:mb-0"><div className={`w-2.5 h-2.5 rounded-full ${c} shrink-0`}/>{l}</div>
                  ))}
                  <div className="mt-1.5 pt-1.5 border-t border-slate-800 text-xs text-slate-600">حرم: {params.buffer_m}م</div>
                </div>
              )}

              {/* Study area info */}
              {result && (
                <div className="absolute top-3 left-3 bg-slate-950/85 border border-slate-800/60 rounded-xl p-2.5 backdrop-blur-sm text-xs">
                  <p className="text-slate-500 font-semibold mb-1">معلومات الدراسة</p>
                  <div className="space-y-0.5 text-slate-400">
                    <p>📍 {params.lat.toFixed(4)}, {params.lon.toFixed(4)}</p>
                    <p>📊 {result.timeline.length} نقطة تحليل</p>
                    <p>⚠️ {result.timeline.filter(t=>t.score>0.3).length} شذوذ مرصود</p>
                    <p>🧠 {result.baseline_cells} خلية Baseline</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* REPORT PANEL */}
        {result && (
          <div className={`flex-none border-r border-slate-800/80 flex flex-col overflow-hidden transition-all duration-200 ${panelOpen?'w-80':'w-10'}`}>
            {panelOpen ? (
              <>
                <div className="flex-none border-b border-slate-800/80 px-2 py-1.5 flex items-center gap-1">
                  {TABS.map(({id,label,icon:Icon})=>(
                    <button key={id} onClick={()=>setViewMode(id)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${viewMode===id?'bg-blue-600/20 border border-blue-500/30 text-blue-300':'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'}`}>
                      <Icon className="w-3.5 h-3.5"/>{label}
                    </button>
                  ))}
                  <button onClick={()=>setPanelOpen(false)} className="ml-auto text-slate-600 hover:text-slate-400">
                    <ChevronRight className="w-4 h-4"/>
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2">
                  {viewMode==='executive' && <ExecutiveReport r={result}/>}
                  {viewMode==='expert'    && <ExpertView r={result}/>}
                  {viewMode==='timeline'  && <TimelineView r={result} idx={timelineIdx} onIdx={i=>{setTLIdx(i);mapRef.current?.flyToAnomaly(params.lat,params.lon);}}/>}
                  {viewMode==='decision'  && <DecisionView r={result}/>}
                </div>
              </>
            ) : (
              <button onClick={()=>setPanelOpen(true)} className="flex-1 flex items-center justify-center hover:bg-slate-800/40 transition-colors">
                <ChevronLeft className="w-4 h-4 text-slate-600"/>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
