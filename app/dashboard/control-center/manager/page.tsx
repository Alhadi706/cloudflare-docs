'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  Crown, ArrowRight, RefreshCw,
  Droplets, Gauge, Wind,
  Bell, CheckCircle2, XCircle, AlertTriangle,
  Clock, User, MonitorDot, BarChart3,
  Radio, BookOpen, Users, Shield,
  ChevronRight, Activity, FlaskConical,
  Wifi, WifiOff, Timer,
  TrendingUp, TrendingDown, Minus,
  Mail,
} from 'lucide-react';
import InternalMailTab from '@/components/InternalMailTab';

interface NetworkKPI {
  total_production_m3: number; avg_pressure_bar: number;
  active_stations: number; total_stations: number;
  active_pumps: number; total_pumps: number;
  open_alarms: number; network_efficiency_pct: number;
  last_updated: string;
}
interface StationStatus {
  id: string; name_ar: string; flow_m3_day: number; pressure_bar: number;
  pumps_running: number; pumps_total: number; tank_level_pct: number;
  status: 'normal'|'warning'|'critical'|'offline'; reading_date: string;
}
interface PendingReading {
  id: number; station_id: string; name_ar: string; zone: string;
  reading_date: string; shift: string; status: string;
  flow_m3: number|null; pressure_out_bar: number|null; tank_level_pct: number|null;
  pumps_running: number|null; pumps_total: number|null; power_kw: number|null;
  chlorine_mg_l: number|null; notes: string|null;
  submitted_by: number|null; submitted_at: string|null;
  supervisor_id: number|null; supervisor_at: string|null; supervisor_note: string|null;
}
interface Alarm {
  id: number; station_id: string; alarm_type: string;
  severity: 'critical'|'high'|'medium'|'low';
  value_at_alarm: number|null; threshold_value: number|null; unit: string|null;
  description_ar: string; state: string; created_at: string;
  station_name_ar?: string; zone?: string;
}

function ageSince(iso: string|null|undefined): { label: string; minutes: number; urgent: boolean } {
  if (!iso) return { label: '\u2014', minutes: 0, urgent: false };
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return { label: '\u0627\u0644\u0622\u0646', minutes: m, urgent: false };
  if (m < 60) return { label: `${m}\u062f`, minutes: m, urgent: m > 30 };
  const h = Math.floor(m/60), rem = m%60;
  return { label: rem > 0 ? `${h}\u0633 ${rem}\u062f` : `${h}\u0633`, minutes: m, urgent: h >= 1 };
}
function delayColor(minutes: number): string {
  if (minutes > 120) return 'text-rose-400 font-bold';
  if (minutes > 60)  return 'text-orange-400 font-bold';
  if (minutes > 30)  return 'text-amber-400';
  return 'text-slate-400';
}
function calcHealth(kpi: NetworkKPI|null, alarms: Alarm[], pendingTotal: number): number {
  if (!kpi) return 0;
  let s = 100;
  const cov = kpi.total_stations > 0 ? (kpi.active_stations/kpi.total_stations) : 0;
  if (cov < 1) s -= Math.round((1-cov)*30);
  s -= alarms.filter(a => a.severity==='critical').length * 10;
  s -= alarms.filter(a => a.severity==='high').length * 4;
  s -= Math.min(pendingTotal * 3, 20);
  if (kpi.avg_pressure_bar < 3.5 || kpi.avg_pressure_bar > 7.5) s -= 10;
  return Math.max(0, Math.min(100, s));
}
function healthColor(s: number) { return s>=80?'text-emerald-400':s>=60?'text-amber-400':s>=40?'text-orange-400':'text-rose-400'; }
function healthLabel(s: number) { return s>=80?'\u0645\u0645\u062a\u0627\u0632':s>=60?'\u0645\u0642\u0628\u0648\u0644':s>=40?'\u0636\u0639\u064a\u0641':'\u062d\u0631\u062c'; }

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

const SEV_CFG = {
  critical: { text:'text-rose-400',   bg:'bg-rose-500/15',   border:'border-rose-500/30',   label:'\u062d\u0631\u062c' },
  high:     { text:'text-orange-400', bg:'bg-orange-500/15', border:'border-orange-500/30', label:'\u0639\u0627\u0644\u064a' },
  medium:   { text:'text-amber-400',  bg:'bg-amber-500/15',  border:'border-amber-500/30',  label:'\u0645\u062a\u0648\u0633\u0637' },
  low:      { text:'text-blue-400',   bg:'bg-blue-500/15',   border:'border-blue-500/30',   label:'\u0645\u0646\u062e\u0641\u0636' },
} as const;
const ST_CFG = {
  normal:   { border:'border-emerald-500/20', bg:'bg-emerald-500/10', dot:'bg-emerald-400', label:'\u0637\u0628\u064a\u0639\u064a',     text:'text-emerald-400' },
  warning:  { border:'border-amber-500/20',   bg:'bg-amber-500/10',   dot:'bg-amber-400',   label:'\u062a\u062d\u0630\u064a\u0631',     text:'text-amber-400' },
  critical: { border:'border-rose-500/20',    bg:'bg-rose-500/10',    dot:'bg-rose-400',    label:'\u062d\u0631\u062c',                 text:'text-rose-400' },
  offline:  { border:'border-slate-500/20',   bg:'bg-slate-500/10',   dot:'bg-slate-500',   label:'\u063a\u064a\u0631 \u0645\u062a\u0635\u0644', text:'text-slate-500' },
} as const;
const SHIFT_LABEL: Record<string, string> = { daily:'\u064a\u0648\u0645\u064a', morning:'\u0635\u0628\u0627\u062d\u064a\u0629', evening:'\u0645\u0633\u0627\u0626\u064a\u0629', night:'\u0644\u064a\u0644\u064a\u0629' };

function KpiCard({ icon: Icon, label, value, sub, color, pulse }: {
  icon: React.ElementType; label: string; value: string; sub?: string; color: string; pulse?: boolean;
}) {
  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center shrink-0`}><Icon className="w-4 h-4"/></div>
      <div className="min-w-0">
        <p className="text-[10px] text-slate-500 font-medium">{label}</p>
        <p className={`text-lg font-bold text-white tabular-nums leading-none ${pulse?'animate-pulse':''}`}>{value}</p>
        {sub && <p className="text-[9px] text-slate-600 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function AlarmRow({ alarm, onAck }: { alarm: Alarm; onAck: (id: number)=>void }) {
  const c = SEV_CFG[alarm.severity] ?? SEV_CFG.medium;
  const age = ageSince(alarm.created_at);
  const [busy, setBusy] = useState(false);
  return (
    <div className={`border ${c.border} ${c.bg} rounded-xl p-3 space-y-2`}>
      <div className="flex items-start gap-2">
        <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${c.text}`}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className={`text-[10px] font-bold ${c.text} uppercase`}>{c.label}</span>
            <span className="text-[10px] text-slate-400">{alarm.station_name_ar || alarm.station_id}</span>
          </div>
          <p className="text-xs text-slate-200 leading-relaxed">{alarm.description_ar}</p>
        </div>
        <button onClick={async()=>{
          setBusy(true);
          await fetch(`/api/control-center/alarms/${alarm.id}/acknowledge`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({note:'\u0625\u0642\u0631\u0627\u0631 \u0645\u0646 \u0644\u0648\u062d\u0629 \u0627\u0644\u0645\u062f\u064a\u0631'})}).catch(()=>{});
          setBusy(false); onAck(alarm.id);
        }} disabled={busy} className="shrink-0 text-[10px] px-2 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-white transition-colors">
          {busy?<RefreshCw className="w-3 h-3 animate-spin"/>:'\u0625\u0642\u0631\u0627\u0631'}
        </button>
      </div>
      <div className="flex items-center gap-2">
        <Timer className="w-3 h-3 text-slate-600 shrink-0"/>
        <span className={`text-[10px] ${delayColor(age.minutes)}`}>
          {age.urgent ? `\u26a0 \u0644\u0645 \u064a\u064f\u0639\u0627\u0644\u062c \u0645\u0646\u0630 ${age.label}` : `\u0645\u0646\u0630 ${age.label}`}
        </span>
        {age.minutes > 0 && (
          <div className="flex-1 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${age.minutes>120?'bg-rose-500':age.minutes>60?'bg-orange-500':age.minutes>30?'bg-amber-500':'bg-emerald-500'}`}
              style={{width:`${Math.min(100,(age.minutes/120)*100)}%`}}/>
          </div>
        )}
      </div>
    </div>
  );
}

function PendingRow({ r, approverId, onDone }: { r: PendingReading; approverId: number; onDone: (msg:string)=>void }) {
  const [note, setNote] = useState('');
  const [reason, setReason] = useState('');
  const [showR, setShowR] = useState(false);
  const [busy, setBusy] = useState<'approve'|'reject'|null>(null);
  const submittedAge  = ageSince(r.submitted_at);
  const supervisorAge = r.supervisor_at ? ageSince(r.supervisor_at) : null;
  const waitStart     = r.status==='submitted' ? r.submitted_at : (r.supervisor_at || r.submitted_at);
  const levelAge      = ageSince(waitStart);
  const isDelayed     = levelAge.minutes > 60;

  async function approve() {
    setBusy('approve');
    const res = await fetch('/api/control-center/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'approve',reading_id:r.id,approver_id:approverId,note:note||null,level:'dept'})});
    setBusy(null); const d = await res.json().catch(()=>({}));
    onDone(d.success?'\u2713 \u0623\u064f\u062f\u0631\u062c\u062a \u0641\u064a \u0627\u0644\u0646\u0638\u0627\u0645':(d.detail||'\u062e\u0637\u0623'));
  }
  async function reject() {
    if (!reason.trim()) return; setBusy('reject');
    const res = await fetch('/api/control-center/readings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'reject',reading_id:r.id,approver_id:approverId,reason})});
    setBusy(null); const d = await res.json().catch(()=>({}));
    onDone(d.success?'\u062a\u0645 \u0627\u0644\u0631\u0641\u0636':(d.detail||'\u062e\u0637\u0623'));
  }

  return (
    <div className={`border rounded-xl p-3 space-y-2 ${isDelayed?'border-amber-500/30 bg-amber-500/5':'border-slate-700/40 bg-slate-800/50'}`}>
      <div className="flex items-start gap-2 justify-between">
        <div>
          <p className="text-sm font-bold text-white">{r.name_ar}</p>
          <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 flex-wrap">
            <span>{r.reading_date}</span><span>·</span><span>{SHIFT_LABEL[r.shift]||r.shift}</span><span>·</span><span>{r.zone}</span>
          </div>
        </div>
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${r.status==='submitted'?'bg-amber-500/20 text-amber-300 border-amber-500/30':'bg-blue-500/20 text-blue-300 border-blue-500/30'}`}>
          {r.status==='submitted'?'\u0639\u0646\u062f \u0627\u0644\u0645\u0634\u0631\u0641':'\u0639\u0646\u062f\u0643'}
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {r.flow_m3!=null&&<span className="bg-slate-900 px-2 py-0.5 rounded text-cyan-300">{r.flow_m3.toLocaleString()} \u0645\u00b3</span>}
        {r.pressure_out_bar!=null&&<span className="bg-slate-900 px-2 py-0.5 rounded text-violet-300">{r.pressure_out_bar} \u0628\u0627\u0631</span>}
        {r.tank_level_pct!=null&&<span className={`bg-slate-900 px-2 py-0.5 rounded ${r.tank_level_pct<25?'text-rose-400 font-bold':'text-blue-300'}`}>{r.tank_level_pct}%</span>}
      </div>
      {/* Delay timeline */}
      <div className="bg-slate-900/60 rounded-lg px-3 py-2 space-y-1">
        <p className="text-[9px] text-slate-600 uppercase tracking-widest mb-1">\u0645\u0633\u0627\u0631 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f</p>
        <div className="flex items-center gap-2 text-[10px]">
          <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0"/>
          <span className="text-slate-400">\u0623\u064f\u0631\u0633\u0644\u062a \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0631\u0627\u0635\u062f</span>
          <span className={`mr-auto ${delayColor(submittedAge.minutes)}`}>{submittedAge.label}</span>
        </div>
        {r.supervisor_at ? (
          <div className="flex items-center gap-2 text-[10px]">
            <div className="w-2 h-2 rounded-full bg-blue-400 shrink-0"/>
            <span className="text-slate-400">\u0648\u0627\u0641\u0642 \u0627\u0644\u0645\u0634\u0631\u0641</span>
            {r.supervisor_note&&<span className="text-slate-600 italic">"{r.supervisor_note.slice(0,25)}"</span>}
            <span className={`mr-auto ${delayColor(supervisorAge?.minutes??0)}`}>{supervisorAge?.label}</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-[10px]">
            <div className={`w-2 h-2 rounded-full shrink-0 ${isDelayed?'bg-amber-400 animate-pulse':'bg-slate-600'}`}/>
            <span className={isDelayed?'text-amber-300':'text-slate-500'}>
              {isDelayed?`\u062a\u0623\u062e\u064a\u0631 \u0639\u0646\u062f \u0627\u0644\u0645\u0634\u0631\u0641 — ${levelAge.label}`:'\u0641\u064a \u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0634\u0631\u0641'}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-[10px]">
          <div className={`w-2 h-2 rounded-full shrink-0 ${r.status==='approved_supervisor'?(isDelayed?'bg-rose-400 animate-pulse':'bg-indigo-400'):'bg-slate-700'}`}/>
          <span className={r.status==='approved_supervisor'?(isDelayed?'text-rose-300 font-bold':'text-indigo-300'):'text-slate-600'}>
            {r.status==='approved_supervisor'
              ?(isDelayed?`\u26a1 \u062a\u0646\u062a\u0638\u0631 \u0627\u0639\u062a\u0645\u0627\u062f\u0643 \u0645\u0646\u0630 ${levelAge.label}`:'\u062a\u0646\u062a\u0638\u0631 \u0627\u0639\u062a\u0645\u0627\u062f\u0643')
              :'\u0627\u0639\u062a\u0645\u0627\u062f \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u062d\u0643\u0645'}
          </span>
        </div>
      </div>
      {r.status==='approved_supervisor' && (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="\u0645\u0644\u0627\u062d\u0638\u0629 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none focus:border-emerald-500 placeholder:text-slate-600"/>
            <button onClick={approve} disabled={busy!==null}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[11px] font-bold rounded-lg transition-colors">
              {busy==='approve'?<RefreshCw className="w-3 h-3 animate-spin"/>:<CheckCircle2 className="w-3 h-3"/>}\u0627\u0639\u062a\u0645\u0627\u062f
            </button>
            <button onClick={()=>setShowR(!showR)} disabled={busy!==null}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-500/20 border border-rose-500/30 text-rose-300 text-[11px] rounded-lg hover:bg-rose-500/30 transition-colors">
              <XCircle className="w-3 h-3"/>\u0631\u0641\u0636
            </button>
          </div>
          {showR&&(
            <div className="flex gap-2">
              <input value={reason} onChange={e=>setReason(e.target.value)} placeholder="\u0633\u0628\u0628 \u0627\u0644\u0631\u0641\u0636 (\u0645\u0637\u0644\u0648\u0628)"
                className="flex-1 bg-slate-900 border border-rose-500/30 rounded-lg px-2 py-1.5 text-[11px] text-white focus:outline-none placeholder:text-rose-900"/>
              <button onClick={reject} disabled={!reason.trim()||busy!==null}
                className="px-3 py-1.5 bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white text-[11px] font-bold rounded-lg">\u062a\u0623\u0643\u064a\u062f</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StationChip({ s }: { s: StationStatus }) {
  const c = ST_CFG[s.status];
  return (
    <div className={`border ${c.border} ${c.bg} rounded-xl p-2.5 flex flex-col gap-1`}>
      <div className="flex items-center gap-1.5 justify-between">
        <span className="text-[11px] font-bold text-white truncate">{s.name_ar}</span>
        <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot} ${s.status!=='offline'?'animate-pulse':''}`}/>
      </div>
      <div className="grid grid-cols-2 gap-0.5 text-[9px] text-slate-400">
        <span>\u062a\u062f\u0641\u0642: <span className="text-cyan-300 font-mono">{s.flow_m3_day>0?(s.flow_m3_day/1000).toFixed(1)+'k':'\u2014'}</span></span>
        <span>\u0636\u063a\u0637: <span className="text-violet-300 font-mono">{s.pressure_bar>0?s.pressure_bar.toFixed(1):'\u2014'}</span></span>
        {s.tank_level_pct>0&&<span className="col-span-2">\u0645\u0646\u0633\u0648\u0628: <span className={`font-mono font-bold ${s.tank_level_pct<25?'text-rose-400':'text-blue-300'}`}>{s.tank_level_pct}%</span></span>}
      </div>
      <div className={`text-[8px] font-bold ${c.text}`}>{c.label}</div>
    </div>
  );
}

export default function ControlCenterManagerPage() {
  const now = useNow();
  const intervalRef = useRef<NodeJS.Timeout|null>(null);
  const [kpi, setKpi] = useState<NetworkKPI|null>(null);
  const [stations, setStations] = useState<StationStatus[]>([]);
  const [pendingAll, setPendingAll] = useState<PendingReading[]>([]);
  const [pendingDept, setPendingDept] = useState<PendingReading[]>([]);
  const [alarms, setAlarms] = useState<Alarm[]>([]);
  const [shiftInfo, setShiftInfo] = useState<Record<string,unknown>|null>(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(true);
  const [approverId, setApproverId] = useState(0);
  const [approverName, setApproverName] = useState('');
  const [approverInput, setApproverInput] = useState('');
  const [toast, setToast] = useState<{type:'ok'|'err';msg:string}|null>(null);
  const [refreshSec, setRefreshSec] = useState(60);
  const [activeView, setActiveView] = useState<'dashboard'|'mail'>('dashboard');

  function showToast(type:'ok'|'err', msg:string) { setToast({type,msg}); setTimeout(()=>setToast(null),5000); }

  const loadAll = useCallback(async () => {
    try {
      const [liveRes, supRes, deptRes, alarmsRes, shiftRes] = await Promise.allSettled([
        fetch('/api/control-center/live-status',{cache:'no-store'}),
        fetch('/api/control-center/readings?mode=pending&level=supervisor',{cache:'no-store'}),
        fetch('/api/control-center/readings?mode=pending&level=dept',{cache:'no-store'}),
        fetch('/api/control-center/alarms?state=active&limit=30',{cache:'no-store'}),
        fetch('/api/control-center/shift-log?days=1',{cache:'no-store'}),
      ]);
      if (liveRes.status==='fulfilled'&&liveRes.value.ok){const d=await liveRes.value.json();if(d.success&&d.data){setKpi(d.data.kpi);setStations(d.data.stations||[]);setConnected(true);}}else{setConnected(false);}
      const all:PendingReading[]=[];
      if(supRes.status==='fulfilled'&&supRes.value.ok){const d=await supRes.value.json();if(d.success)all.push(...(d.readings||[]));}
      if(deptRes.status==='fulfilled'&&deptRes.value.ok){const d=await deptRes.value.json();if(d.success){setPendingDept(d.readings||[]);all.push(...(d.readings||[]));}}
      setPendingAll(all);
      if(alarmsRes.status==='fulfilled'&&alarmsRes.value.ok){const d=await alarmsRes.value.json();if(d.success)setAlarms(d.alarms||[]);}
      if(shiftRes.status==='fulfilled'&&shiftRes.value.ok){const d=await shiftRes.value.json();if(d.success&&d.logs?.length>0)setShiftInfo(d.logs.find((l:{closed:boolean})=>!l.closed)||d.logs[0]);}
    } catch { setConnected(false); }
    finally { setLoading(false); setRefreshSec(60); }
  }, []);

  useEffect(() => {
    const s = localStorage.getItem('ctrl_approver_id');
    if(s){setApproverId(Number(s));setApproverInput(s);}
    const email = localStorage.getItem('user_email');
    if(email){fetch('/api/control-center/employees').then(r=>r.json()).then(d=>{if(!d.success)return;const m=(d.employees as{id:number;full_name_ar:string;email?:string}[]).find(e=>e.email?.toLowerCase()===email.toLowerCase());if(m){setApproverId(m.id);setApproverName(m.full_name_ar);setApproverInput(String(m.id));localStorage.setItem('ctrl_approver_id',String(m.id));}}).catch(()=>{});}
  }, []);

  useEffect(() => {
    loadAll();
    intervalRef.current = setInterval(()=>setRefreshSec(s=>{if(s<=1){loadAll();return 60;}return s-1;}),1000);
    return ()=>{if(intervalRef.current)clearInterval(intervalRef.current);};
  }, [loadAll]);

  const criticalCount = alarms.filter(a=>a.severity==='critical').length;
  const healthScore   = calcHealth(kpi, alarms, pendingAll.length);
  const oldestDelay   = pendingAll.reduce((mx,r)=>{const a=ageSince(r.submitted_at).minutes;return a>mx?a:mx;},0);

  const quickLinks = [
    {href:'/dashboard/control-center/real-time',icon:Activity,label:'SCADA \u0645\u0628\u0627\u0634\u0631',color:'border-cyan-500/30 text-cyan-400 bg-cyan-500/10'},
    {href:'/dashboard/control-center/readings-approval',icon:Shield,label:'\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0642\u0631\u0627\u0621\u0627\u062a',color:'border-indigo-500/30 text-indigo-400 bg-indigo-500/10'},
    {href:'/dashboard/control-center/alarm-management',icon:Bell,label:'\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u0625\u0646\u0630\u0627\u0631\u0627\u062a',color:'border-rose-500/30 text-rose-400 bg-rose-500/10'},
    {href:'/dashboard/control-center/shift-log',icon:BookOpen,label:'\u0633\u062c\u0644 \u0627\u0644\u0646\u0648\u0628\u0627\u062a',color:'border-violet-500/30 text-violet-400 bg-violet-500/10'},
    {href:'/dashboard/control-center/monitoring-teams',icon:Users,label:'\u0641\u0631\u0642 \u0627\u0644\u0631\u0635\u062f',color:'border-emerald-500/30 text-emerald-400 bg-emerald-500/10'},
    {href:'/dashboard/control-center/pressure-zones',icon:Gauge,label:'\u0645\u0646\u0627\u0637\u0642 \u0627\u0644\u0636\u063a\u0637',color:'border-amber-500/30 text-amber-400 bg-amber-500/10'},
    {href:'/dashboard/control-center/production-schedule',icon:BarChart3,label:'\u0627\u0644\u0625\u0646\u062a\u0627\u062c',color:'border-teal-500/30 text-teal-400 bg-teal-500/10'},
    {href:'/dashboard/control-center/scada',icon:MonitorDot,label:'SCADA \u0643\u0627\u0645\u0644',color:'border-rose-500/30 text-rose-400 bg-rose-500/10'},
  ];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-5" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <div>
            <Link href="/dashboard/control-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs mb-1"><ArrowRight className="w-3.5 h-3.5"/>\u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u062d\u0643\u0645</Link>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center"><Crown className="w-5 h-5 text-cyan-400"/></div>
              <div>
                <h1 className="text-xl font-bold text-white">\u0644\u0648\u062d\u0629 \u0645\u062f\u064a\u0631 \u0625\u062f\u0627\u0631\u0629 \u0627\u0644\u062a\u062d\u0643\u0645</h1>
                <p className="text-xs text-slate-500 mt-0.5">{approverName?`${approverName} \u00b7 `:''}{now.toLocaleDateString('ar-LY',{weekday:'long',day:'numeric',month:'long'})}</p>
              </div>
            </div>
          </div>
          <div className="mr-auto flex items-center gap-2 flex-wrap">
            {/* View switcher */}
            <div className="flex rounded-xl bg-slate-800/60 border border-slate-700 p-1 gap-1">
              <button
                onClick={() => setActiveView('dashboard')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeView === 'dashboard'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Activity className="w-3.5 h-3.5"/>
                لوحة التحكم
              </button>
              <button
                onClick={() => setActiveView('mail')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  activeView === 'mail'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <Mail className="w-3.5 h-3.5"/>
                المراسلات الداخلية
              </button>
            </div>
            <div className="flex items-center gap-1.5 text-[10px]">{connected?<><Wifi className="w-3.5 h-3.5 text-emerald-400"/><span className="text-emerald-400">\u0645\u062a\u0635\u0644</span></>:<><WifiOff className="w-3.5 h-3.5 text-rose-400"/><span className="text-rose-400">\u063a\u064a\u0631 \u0645\u062a\u0635\u0644</span></>}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3"/>{now.toLocaleTimeString('ar-LY',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</div>
            <span className="text-[10px] text-slate-600">\u062a\u062d\u062f\u064a\u062b \u062e\u0644\u0627\u0644 {refreshSec}\u062b</span>
            <button onClick={loadAll} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs text-slate-300 transition-colors"><RefreshCw className={`w-3.5 h-3.5 ${loading?'animate-spin':''}`}/>\u062a\u062d\u062f\u064a\u062b</button>
          </div>
        </div>

        {/* Toast */}
        {toast&&<div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium ${toast.type==='ok'?'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30':'bg-rose-500/20 text-rose-300 border border-rose-500/30'}`}>{toast.type==='ok'?<CheckCircle2 className="w-4 h-4 shrink-0"/>:<XCircle className="w-4 h-4 shrink-0"/>}{toast.msg}</div>}

        {/* Alert Banner */}
        {/* Dashboard view */}
        {activeView === 'dashboard' && (<>

        {/* Alert Banner */}
        {(pendingAll.length>0||criticalCount>0||oldestDelay>120)&&(
          <div className="flex items-center gap-3 flex-wrap bg-rose-950/40 border border-rose-500/30 rounded-2xl px-4 py-3">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 animate-pulse"/>
            <div className="flex flex-wrap gap-4 flex-1 text-sm">
              {pendingDept.length>0&&<span className="font-bold text-rose-300">{pendingDept.length} \u0642\u0631\u0627\u0621\u0629 \u062a\u0646\u062a\u0638\u0631 \u0627\u0639\u062a\u0645\u0627\u062f\u0643</span>}
              {pendingAll.length>pendingDept.length&&<span className="text-amber-300">{pendingAll.length-pendingDept.length} \u0639\u0646\u062f \u0627\u0644\u0645\u0634\u0631\u0641</span>}
              {criticalCount>0&&<span className="font-bold text-rose-400">\u26a1 {criticalCount} \u0625\u0646\u0630\u0627\u0631 \u062d\u0631\u062c</span>}
              {oldestDelay>120&&<span className="text-orange-300">\u23f0 \u062a\u0623\u062e\u064a\u0631 {Math.floor(oldestDelay/60)}\u0633 \u0641\u064a \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f</span>}
            </div>
          </div>
        )}

        {/* KPI Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          <KpiCard icon={Droplets}  label="\u0627\u0644\u0625\u0646\u062a\u0627\u062c \u0627\u0644\u064a\u0648\u0645" color="bg-cyan-500/20 text-cyan-400" value={kpi?(kpi.total_production_m3/1000).toFixed(0)+'k':'\u2014'} sub="\u0645\u00b3"/>
          <KpiCard icon={Activity}  label="\u0645\u062d\u0637\u0627\u062a \u0646\u0634\u0637\u0629" color="bg-emerald-500/20 text-emerald-400" value={kpi?`${kpi.active_stations}/${kpi.total_stations}`:'\u2014'} sub="\u0645\u062d\u0637\u0629"/>
          <KpiCard icon={Gauge}     label="\u0645\u062a\u0648\u0633\u0637 \u0627\u0644\u0636\u063a\u0637" color="bg-violet-500/20 text-violet-400" value={kpi?kpi.avg_pressure_bar.toFixed(1):'\u2014'} sub="\u0628\u0627\u0631"/>
          <KpiCard icon={Wind}      label="\u0645\u0636\u062e\u0627\u062a \u0646\u0634\u0637\u0629" color="bg-blue-500/20 text-blue-400" value={kpi?`${kpi.active_pumps}/${kpi.total_pumps}`:'\u2014'} sub="\u0645\u0636\u062e\u0629"/>
          <KpiCard icon={Bell}      label="\u0625\u0646\u0630\u0627\u0631\u0627\u062a \u0645\u0641\u062a\u0648\u062d\u0629" color={alarms.length>0?'bg-rose-500/20 text-rose-400':'bg-slate-700 text-slate-400'} value={String(alarms.length)} sub="\u0625\u0646\u0630\u0627\u0631 \u0646\u0634\u0637" pulse={alarms.length>0}/>
          <KpiCard icon={Timer}     label="\u0623\u0642\u0635\u0649 \u062a\u0623\u062e\u064a\u0631" color={oldestDelay>120?'bg-orange-500/20 text-orange-400':'bg-slate-700 text-slate-400'} value={oldestDelay>0?ageSince(new Date(Date.now()-oldestDelay*60000).toISOString()).label:'\u2014'} sub="\u0641\u064a \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f" pulse={oldestDelay>120}/>
          <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-3 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${healthScore>=80?'bg-emerald-500/20':healthScore>=60?'bg-amber-500/20':'bg-rose-500/20'}`}>
              {healthScore>=80?<TrendingUp className="w-4 h-4 text-emerald-400"/>:healthScore>=60?<Minus className="w-4 h-4 text-amber-400"/>:<TrendingDown className="w-4 h-4 text-rose-400"/>}
            </div>
            <div>
              <p className="text-[10px] text-slate-500 font-medium">\u0635\u062d\u0629 \u0627\u0644\u0646\u0638\u0627\u0645</p>
              <p className={`text-lg font-bold leading-none ${healthColor(healthScore)}`}>{healthScore}%</p>
              <p className="text-[9px] text-slate-600">{healthLabel(healthScore)}</p>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

          {/* Pending (3/5) */}
          <div className="lg:col-span-3 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-indigo-400"/>\u062f\u0648\u0631\u0629 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f
                {pendingAll.length>0&&<span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">{pendingAll.length}</span>}
              </h2>
              {oldestDelay>60&&<span className="text-[10px] text-orange-400 flex items-center gap-1"><Timer className="w-3 h-3"/>\u0623\u0642\u0635\u0649: {ageSince(new Date(Date.now()-oldestDelay*60000).toISOString()).label}</span>}
            </div>
            {approverId>0?(
              <div className="flex items-center gap-2 text-[11px] text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 rounded-xl px-3 py-2">
                <User className="w-3.5 h-3.5 shrink-0"/>
                {approverName?`${approverName} (#${approverId})`:`\u0627\u0644\u0645\u0639\u062a\u0645\u0650\u062f: #${approverId}`}
                <button onClick={()=>{setApproverId(0);setApproverName('');setApproverInput('');localStorage.removeItem('ctrl_approver_id');}} className="mr-auto text-slate-500 hover:text-slate-300 text-[10px]">\u062a\u063a\u064a\u064a\u0631</button>
              </div>
            ):(
              <div className="flex gap-2">
                <input value={approverInput} onChange={e=>setApproverInput(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'){const n=Number(approverInput);if(n){setApproverId(n);localStorage.setItem('ctrl_approver_id',String(n));}}}} type="number" placeholder="\u0627\u0644\u0631\u0642\u0645 \u0627\u0644\u0648\u0638\u064a\u0641\u064a \u0644\u0644\u0645\u0639\u062a\u0645\u0650\u062f"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-cyan-500"/>
                <button onClick={()=>{const n=Number(approverInput);if(n){setApproverId(n);localStorage.setItem('ctrl_approver_id',String(n));}}} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl text-sm text-white transition-colors">\u062d\u0641\u0638</button>
              </div>
            )}
            {pendingAll.length===0?(
              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl py-10 text-center text-slate-500 text-sm">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500 opacity-50"/>
                \u0644\u0627 \u062a\u0648\u062c\u062f \u0642\u0631\u0627\u0621\u0627\u062a \u0645\u0639\u0644\u0642\u0629 \u2014 \u0643\u0644 \u0634\u064a\u0621 \u0645\u064f\u0639\u062a\u0645\u064e\u062f \u2713
              </div>
            ):(
              <div className="space-y-3">
                {[...pendingDept,...pendingAll.filter(r=>r.status==='submitted')].map(r=>(
                  <PendingRow key={r.id} r={r} approverId={approverId} onDone={msg=>{showToast(msg.includes('\u062e\u0637\u0623')?'err':'ok',msg);loadAll();}}/>
                ))}
              </div>
            )}
          </div>

          {/* Alarms + Health (2/5) */}
          <div className="lg:col-span-2 space-y-4">

            <div className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Bell className="w-3.5 h-3.5 text-rose-400"/>\u0627\u0644\u0625\u0646\u0630\u0627\u0631\u0627\u062a \u0627\u0644\u0646\u0634\u0637\u0629
                {alarms.length>0&&<span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{alarms.length}</span>}
              </h2>
              {alarms.length===0?(
                <div className="bg-slate-900/40 border border-slate-800 rounded-2xl py-6 text-center text-slate-500 text-sm">
                  <Bell className="w-6 h-6 mx-auto mb-1.5 opacity-30"/>\u0644\u0627 \u062a\u0648\u062c\u062f \u0625\u0646\u0630\u0627\u0631\u0627\u062a
                </div>
              ):(
                <div className="space-y-2">
                  {alarms.map(a=><AlarmRow key={a.id} alarm={a} onAck={id=>{setAlarms(p=>p.filter(x=>x.id!==id));showToast('ok',`\u062a\u0645 \u0627\u0644\u0625\u0642\u0631\u0627\u0631 #${id}`);}}/>)}
                  <Link href="/dashboard/control-center/alarm-management" className="flex items-center justify-center gap-1.5 py-2 text-xs text-rose-400 hover:text-rose-300">
                    \u062c\u0645\u064a\u0639 \u0627\u0644\u0625\u0646\u0630\u0627\u0631\u0627\u062a <ChevronRight className="w-3.5 h-3.5"/>
                  </Link>
                </div>
              )}
            </div>

            {/* Health panel */}
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4 space-y-3">
              <h3 className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1.5"><Activity className="w-3 h-3 text-cyan-400"/>\u0645\u0624\u0634\u0631\u0627\u062a \u0635\u062d\u0629 \u0627\u0644\u0646\u0638\u0627\u0645</h3>
              <div className="space-y-2.5">
                {[
                  {label:'\u062a\u063a\u0637\u064a\u0629 \u0627\u0644\u0645\u062d\u0637\u0627\u062a',val:kpi?`${kpi.active_stations}/${kpi.total_stations}`:'\u2014',pct:kpi?(kpi.active_stations/Math.max(kpi.total_stations,1))*100:0,ok:kpi?kpi.active_stations===kpi.total_stations:true},
                  {label:'\u0645\u0639\u062f\u0644 \u0627\u0644\u0625\u0646\u0630\u0627\u0631\u0627\u062a',val:`${alarms.length} \u0646\u0634\u0637`,pct:Math.min(100,alarms.length*20),ok:alarms.length===0,invert:true},
                  {label:'\u0633\u0631\u0639\u0629 \u0627\u0644\u0627\u0639\u062a\u0645\u0627\u062f',val:pendingAll.length===0?'\u0644\u0627 \u0645\u0639\u0644\u0642':oldestDelay>0?`\u062a\u0623\u062e\u064a\u0631 ${ageSince(new Date(Date.now()-oldestDelay*60000).toISOString()).label}`:'\u0637\u0627\u0632\u0629',pct:Math.max(5,100-Math.min(100,(oldestDelay/120)*100)),ok:oldestDelay<30},
                  {label:'\u0627\u0644\u0636\u063a\u0637 \u0627\u0644\u0634\u0628\u0643\u064a',val:kpi?`${kpi.avg_pressure_bar.toFixed(1)} \u0628\u0627\u0631`:'\u2014',pct:kpi?Math.min(100,(kpi.avg_pressure_bar/8)*100):0,ok:kpi?kpi.avg_pressure_bar>=3.5&&kpi.avg_pressure_bar<=7.5:true},
                ].map(({label,val,pct,ok,invert})=>(
                  <div key={label}>
                    <div className="flex justify-between text-[10px] mb-1">
                      <span className="text-slate-400">{label}</span>
                      <span className={ok?'text-emerald-400':'text-rose-400'}>{val}</span>
                    </div>
                    <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${invert?(pct<50?'bg-rose-500':pct<80?'bg-amber-500':'bg-emerald-500'):(ok?'bg-emerald-500':'bg-rose-500')}`} style={{width:`${pct}%`}}/>
                    </div>
                  </div>
                ))}
              </div>
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-bold ${healthScore>=80?'bg-emerald-500/10 border-emerald-500/20 text-emerald-300':healthScore>=60?'bg-amber-500/10 border-amber-500/20 text-amber-300':'bg-rose-500/10 border-rose-500/20 text-rose-300'}`}>
                {healthScore>=80?<TrendingUp className="w-4 h-4 shrink-0"/>:healthScore>=60?<Minus className="w-4 h-4 shrink-0"/>:<TrendingDown className="w-4 h-4 shrink-0"/>}
                \u0635\u062d\u0629 \u0627\u0644\u0646\u0638\u0627\u0645: {healthScore}% \u2014 {healthLabel(healthScore)}
              </div>
            </div>

            {shiftInfo&&(
              <div className="bg-slate-900/40 border border-violet-500/20 rounded-2xl p-3 space-y-2">
                <h3 className="text-[10px] font-bold uppercase text-slate-500 flex items-center gap-1.5"><BookOpen className="w-3 h-3 text-violet-400"/>\u0627\u0644\u0646\u0648\u0628\u0629 \u0627\u0644\u062d\u0627\u0644\u064a\u0629</h3>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2"><User className="w-3 h-3 text-slate-500"/><span className="text-slate-300">{String(shiftInfo.operator_on_name||'\u2014')}</span></div>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3 h-3 text-slate-500"/>
                    <span className="text-slate-400">{{morning:'\u0635\u0628\u0627\u062d\u064a\u0629 06:00\u201314:00',evening:'\u0645\u0633\u0627\u0626\u064a\u0629 14:00\u201322:00',night:'\u0644\u064a\u0644\u064a\u0629 22:00\u201306:00',daily:'\u064a\u0648\u0645\u064a\u0629'}[String(shiftInfo.shift_type)]||String(shiftInfo.shift_type)}</span>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full ${shiftInfo.closed?'bg-slate-700 text-slate-400':'bg-emerald-500/20 text-emerald-300'}`}>{shiftInfo.closed?'\u0645\u063a\u0644\u0642\u0629':'\u25cf \u0646\u0634\u0637\u0629'}</span>
                  </div>
                </div>
                <Link href="/dashboard/control-center/shift-log" className="text-[10px] text-violet-400 hover:text-violet-300 flex items-center gap-1">\u0633\u062c\u0644 \u0627\u0644\u0646\u0648\u0628\u0627\u062a <ChevronRight className="w-3 h-3"/></Link>
              </div>
            )}
          </div>
        </div>

        {/* Stations */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2"><MonitorDot className="w-3.5 h-3.5 text-cyan-400"/>\u062d\u0627\u0644\u0629 \u0627\u0644\u0645\u062d\u0637\u0627\u062a ({stations.length}/14)</h2>
          </div>
          {stations.length===0?(
            <div className="bg-slate-900/40 border border-slate-800 rounded-xl py-6 text-center text-slate-500 text-sm"><FlaskConical className="w-7 h-7 mx-auto mb-2 opacity-30"/>\u0644\u0627 \u062a\u0648\u062c\u062f \u0628\u064a\u0627\u0646\u0627\u062a \u0645\u064f\u0639\u062a\u0645\u062f\u0629</div>
          ):(
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7 gap-2">
              {stations.map(s=><StationChip key={s.id} s={s}/>)}
            </div>
          )}
        </div>

        </>)}  {/* end activeView==='dashboard' */}

        {/* Quick Links */}
        {activeView === 'dashboard' && (
        <div>
          <h2 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">الوصول السريع</h2>
          <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
            {quickLinks.map(({href,icon:Icon,label,color})=>(
              <Link key={href} href={href} className={`border rounded-xl p-2.5 flex flex-col items-center gap-1.5 text-center hover:opacity-80 transition-opacity ${color}`}>
                <Icon className="w-4 h-4"/><span className="text-[9px] font-semibold leading-tight">{label}</span>
              </Link>
            ))}
          </div>
        </div>
        )}

        {/* Internal Mail Tab */}
        {activeView === 'mail' && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Mail className="w-4 h-4 text-amber-400"/>
              </div>
              <div>
                <h2 className="text-base font-bold text-white">المراسلات الإدارية الداخلية — إدارة التحكم</h2>
                <p className="text-xs text-slate-500">الوارد والصادر والتعميمات لجميع الإدارات</p>
              </div>
            </div>
            <InternalMailTab department="control_manager" />
          </div>
        )}

      </div>
    </div>
  );
}
