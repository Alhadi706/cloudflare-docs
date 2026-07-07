'use client';
/**
 * StudyLayerBar — إدارة طبقات الدراسة — قائمة منسدلة في الشريط العلوي
 *
 * تصميم واضح:
 * - قائمة منسدلة مرتبطة بالزر (لا بطاقة عائمة)
 * - إنشاء طبقة: نموذج مضمّن بداخل القائمة
 * - حذف: تأكيد داخلي بدون نافذة خارجية
 * - مؤشر واضح للطبقة النشطة + زر إغلاق
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Layers3, Plus, FolderOpen, Trash2, X,
  ChevronDown, Loader2, Check, Pencil, AlertTriangle,
} from 'lucide-react';
import {
  listStudyLayers,
  createStudyLayer,
  deleteStudyLayer,
  updateStudyLayer,
  type StudyLayerSummary,
} from '@/lib/studyLayersAPI';

interface StudyLayerBarProps {
  activeLayer:    StudyLayerSummary | null;
  onOpenLayer:    (layer: StudyLayerSummary) => void;
  onCloseLayer:   () => void;
  onLayersChange: (layers: StudyLayerSummary[]) => void;
}

const PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];

export default function StudyLayerBar({
  activeLayer, onOpenLayer, onCloseLayer, onLayersChange,
}: StudyLayerBarProps) {
  const [open,          setOpen]          = useState(false);
  const [layers,        setLayers]        = useState<StudyLayerSummary[]>([]);
  const [loading,       setLoading]       = useState(false);
  const [showNewForm,   setShowNewForm]   = useState(false);
  const [newName,       setNewName]       = useState('');
  const [newColor,      setNewColor]      = useState(PALETTE[0]);
  const [creating,      setCreating]      = useState(false);
  const [createError,   setCreateError]   = useState('');
  const [renamingId,    setRenamingId]    = useState<string | null>(null);
  const [renameVal,     setRenameVal]     = useState('');
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const btnRef    = useRef<HTMLButtonElement>(null);
  const dropRef   = useRef<HTMLDivElement>(null);
  const nameRef   = useRef<HTMLInputElement>(null);
  const renameRef = useRef<HTMLInputElement>(null);
  const [dropStyle, setDropStyle] = useState<React.CSSProperties>({});

  // ── Position the dropdown below the button ────────────────────────────────
  useEffect(() => {
    if (!open || !btnRef.current) return;
    const rect = btnRef.current.getBoundingClientRect();
    setDropStyle({
      position: 'fixed',
      top:      rect.bottom + 3,
      right:    window.innerWidth - rect.right,
      minWidth: Math.max(rect.width, 300),
      zIndex:   9999,
    });
  }, [open]);

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (
        dropRef.current && !dropRef.current.contains(e.target as Node) &&
        btnRef.current  && !btnRef.current.contains(e.target as Node)
      ) { setOpen(false); setShowNewForm(false); setDeletingId(null); setRenamingId(null); }
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // ── Load ──────────────────────────────────────────────────────────────────
  const loadLayers = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listStudyLayers();
      setLayers(list);
      onLayersChange(list);
      const used = new Set(list.map(l => l.color));
      setNewColor(PALETTE.find(c => !used.has(c)) ?? PALETTE[list.length % PALETTE.length]);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [onLayersChange]);

  useEffect(() => { if (open) loadLayers(); }, [open, loadLayers]);
  useEffect(() => { if (showNewForm) setTimeout(() => nameRef.current?.focus(), 40); }, [showNewForm]);
  useEffect(() => { if (renamingId)  setTimeout(() => renameRef.current?.focus(), 40); }, [renamingId]);

  // ── Create ────────────────────────────────────────────────────────────────
  async function handleCreate() {
    const name = newName.trim();
    if (!name) { setCreateError('اكتب اسم الطبقة أولاً'); return; }
    if (layers.some(l => l.name === name)) { setCreateError('هذا الاسم موجود مسبقاً'); return; }
    setCreating(true); setCreateError('');
    try {
      const layer = await createStudyLayer(name, newColor);
      const updated = [layer, ...layers];
      setLayers(updated);
      onLayersChange(updated);
      setNewName(''); setShowNewForm(false);
      onOpenLayer(layer);
      setOpen(false);
    } catch { setCreateError('فشل الإنشاء، حاول مجدداً'); }
    finally { setCreating(false); }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDeleteConfirm(id: string) {
    setDeleteLoading(true);
    try {
      await deleteStudyLayer(id);
      const updated = layers.filter(l => l.id !== id);
      setLayers(updated); onLayersChange(updated); setDeletingId(null);
      if (activeLayer?.id === id) onCloseLayer();
    } catch { /* silent */ }
    finally { setDeleteLoading(false); }
  }

  // ── Rename ────────────────────────────────────────────────────────────────
  async function handleRenameCommit(layer: StudyLayerSummary) {
    const name = renameVal.trim();
    if (!name || name === layer.name) { setRenamingId(null); return; }
    try {
      const updated = await updateStudyLayer(layer.id, { name });
      setLayers(prev => prev.map(l => l.id === layer.id ? { ...l, name: updated.name } : l));
      if (activeLayer?.id === layer.id) onOpenLayer({ ...activeLayer, name: updated.name });
      setRenamingId(null);
    } catch { setRenamingId(null); }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative shrink-0 flex items-center gap-1" dir="rtl">

      {/* ── Active layer pill ──────────────────────────────────────────── */}
      {activeLayer && (
        <div
          className="flex items-center gap-1.5 h-7 px-2 rounded-md border text-xs font-medium"
          style={{ borderColor: activeLayer.color + '70', backgroundColor: activeLayer.color + '18', color: activeLayer.color }}
        >
          <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: activeLayer.color }} />
          <span className="max-w-[110px] truncate">{activeLayer.name}</span>
          <button
            onClick={onCloseLayer}
            className="flex items-center gap-0.5 h-5 px-1.5 mr-0.5 rounded text-[10px] font-semibold bg-black/20 hover:bg-black/40 text-white/90 transition-colors whitespace-nowrap"
            title="إغلاق الطبقة والرجوع للوضع الافتراضي"
          >
            <Check size={9} />إغلاق
          </button>
        </div>
      )}

      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        ref={btnRef}
        onClick={() => { setOpen(s => !s); setShowNewForm(false); setDeletingId(null); setRenamingId(null); }}
        className={`flex items-center gap-1.5 h-7 px-2.5 rounded-md border text-xs font-medium transition-all ${
          open
            ? 'bg-slate-700 border-slate-500 text-white'
            : activeLayer
              ? 'bg-slate-800/60 border-slate-600 text-slate-300 hover:bg-slate-700'
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
        }`}
      >
        <Layers3 size={12} className={open || activeLayer ? 'text-blue-400' : 'text-slate-500'} />
        <span>طبقاتي</span>
        {layers.length > 0 && !open && (
          <span className="text-[9px] bg-slate-700 text-slate-400 rounded px-1">{layers.length}</span>
        )}
        <ChevronDown size={9} className={`transition-transform duration-150 ${open ? 'rotate-180' : ''} text-slate-500`} />
      </button>

      {/* ══════════════════════════════════════════════════════════════════
          DROPDOWN
      ══════════════════════════════════════════════════════════════════ */}
      {open && (
        <div
          ref={dropRef}
          style={dropStyle}
          className="rounded-xl border border-slate-700 bg-slate-950 shadow-2xl overflow-hidden"
          dir="rtl"
        >
          {/* ── Header ───────────────────────────────────────────── */}
          <div className="flex items-center justify-between px-3 py-2.5 bg-slate-900 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Layers3 size={13} className="text-blue-400" />
              <span className="text-xs font-bold text-slate-200">طبقات الدراسة</span>
              {layers.length > 0 && (
                <span className="text-[10px] text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-full">{layers.length}</span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => { setShowNewForm(s => !s); setDeletingId(null); setRenamingId(null); }}
                className={`flex items-center gap-1 h-6 px-2 rounded text-[11px] font-medium transition-colors ${
                  showNewForm
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-800 hover:bg-blue-900/40 text-slate-300 hover:text-blue-300 border border-slate-700 hover:border-blue-600/50'
                }`}
              >
                <Plus size={10} />{showNewForm ? 'إلغاء' : 'طبقة جديدة'}
              </button>
              <button onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-300 p-0.5 rounded">
                <X size={12} />
              </button>
            </div>
          </div>

          {/* ── New Layer Form ────────────────────────────────────── */}
          {showNewForm && (
            <div className="px-3 py-3 bg-blue-950/20 border-b border-blue-900/30">
              <p className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider mb-2.5">إنشاء طبقة جديدة</p>

              <input
                ref={nameRef}
                value={newName}
                onChange={e => { setNewName(e.target.value); setCreateError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
                placeholder="مثال: مسار الطريق المقترح، دراسة موقع المحطة..."
                className="w-full h-8 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-blue-500 mb-2.5"
              />

              {/* Color picker */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[10px] text-slate-500 shrink-0">لون الطبقة:</span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PALETTE.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      title={c}
                      className={`w-5 h-5 rounded-full transition-all ${
                        newColor === c
                          ? 'ring-2 ring-white ring-offset-1 ring-offset-slate-950 scale-110'
                          : 'opacity-60 hover:opacity-100 hover:scale-110'
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {createError && (
                <p className="flex items-center gap-1 text-[11px] text-rose-400 mb-2.5">
                  <AlertTriangle size={10} />{createError}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleCreate}
                  disabled={creating || !newName.trim()}
                  className="flex items-center justify-center gap-1.5 h-8 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold transition-colors flex-1"
                >
                  {creating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                  {creating ? 'جاري الإنشاء...' : 'إنشاء وفتح الطبقة'}
                </button>
                <button
                  onClick={() => { setShowNewForm(false); setNewName(''); setCreateError(''); }}
                  className="h-8 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs border border-slate-700 transition-colors"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* ── Layers List ───────────────────────────────────────── */}
          <div className="max-h-72 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-slate-500">
                <Loader2 size={14} className="animate-spin" />
                <span className="text-xs">جاري التحميل...</span>
              </div>
            ) : layers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                <Layers3 size={28} className="text-slate-700 mb-2.5" />
                <p className="text-sm text-slate-500 font-medium">لا توجد طبقات بعد</p>
                <p className="text-xs text-slate-600 mt-1 mb-3 leading-relaxed">
                  أنشئ طبقة لبدء الرسم والدراسة على الخريطة
                </p>
                <button
                  onClick={() => setShowNewForm(true)}
                  className="flex items-center gap-1.5 h-7 px-3 rounded-lg bg-blue-700/30 hover:bg-blue-700/50 text-blue-300 text-xs border border-blue-700/40 transition-colors"
                >
                  <Plus size={10} />إنشاء أول طبقة
                </button>
              </div>
            ) : (
              <>
                {/* Column header */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/40">
                  <span className="text-[9px] text-slate-600 uppercase tracking-wider flex-1">الطبقة</span>
                  <span className="text-[9px] text-slate-600 uppercase tracking-wider text-center w-14">عناصر</span>
                  <span className="text-[9px] text-slate-600 uppercase tracking-wider text-center w-24">الإجراءات</span>
                </div>

                {layers.map(layer => {
                  const active   = activeLayer?.id === layer.id;
                  const deleting = deletingId === layer.id;
                  const renaming = renamingId === layer.id;

                  return (
                    <div key={layer.id} className={`border-b border-slate-800/30 last:border-0 transition-colors ${active ? 'bg-slate-800/40' : 'hover:bg-slate-900/60'}`}>

                      {/* ── Normal row ────────────────────────── */}
                      {!deleting && !renaming && (
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          {/* Color */}
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 border border-white/20"
                            style={{ backgroundColor: layer.color }}
                          />

                          {/* Name + meta */}
                          <div className="flex-1 min-w-0">
                            <div className={`text-xs font-medium truncate ${active ? 'text-white' : 'text-slate-200'}`}>
                              {layer.name}
                              {active && (
                                <span className="mr-1.5 text-[9px] bg-blue-600/30 text-blue-400 px-1.5 py-0.5 rounded-full align-middle">نشطة</span>
                              )}
                            </div>
                            <div className="text-[10px] text-slate-600 mt-0.5">
                              {new Date(layer.created_at).toLocaleDateString('ar-LY', { day: 'numeric', month: 'short' })}
                            </div>
                          </div>

                          {/* Feature count */}
                          <div className="w-14 flex justify-center">
                            {layer.feature_count > 0
                              ? <span className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded-full">{layer.feature_count}</span>
                              : <span className="text-[10px] text-slate-700">فارغة</span>
                            }
                          </div>

                          {/* Actions */}
                          <div className="w-24 flex items-center justify-end gap-1">
                            {active ? (
                              <button
                                onClick={() => { onCloseLayer(); setOpen(false); }}
                                className="flex items-center gap-1 h-6 px-2 rounded bg-green-700/25 hover:bg-green-600/40 text-green-400 text-[10px] font-semibold border border-green-700/35 transition-colors"
                                title="إغلاق الطبقة"
                              >
                                <Check size={9} />إغلاق
                              </button>
                            ) : (
                              <button
                                onClick={() => { onOpenLayer(layer); setOpen(false); }}
                                className="flex items-center gap-1 h-6 px-2 rounded bg-blue-700/20 hover:bg-blue-600/35 text-blue-400 text-[10px] font-semibold border border-blue-700/30 transition-colors"
                                title="فتح الطبقة للعمل"
                              >
                                <FolderOpen size={9} />فتح
                              </button>
                            )}
                            <button
                              onClick={() => { setRenamingId(layer.id); setRenameVal(layer.name); setDeletingId(null); }}
                              className="p-1 rounded text-slate-600 hover:text-slate-300 hover:bg-slate-700/50 transition-colors"
                              title="تعديل الاسم"
                            >
                              <Pencil size={10} />
                            </button>
                            <button
                              onClick={() => { setDeletingId(layer.id); setRenamingId(null); }}
                              className="p-1 rounded text-slate-700 hover:text-rose-400 hover:bg-rose-900/20 transition-colors"
                              title="حذف الطبقة"
                            >
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* ── Rename row ────────────────────────── */}
                      {renaming && (
                        <div className="flex items-center gap-2 px-3 py-2.5">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: layer.color }} />
                          <input
                            ref={renameRef}
                            value={renameVal}
                            onChange={e => setRenameVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter')  handleRenameCommit(layer);
                              if (e.key === 'Escape') setRenamingId(null);
                            }}
                            className="flex-1 h-7 px-2 rounded bg-slate-800 border border-blue-500/50 text-xs text-slate-100 focus:outline-none"
                          />
                          <button
                            onClick={() => handleRenameCommit(layer)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-blue-600/30 hover:bg-blue-500/50 text-blue-400 border border-blue-600/40"
                          >
                            <Check size={10} />
                          </button>
                          <button
                            onClick={() => setRenamingId(null)}
                            className="h-6 w-6 flex items-center justify-center rounded bg-slate-800 hover:bg-slate-700 text-slate-500 border border-slate-700"
                          >
                            <X size={10} />
                          </button>
                        </div>
                      )}

                      {/* ── Delete confirm ────────────────────── */}
                      {deleting && (
                        <div className="px-3 py-3 bg-rose-950/25 border-r-2 border-rose-600/50">
                          <div className="flex items-start gap-2 mb-2.5">
                            <AlertTriangle size={13} className="text-rose-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-rose-300 leading-relaxed">
                              سيتم حذف <strong>"{layer.name}"</strong> نهائياً
                              {layer.feature_count > 0 && ` مع ${layer.feature_count} عنصر محفوظ`}.
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleDeleteConfirm(layer.id)}
                              disabled={deleteLoading}
                              className="flex items-center gap-1 h-6 px-3 rounded bg-rose-600 hover:bg-rose-500 disabled:opacity-40 text-white text-[10px] font-semibold transition-colors"
                            >
                              {deleteLoading ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                              نعم، احذف
                            </button>
                            <button
                              onClick={() => setDeletingId(null)}
                              className="h-6 px-3 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 text-[10px] border border-slate-700 transition-colors"
                            >
                              إلغاء
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* ── Footer ───────────────────────────────────────────── */}
          <div className="px-3 py-2 bg-slate-900/60 border-t border-slate-800">
            <p className="text-[10px] text-slate-600 leading-relaxed">
              🔒 هذه الطبقات خاصة بإدارة الاستشعار — غير مرئية للإدارات الأخرى.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
