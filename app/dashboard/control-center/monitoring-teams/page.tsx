'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import {
  ArrowRight, Users, MapPin, Radio, Plus, Save,
  X, ChevronDown, ChevronUp, User, RefreshCw, Clock,
  AlertCircle, Phone, Trash2, Loader2,
} from 'lucide-react';

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token') || '';
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

interface Employee { id: number; employee_number: string; full_name_ar: string; full_name_en: string; phone?: string | null; }
interface TeamMember { employee_id: number; employee_number: string; name_ar: string; role: 'رئيس فريق' | 'راصد' | 'مساعد'; phone?: string | null; }
interface MonitoringTeam {
  id: string; station_id: string; station_name: string; station_name_en: string;
  zone: string; lat: number; lng: number;
  shift: 'صباحي' | 'مسائي' | 'ليلي' | 'على مدار اليوم';
  members: TeamMember[]; notes: string; status: 'نشط' | 'متوقف' | 'طارئ';
}

const STATIONS = [
  { id: 'NEJHN', name: 'حقل شمال شرق جبال الحساوينة', name_en: 'NEJH-N', zone: 'حقول الآبار', lat: 31.85, lng: 12.72 },
  { id: 'NEJHS', name: 'حقل شمال شرق جبل الحساونة', name_en: 'NEJH-S', zone: 'حقول الآبار', lat: 31.72, lng: 12.68 },
  { id: 'EJH', name: 'حقل شرق جبل الحساونة', name_en: 'EJH', zone: 'حقول الآبار', lat: 31.61, lng: 12.75 },
  { id: 'FEZZAN', name: 'خزان فزان', name_en: 'Fezzan Tank', zone: 'خزانات رئيسية', lat: 31.55, lng: 12.90 },
  { id: 'TARH', name: 'خزان ترهونة + محطة الضخ', name_en: 'Tarhunah', zone: 'المسار الأوسط', lat: 32.43, lng: 13.62 },
  { id: 'SIDSD', name: 'خزان سيدي الصيد', name_en: 'Sidi Al-Said', zone: 'المسار الأوسط', lat: 32.65, lng: 13.27 },
  { id: 'ABUA', name: 'خزان أبو عائشة', name_en: 'Abu Aisha', zone: 'المسار الأوسط', lat: 32.71, lng: 13.18 },
  { id: 'PS1', name: 'محطة الضخ PS-1', name_en: 'Pump Station 1', zone: 'TAZ', lat: 32.78, lng: 13.05 },
  { id: 'PS2', name: 'محطة الضخ PS-2', name_en: 'Pump Station 2', zone: 'TAZ', lat: 32.80, lng: 13.07 },
  { id: 'ABUZY', name: 'خزان أبو زيان', name_en: 'Abu Zayan', zone: 'TAZ', lat: 32.88, lng: 13.12 },
  { id: 'SHWRM', name: 'الشويرف المسار الأوسط', name_en: 'Shwayrif Central', zone: 'نقاط تحكم', lat: 31.98, lng: 12.88 },
  { id: 'AIRP', name: 'صمامات التحكم بطريق المطار', name_en: 'Airport Valves', zone: 'المسار الشرقي', lat: 32.66, lng: 13.28 },
  { id: 'SISAI', name: 'خزان سيدي السايح', name_en: 'Sidi Al-Sayeh', zone: 'المسار الشرقي', lat: 32.72, lng: 13.34 },
  { id: 'QRBL', name: 'خزان القرابوللي', name_en: 'Qaraboli', zone: 'المسار الشرقي', lat: 32.76, lng: 13.48 },
  { id: 'WADI', name: 'محطة التحكم بالتدفق وادي تمالة', name_en: 'Wadi Tamala', zone: 'المسار الشرقي', lat: 32.68, lng: 13.55 },
  { id: 'SHWRE', name: 'الشويرف المسار الشرقي', name_en: 'Shwayrif East', zone: 'المسار الشرقي', lat: 32.04, lng: 13.22 },
];

const ZONES = ['الكل', 'حقول الآبار', 'خزانات رئيسية', 'المسار الأوسط', 'TAZ', 'نقاط تحكم', 'المسار الشرقي'];
const STATUS_CFG = {
  'نشط':   { cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  'متوقف': { cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
  'طارئ':  { cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30', dot: 'bg-rose-400 animate-pulse' },
} as const;
const SHIFT_CFG = {
  'صباحي': { label: '06:00–14:00', color: 'text-amber-400' },
  'مسائي': { label: '14:00–22:00', color: 'text-blue-400' },
  'ليلي':  { label: '22:00–06:00', color: 'text-violet-400' },
  'على مدار اليوم': { label: '24/7', color: 'text-emerald-400' },
} as const;

export default function MonitoringTeamsPage() {
  const [teams, setTeams] = useState<MonitoringTeam[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterZone, setFilterZone] = useState('الكل');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newStation, setNewStation] = useState('');
  const [newShift, setNewShift] = useState<MonitoringTeam['shift']>('صباحي');
  const [newMemberEmpId, setNewMemberEmpId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState<TeamMember['role']>('راصد');
  const [newNotes, setNewNotes] = useState('');
  const [tempMembers, setTempMembers] = useState<TeamMember[]>([]);
  const formRef = useRef<HTMLDivElement>(null);

  const loadTeams = useCallback(async () => {
    setLoadingTeams(true);
    try {
      const res = await fetch('/api/control-center/monitoring-teams', { cache: 'no-store', headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); if (d.success) setTeams(d.teams ?? []); }
    } catch { /* ignore */ }
    setLoadingTeams(false);
  }, []);

  const loadEmployees = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const res = await fetch('/api/control-center/employees', { headers: getAuthHeaders() });
      if (res.ok) { const d = await res.json(); if (d.success) setEmployees(d.employees.filter((e: Employee) => e.full_name_ar?.trim())); }
    } catch { /* ignore */ }
    setLoadingEmp(false);
  }, []);

  useEffect(() => { loadTeams(); loadEmployees(); }, [loadTeams, loadEmployees]);

  useEffect(() => {
    if (showAddForm && formRef.current) {
      setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    }
  }, [showAddForm]);

  const filteredTeams = filterZone === 'الكل' ? teams : teams.filter(t => t.zone === filterZone);
  const totalMembers = teams.reduce((s, t) => s + t.members.length, 0);
  const activeTeams = teams.filter(t => t.status === 'نشط').length;

  const addMemberToTemp = () => {
    const emp = employees.find(e => e.id === +newMemberEmpId);
    if (!emp || tempMembers.find(m => m.employee_id === emp.id)) return;
    setTempMembers(prev => [...prev, { employee_id: emp.id, employee_number: emp.employee_number || String(emp.id), name_ar: emp.full_name_ar || emp.full_name_en, role: newMemberRole, phone: emp.phone ?? null }]);
    setNewMemberEmpId('');
  };

  const saveNewTeam = async () => {
    const station = STATIONS.find(s => s.id === newStation);
    if (!station || tempMembers.length === 0) return;
    setSaving(true);
    try {
      const res = await fetch('/api/control-center/monitoring-teams', {
        method: 'POST', headers: getAuthHeaders(),
        body: JSON.stringify({ station_id: station.id, station_name: station.name, station_name_en: station.name_en, zone: station.zone, lat: station.lat, lng: station.lng, shift: newShift, status: 'نشط', notes: newNotes, members: tempMembers }),
      });
      const d = await res.json();
      if (d.success) { setTeams(d.teams ?? []); setShowAddForm(false); setNewStation(''); setNewShift('صباحي'); setTempMembers([]); setNewNotes(''); if (d.id) setExpandedId(d.id); }
    } catch { /* ignore */ }
    setSaving(false);
  };

  const removeTeam = async (id: string) => {
    try { const res = await fetch(`/api/control-center/monitoring-teams/${id}`, { method: 'DELETE', headers: getAuthHeaders() }); const d = await res.json(); if (d.success) setTeams(d.teams ?? []); } catch { /* ignore */ }
  };

  const cycleStatus = async (id: string) => {
    const team = teams.find(t => t.id === id); if (!team) return;
    const next = (['نشط', 'متوقف', 'طارئ'] as MonitoringTeam['status'][]);
    const nextStatus = next[(next.indexOf(team.status) + 1) % 3];
    setTeams(prev => prev.map(t => t.id === id ? { ...t, status: nextStatus } : t));
    try { await fetch(`/api/control-center/monitoring-teams/${id}`, { method: 'PATCH', headers: getAuthHeaders(), body: JSON.stringify({ status: nextStatus }) }); } catch { /* ignore */ }
  };

  const openAddForStation = (stationId: string) => {
    setNewStation(stationId); setTempMembers([]); setNewNotes(''); setNewShift('صباحي'); setShowAddForm(true);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <Link href="/dashboard/control-center" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> إدارة التحكم
          </Link>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">فرق الرصد الميداني</h1>
                <p className="text-xs text-slate-500 mt-0.5">{teams.length} فريق · {totalMembers} راصد</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => { loadTeams(); loadEmployees(); }} disabled={loadingTeams} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors">
                <RefreshCw className={`w-3.5 h-3.5 ${loadingTeams ? 'animate-spin' : ''}`} /> تحديث
              </button>
              <button onClick={() => { setShowAddForm(v => !v); if (!showAddForm) { setNewStation(''); setTempMembers([]); } }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-500 transition-colors font-semibold">
                <Plus className="w-3.5 h-3.5" /> إنشاء فريق جديد
              </button>
            </div>
          </div>
        </div>

        {/* KPI */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'إجمالي الفرق', value: teams.length, color: 'text-violet-400' },
            { label: 'فرق نشطة', value: activeTeams, color: 'text-emerald-400' },
            { label: 'إجمالي الراصدين', value: totalMembers, color: 'text-cyan-400' },
            { label: 'محطات مغطاة', value: new Set(teams.map(t => t.station_id)).size, color: 'text-amber-400' },
          ].map(k => (
            <div key={k.label} className="bg-slate-900/50 border border-slate-800 rounded-xl p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">{k.label}</p>
              <p className={`text-2xl font-bold font-mono ${k.color}`}>{k.value}</p>
            </div>
          ))}
        </div>

        {/* Zone filter */}
        <div className="flex flex-wrap gap-2">
          {ZONES.map(z => (
            <button key={z} onClick={() => setFilterZone(z)} className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${filterZone === z ? 'bg-violet-600 text-white' : 'bg-slate-800 text-slate-400 hover:bg-slate-700'}`}>{z}</button>
          ))}
        </div>

        {/* Add form */}
        {showAddForm && (
          <div ref={formRef} className="bg-slate-900 border border-violet-500/40 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-violet-300">إنشاء فريق رصد جديد</h3>
              <button onClick={() => setShowAddForm(false)} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-slate-400 block mb-1">المحطة / الخزان</label>
                <select value={newStation} onChange={e => setNewStation(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                  <option value="">اختر محطة...</option>
                  {STATIONS.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">نوبة العمل</label>
                <select value={newShift} onChange={e => setNewShift(e.target.value as MonitoringTeam['shift'])} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                  {(['صباحي', 'مسائي', 'ليلي', 'على مدار اليوم'] as const).map(s => <option key={s} value={s}>{s} ({SHIFT_CFG[s].label})</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">إضافة راصد من قائمة الموظفين {loadingEmp && <Loader2 className="inline w-3 h-3 mr-1 animate-spin" />}</label>
              <div className="flex gap-2">
                <select value={newMemberEmpId} onChange={e => setNewMemberEmpId(e.target.value)} className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                  <option value="">اختر موظفاً...</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.full_name_ar || e.full_name_en}</option>)}
                </select>
                <select value={newMemberRole} onChange={e => setNewMemberRole(e.target.value as TeamMember['role'])} className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500">
                  <option value="رئيس فريق">رئيس فريق</option>
                  <option value="راصد">راصد</option>
                  <option value="مساعد">مساعد</option>
                </select>
                <button onClick={addMemberToTemp} disabled={!newMemberEmpId} className="px-3 py-2 rounded-lg bg-violet-600 text-white text-xs hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"><Plus className="w-4 h-4" /></button>
              </div>
              {tempMembers.length > 0 && (
                <div className="mt-2 space-y-1">
                  {tempMembers.map(m => (
                    <div key={m.employee_id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-3 py-1.5 text-xs">
                      <span className="text-slate-200">{m.name_ar}</span>
                      <span className="text-violet-300">{m.role}</span>
                      <button onClick={() => setTempMembers(prev => prev.filter(x => x.employee_id !== m.employee_id))} className="text-slate-500 hover:text-rose-400"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs text-slate-400 block mb-1">ملاحظات (اختياري)</label>
              <input value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-violet-500" placeholder="مثال: يغطي المجمع الشمالي بالكامل..." />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddForm(false)} className="px-4 py-2 rounded-lg text-xs bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors">إلغاء</button>
              <button onClick={saveNewTeam} disabled={!newStation || tempMembers.length === 0 || saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs bg-violet-600 text-white hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-semibold">
                {saving ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> جاري الحفظ...</> : <><Save className="w-3.5 h-3.5" /> حفظ الفريق</>}
              </button>
            </div>
          </div>
        )}

        {/* Teams list */}
        {loadingTeams ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin ml-2" /><span className="text-sm">جاري تحميل الفرق...</span>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTeams.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <Users className="w-8 h-8 mx-auto mb-2 opacity-30" /><p className="text-sm">لا توجد فرق في هذه المنطقة</p>
              </div>
            )}
            {filteredTeams.map(team => {
              const sc = STATUS_CFG[team.status];
              const shiftCfg = SHIFT_CFG[team.shift];
              const isExpanded = expandedId === team.id;
              return (
                <div key={team.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-slate-700 transition-colors">
                  <div className="flex items-center gap-3 p-4 cursor-pointer select-none" onClick={() => setExpandedId(isExpanded ? null : team.id)}>
                    <div className="w-10 h-10 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-violet-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-white text-sm">{team.station_name}</p>
                        <span className="text-[10px] text-slate-500 font-mono">{team.station_name_en}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Radio className="w-3 h-3" /> {team.zone}</span>
                        <span className={`flex items-center gap-1 ${shiftCfg.color}`}><Clock className="w-3 h-3" /> {team.shift} · {shiftCfg.label}</span>
                        <span className="flex items-center gap-1"><User className="w-3 h-3" /> {team.members.length} راصد</span>
                      </div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); cycleStatus(team.id); }} className={`shrink-0 flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${sc.cls}`} title="انقر لتغيير الحالة">
                      <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{team.status}
                    </button>
                    <div className="text-slate-600 shrink-0">{isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</div>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-slate-800 p-4 space-y-4">
                      <div>
                        <p className="text-xs text-slate-400 uppercase tracking-wide mb-2 font-semibold">أعضاء الفريق</p>
                        <div className="space-y-2">
                          {team.members.map((m, i) => (
                            <div key={i} className="flex items-center gap-3 bg-slate-800/50 rounded-xl px-3 py-2.5">
                              <div className="w-8 h-8 rounded-full bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shrink-0">
                                <User className="w-4 h-4 text-violet-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-white">{m.name_ar}</p>
                                <p className="text-[10px] text-slate-500">{m.role}</p>
                              </div>
                              {m.phone && <a href={`tel:${m.phone}`} className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300" onClick={e => e.stopPropagation()}><Phone className="w-3 h-3" /> {m.phone}</a>}
                              {m.role === 'رئيس فريق' && <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">رئيس</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl">
                        <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                        <div className="flex-1">
                          <p className="text-xs text-slate-300 font-medium">الموقع الجغرافي</p>
                          <p className="text-[10px] text-slate-500 font-mono">{team.lat?.toFixed(4)}° N · {team.lng?.toFixed(4)}° E</p>
                        </div>
                        <a href={`https://www.openstreetmap.org/?mlat=${team.lat}&mlon=${team.lng}&zoom=14`} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 px-2 py-1 rounded-lg transition-colors" onClick={e => e.stopPropagation()}>فتح الخريطة ↗</a>
                      </div>
                      {team.notes && (
                        <div className="p-3 bg-slate-800/40 rounded-xl">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">ملاحظات</p>
                          <p className="text-sm text-slate-300">{team.notes}</p>
                        </div>
                      )}
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                        <button onClick={() => removeTeam(team.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" /> حذف الفريق
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Stations without teams */}
        {!loadingTeams && (
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-3">محطات بدون فريق رصد مخصص</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {STATIONS.filter(s => !teams.find(t => t.station_id === s.id)).map(s => (
                <button key={s.id} onClick={() => openAddForStation(s.id)}
                  className="flex items-center gap-3 p-3 rounded-xl border border-slate-800 bg-slate-900/40 hover:border-violet-500/30 hover:bg-slate-800/60 transition-all text-right group">
                  <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-4 h-4 text-slate-600 group-hover:text-violet-400 transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-300 font-medium truncate">{s.name}</p>
                    <p className="text-[10px] text-slate-600">{s.zone}</p>
                  </div>
                  <Plus className="w-4 h-4 text-slate-700 group-hover:text-violet-400 transition-colors mr-auto shrink-0" />
                </button>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
