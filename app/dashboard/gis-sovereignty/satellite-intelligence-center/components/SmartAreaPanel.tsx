'use client';
// ─── SmartAreaPanel — Phase S12 ───────────────────────────────────────────────
// Save the current drawn area, list saved areas, reopen them on map.

import React, { useState, useEffect } from 'react';
import {
  Save, Folder, Trash2, RefreshCw, MapPin, ChevronLeft, Plus,
} from 'lucide-react';
import {
  saveSmartArea, listSmartAreas, deleteSmartArea,
  type SmartArea,
} from '@/lib/s12API';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';

// ─── Time helper without date-fns if not available ────────────────────────────

function relativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1)   return 'الآن';
    if (mins < 60)  return `منذ ${mins} دقيقة`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)   return `منذ ${hrs} ساعة`;
    const days = Math.floor(hrs / 24);
    return `منذ ${days} يوم`;
  } catch { return ''; }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  currentBbox?:    [number, number, number, number] | null;
  currentPolygon?: [number, number][] | null;
  onLoadArea?:     (area: SmartArea) => void;
  activeAreaId?:   string | null;
}

export default function SmartAreaPanel({
  currentBbox, currentPolygon, onLoadArea, activeAreaId,
}: Props) {
  const [areas,    setAreas]    = useState<SmartArea[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [name,     setName]     = useState('');
  const [error,    setError]    = useState<string | null>(null);
  const [showSave, setShowSave] = useState(false);

  const hasGeom = !!(currentBbox || currentPolygon);

  const load = async () => {
    setLoading(true);
    try { setAreas(await listSmartAreas()); } catch (_) {} finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const handleSave = async () => {
    if (!hasGeom) return;
    setSaving(true); setError(null);
    try {
      await saveSmartArea({
        name:    name.trim() || undefined,
        bbox:    currentBbox    ?? undefined,
        polygon: currentPolygon ?? undefined,
      });
      setName(''); setShowSave(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'فشل الحفظ');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try { await deleteSmartArea(id); await load(); } catch (_) {} finally { setDeleting(null); }
  };

  return (
    <div className="p-3 space-y-3" dir="rtl">

      {/* Save current area */}
      {hasGeom && (
        <div className="bg-slate-800/40 border border-slate-700/30 rounded-xl p-3">
          {!showSave ? (
            <button
              onClick={() => setShowSave(true)}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-semibold text-emerald-300 hover:text-emerald-200 transition-colors"
            >
              <Plus size={12} />
              حفظ المنطقة الحالية
            </button>
          ) : (
            <div className="space-y-2">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="اسم المنطقة (اختياري)"
                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-emerald-600/20 border border-emerald-600/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-600/30 disabled:opacity-40 transition-colors"
                >
                  {saving ? <RefreshCw size={11} className="animate-spin" /> : <Save size={11} />}
                  {saving ? 'جارٍ الحفظ…' : 'حفظ'}
                </button>
                <button
                  onClick={() => setShowSave(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-500 text-xs hover:text-slate-300 transition-colors"
                >
                  إلغاء
                </button>
              </div>
              {error && <p className="text-[11px] text-rose-400">{error}</p>}
            </div>
          )}
        </div>
      )}

      {/* Saved areas list */}
      <div>
        <div className="flex items-center justify-between mb-2 px-0.5">
          <div className="flex items-center gap-1.5">
            <Folder size={11} className="text-slate-500" />
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              المناطق المحفوظة
            </span>
          </div>
          <button onClick={load} className="text-slate-600 hover:text-slate-400 transition-colors">
            <RefreshCw size={10} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>

        {areas.length === 0 && !loading && (
          <p className="text-xs text-slate-600 text-center py-4">
            لا توجد مناطق محفوظة بعد
          </p>
        )}

        <div className="space-y-1.5">
          {areas.map(area => (
            <div
              key={area.id}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-colors ${
                activeAreaId === area.id
                  ? 'bg-blue-950/40 border-blue-700/40'
                  : 'bg-slate-800/40 border-slate-700/30 hover:bg-slate-800/60'
              }`}
            >
              <MapPin size={11} className={activeAreaId === area.id ? 'text-blue-400' : 'text-slate-500'} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{area.name}</p>
                <p className="text-[9px] text-slate-600">{relativeTime(area.created_at)}</p>
              </div>
              <button
                onClick={() => onLoadArea?.(area)}
                className="text-xs text-blue-400 hover:text-blue-300 transition-colors shrink-0"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                onClick={() => handleDelete(area.id)}
                disabled={deleting === area.id}
                className="text-slate-600 hover:text-rose-400 transition-colors shrink-0"
              >
                {deleting === area.id
                  ? <RefreshCw size={11} className="animate-spin" />
                  : <Trash2 size={11} />
                }
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
