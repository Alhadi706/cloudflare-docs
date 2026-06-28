import React from 'react';
import { Activity, ChevronDown, ChevronRight, Database, Eye, FileText, RefreshCw, Shield, ShieldOff, ShieldQuestion, Trash2, Upload } from 'lucide-react';
import { STATUS_BADGE, API } from '../constants';
import { CpPipeline, UploadDetail, UploadRecord } from '../types';
import { UploadDetailPanel } from './UploadDetailPanel';
import { UploadPanel } from './UploadPanel';

type Props = {
  uploadsLoading: boolean;
  uploads: UploadRecord[];
  filteredUploads: UploadRecord[];
  cpPipelines: CpPipeline[];
  selectedUpload: UploadDetail | null;
  viewMode: 'specialist' | 'manager';
  showUploadPanel: boolean;
  uploadSearch: string;
  uploadYear: string;
  uploadLocation: string;
  onUploadSearchChange: (value: string) => void;
  onUploadYearChange: (value: string) => void;
  onUploadLocationChange: (value: string) => void;
  onToggleUploadPanel: () => void;
  onRefresh: () => void;
  onUploadSuccess: () => void;
  onCloseUploadDetail: () => void;
  onAnalyzeSession: (args: { pipelineId: string | null; sessionId: string }) => void;
  onOpenDetail: (uploadId: string) => void;
};

export function CorrosionSessionsTab({
  uploadsLoading,
  uploads,
  filteredUploads,
  cpPipelines,
  selectedUpload,
  viewMode,
  showUploadPanel,
  uploadSearch,
  uploadYear,
  uploadLocation,
  onUploadSearchChange,
  onUploadYearChange,
  onUploadLocationChange,
  onToggleUploadPanel,
  onRefresh,
  onUploadSuccess,
  onCloseUploadDetail,
  onAnalyzeSession,
  onOpenDetail,
}: Props) {
  const [deletingSessionId, setDeletingSessionId] = React.useState<string | null>(null);
  const [editingCpSessionId, setEditingCpSessionId] = React.useState<string | null>(null);
  const [cpEditInstalled, setCpEditInstalled] = React.useState<'YES' | 'NO' | ''>('');
  const [cpEditYear, setCpEditYear] = React.useState('');
  const [savingCpStatus, setSavingCpStatus] = React.useState(false);

  const [reextractingSessionId, setReextractingSessionId] = React.useState<string | null>(null);

  // Expanded pipeline groups
  const [expandedPipelines, setExpandedPipelines] = React.useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) =>
    setExpandedPipelines(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });

  const openCpEdit = (sessionId: string, current: { cp_system_installed?: 'YES' | 'NO' | null; cp_installation_year?: number | null }) => {
    setEditingCpSessionId(sessionId);
    setCpEditInstalled(current.cp_system_installed ?? '');
    setCpEditYear(current.cp_installation_year ? String(current.cp_installation_year) : '');
  };

  const saveCpStatus = async () => {
    if (!editingCpSessionId) return;
    setSavingCpStatus(true);
    try {
      await fetch(`${API}/cp-sessions/${editingCpSessionId}/cp-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cp_system_installed: cpEditInstalled || null,
          cp_installation_year: cpEditInstalled === 'YES' && cpEditYear ? Number(cpEditYear) : null,
        }),
      });
      setEditingCpSessionId(null);
      onRefresh();
    } finally {
      setSavingCpStatus(false);
    }
  };

  const reextractDate = async (sessionId: string) => {
    setReextractingSessionId(sessionId);
    try {
      const r = await fetch(`${API}/cp-sessions/${sessionId}/reextract-date`, { method: 'POST' });
      if (r.ok) onRefresh();
    } catch {}
    finally { setReextractingSessionId(null); }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('هل تريد حذف هذه الجلسة نهائياً؟ يمكنك إعادة رفع الملف لاحقاً.')) return;
    setDeletingSessionId(sessionId);
    try {
      const r = await fetch(`${API}/cp-sessions/${sessionId}`, { method: 'DELETE' });
      if (r.ok) onRefresh();
    } finally {
      setDeletingSessionId(null);
    }
  };

  const cpSessionsFallback: UploadRecord[] = cpPipelines.flatMap((p) =>
    p.sessions.map((s) => ({
      upload_id: `session:${s.session_id}`,
      filename: s.file_name,
      upload_timestamp: s.survey_date ?? new Date().toISOString(),
      processing_status: 'success',
      total_rows: s.total_points,
      inserted_rows: s.total_points,
      skipped_rows: 0,
      failed_rows: 0,
      pipeline_id: p.pipeline_id,
      survey_date: s.survey_date ?? null,
    }))
  );

  const sourceUploads = uploads.length > 0 ? filteredUploads : cpSessionsFallback;

  const normalizedSearch = uploadSearch.trim().toLowerCase();
  const normalizedLocation = uploadLocation.trim().toLowerCase();

  const visibleRows = sourceUploads.filter((u) => {
    const year = u.survey_date ? String(new Date(u.survey_date).getFullYear()) : '';
    const matchQ =
      !normalizedSearch || `${u.filename} ${u.pipeline_id ?? ''}`.toLowerCase().includes(normalizedSearch);
    const matchYear = uploadYear === 'all' || year === uploadYear;
    const matchLoc =
      !normalizedLocation || `${u.pipeline_id ?? ''} ${u.filename}`.toLowerCase().includes(normalizedLocation);
    return matchQ && matchYear && matchLoc;
  });

  // ── Group by pipeline_id (same pipeline = multiple survey years) ─────────
  const groupMap: Record<string, typeof visibleRows> = {};
  for (const u of visibleRows) {
    const key = u.pipeline_id ?? `__solo_${u.upload_id}`;
    if (!groupMap[key]) groupMap[key] = [];
    groupMap[key].push(u);
  }
  // Sort each group by survey_date descending (most recent first)
  for (const k of Object.keys(groupMap)) {
    groupMap[k].sort((a, b) => {
      const da = a.survey_date ? new Date(a.survey_date).getTime() : 0;
      const db = b.survey_date ? new Date(b.survey_date).getTime() : 0;
      return db - da;
    });
  }
  // Order groups by latest survey_date descending
  const groupKeys = Object.keys(groupMap).sort((a, b) => {
    const ta = groupMap[a][0]?.survey_date ? new Date(groupMap[a][0].survey_date).getTime() : 0;
    const tb = groupMap[b][0]?.survey_date ? new Date(groupMap[b][0].survey_date).getTime() : 0;
    return tb - ta;
  });

  const hasAnySessions = uploads.length > 0 || cpSessionsFallback.length > 0;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">جلسات المسح</h2>
            <p className="text-xs text-slate-500 mt-0.5">كل سطر = جلسة مسح CP مُستورَدة — اضغط «تحليل» للانتقال للتحليل الهندسي</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onRefresh}
              disabled={uploadsLoading}
              className="text-sm text-slate-400 hover:text-white flex items-center gap-1 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${uploadsLoading ? 'animate-spin' : ''}`} /> تحديث
            </button>
            <button
              onClick={onToggleUploadPanel}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                showUploadPanel
                  ? 'bg-orange-600/30 text-orange-300 border border-orange-500/40'
                  : 'bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-orange-300'
              }`}
            >
              <Upload className="w-4 h-4" /> استيراد مسح جديد
            </button>
          </div>
        </div>

        {showUploadPanel && (
          <div className="border-t border-slate-800 p-5">
            <UploadPanel onSuccess={onUploadSuccess} />
          </div>
        )}
      </div>

      {selectedUpload && (
        <UploadDetailPanel detail={selectedUpload} viewMode={viewMode} onClose={onCloseUploadDetail} />
      )}

      <div className="bg-slate-900/50 rounded-2xl border border-slate-800 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/40 grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            value={uploadSearch}
            onChange={(e) => onUploadSearchChange(e.target.value)}
            placeholder="بحث بالاسم أو رقم الخط"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
          <select
            value={uploadYear}
            onChange={(e) => onUploadYearChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-orange-500"
          >
            <option value="all">كل السنوات</option>
            {Array.from(
              new Set(
                sourceUploads
                  .map((u) => {
                    if (!u.survey_date) return null;
                    const dt = new Date(u.survey_date);
                    return Number.isNaN(dt.getTime()) ? null : String(dt.getFullYear());
                  })
                  .filter(Boolean) as string[]
              )
            )
              .sort((a, b) => Number(a) - Number(b))
              .map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
          </select>
          <input
            value={uploadLocation}
            onChange={(e) => onUploadLocationChange(e.target.value)}
            placeholder="تصفية بالموقع (رقم خط أو نطاق مسافة)"
            className="bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
          />
        </div>

        {uploadsLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-6 h-6 text-orange-400 animate-spin" />
          </div>
        ) : !hasAnySessions ? (
          <div className="py-12 text-center text-slate-500">
            <Database className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="mb-4">لا توجد جلسات مُستورَدة بعد</p>
            <button
              onClick={onToggleUploadPanel}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-500/10 border border-orange-500/30 text-orange-300 text-sm font-medium"
            >
              <Upload className="w-4 h-4" /> استورد أول ملف مسح CP
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/30">
                  {['اسم الملف', 'الخط', 'تاريخ المسح', 'نطاق المسافة', 'نقاط القياس', 'نظام CP', 'حالة المعالجة', 'إجراءات'].map((h) => (
                    <th key={h} className="px-4 py-3 text-right text-xs text-slate-400 font-semibold">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groupKeys.map((groupKey) => {
                  const rows = groupMap[groupKey];
                  const isMulti = rows.length > 1;
                  const isExpanded = expandedPipelines.has(groupKey);

                  return rows.map((u, rowIdx) => {
                    const isMain = rowIdx === 0;
                    if (!isMain && !isExpanded) return null;

                    const matchSession = cpPipelines.flatMap((p) => p.sessions).find((s) => s.file_name === u.filename);
                    const resolvedSessionId = matchSession?.session_id
                      ?? (u.upload_id.startsWith('session:') ? u.upload_id.slice(8) : null);

                    return (
                      <tr
                        key={u.upload_id}
                        className={`border-b border-slate-800/50 hover:bg-slate-800/20 transition-colors ${!isMain ? 'bg-slate-900/40' : ''}`}
                      >
                        {/* Filename cell */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {isMain && isMulti ? (
                              <button onClick={() => toggleExpanded(groupKey)} className="text-slate-400 hover:text-white shrink-0">
                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                              </button>
                            ) : (
                              <FileText className={`w-4 h-4 shrink-0 ${isMain ? 'text-slate-500' : 'text-slate-600 mr-2'}`} />
                            )}
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <p className="text-slate-200 font-medium max-w-[160px] truncate">{u.filename}</p>
                                {isMain && isMulti && (
                                  <span className="px-1.5 py-0 rounded bg-indigo-900/60 border border-indigo-500/30 text-indigo-300 text-[10px] font-semibold">
                                    {rows.length} مسوحات
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                                {matchSession?.file_format && (
                                  <span className="px-1.5 py-0 rounded bg-slate-700/80 text-slate-400 font-mono text-[10px]">{matchSession.file_format}</span>
                                )}
                                {matchSession?.has_gps && (
                                  <span className="px-1.5 py-0 rounded bg-emerald-900/60 text-emerald-300 text-[10px] font-semibold">GPS</span>
                                )}
                                {matchSession?.geo_source_session_id && !matchSession.has_gps && (
                                  <span className="px-1.5 py-0 rounded bg-blue-900/60 text-blue-300 text-[10px]">مرتبطة جغرافياً</span>
                                )}
                                <p className="text-xs text-slate-500">
                                  {new Date(u.upload_timestamp).toLocaleDateString('ar-LY')}
                                </p>
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Pipeline */}
                        <td className="px-4 py-3">
                          {u.pipeline_id ? (
                            <span className="px-2 py-0.5 rounded-md bg-blue-900/30 border border-blue-500/30 text-blue-300 text-xs font-mono">
                              {u.pipeline_id}
                            </span>
                          ) : (
                            <span className="text-slate-600 text-xs">غير محدد</span>
                          )}
                        </td>

                        {/* Survey date — auto-extracted from file */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-300 font-medium">
                              {u.survey_date ?? <span className="text-slate-600">—</span>}
                            </span>
                            {resolvedSessionId && (
                              <button
                                onClick={() => reextractDate(resolvedSessionId)}
                                disabled={reextractingSessionId === resolvedSessionId}
                                title="استخراج التاريخ من الملف تلقائياً"
                                className="p-0.5 rounded text-slate-600 hover:text-cyan-400 disabled:opacity-40 transition-colors"
                              >
                                <RefreshCw className={`w-3 h-3 ${reextractingSessionId === resolvedSessionId ? 'animate-spin text-cyan-400' : ''}`} />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* Distance range */}
                        <td className="px-4 py-3 text-xs font-mono text-slate-400">
                          {matchSession?.start_distance != null
                            ? `${matchSession.start_distance} → ${matchSession.end_distance} م`
                            : '—'}
                        </td>

                        {/* Points */}
                        <td className="px-4 py-3 text-cyan-400 font-bold">
                          {matchSession?.total_points.toLocaleString() ?? u.inserted_rows.toLocaleString()}
                        </td>

                        {/* CP System Status */}
                        <td className="px-4 py-3">
                          {editingCpSessionId === resolvedSessionId ? (
                            <div className="flex flex-col gap-1 min-w-[140px]">
                              <select
                                value={cpEditInstalled}
                                onChange={e => { setCpEditInstalled(e.target.value as 'YES' | 'NO' | ''); if (e.target.value !== 'YES') setCpEditYear(''); }}
                                className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-white"
                              >
                                <option value="">— غير محدد</option>
                                <option value="YES">✓ محمي</option>
                                <option value="NO">✗ غير محمي</option>
                              </select>
                              {cpEditInstalled === 'YES' && (
                                <input
                                  type="number"
                                  value={cpEditYear}
                                  onChange={e => setCpEditYear(e.target.value)}
                                  placeholder="سنة التركيب"
                                  min={1950} max={2100}
                                  className="bg-slate-700 border border-green-600/50 rounded px-2 py-1 text-xs text-white"
                                />
                              )}
                              <div className="flex gap-1">
                                <button onClick={saveCpStatus} disabled={savingCpStatus} className="flex-1 rounded bg-green-700 hover:bg-green-600 px-2 py-1 text-[10px] text-white font-semibold disabled:opacity-50">
                                  {savingCpStatus ? '...' : 'حفظ'}
                                </button>
                                <button onClick={() => setEditingCpSessionId(null)} className="rounded bg-slate-600 hover:bg-slate-500 px-2 py-1 text-[10px] text-slate-300">
                                  إلغاء
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => resolvedSessionId && openCpEdit(resolvedSessionId, { cp_system_installed: matchSession?.cp_system_installed, cp_installation_year: matchSession?.cp_installation_year })}
                              title="تعديل حالة نظام الحماية"
                              className="flex items-center gap-1.5 group"
                            >
                              {matchSession?.cp_system_installed === 'YES' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-green-900/40 border border-green-500/40 text-green-300 text-xs font-semibold">
                                  <Shield className="w-3 h-3" /> محمي{matchSession.cp_installation_year ? ` (${matchSession.cp_installation_year})` : ''}
                                </span>
                              ) : matchSession?.cp_system_installed === 'NO' ? (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-900/30 border border-red-500/30 text-red-300 text-xs font-semibold">
                                  <ShieldOff className="w-3 h-3" /> غير محمي
                                </span>
                              ) : (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/40 text-slate-500 text-xs">
                                  <ShieldQuestion className="w-3 h-3" /> غير محدد
                                </span>
                              )}
                            </button>
                          )}
                        </td>

                        {/* Processing status */}
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-md text-xs border font-medium ${STATUS_BADGE[u.processing_status] ?? STATUS_BADGE.error}`}>
                            {u.processing_status === 'success' ? '✓ نجاح' : u.processing_status === 'partial' ? '⚠ جزئي' : '✗ خطأ'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            {matchSession && (
                              <button
                                onClick={() => onAnalyzeSession({ pipelineId: u.pipeline_id ?? null, sessionId: matchSession.session_id })}
                                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs text-orange-300 font-semibold transition-colors"
                              >
                                <Activity className="w-3.5 h-3.5" /> تحليل
                              </button>
                            )}
                            <button
                              onClick={() => onOpenDetail(u.upload_id)}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-xs text-slate-300 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5" /> تفاصيل
                            </button>
                            {resolvedSessionId && (
                              <button
                                onClick={() => handleDeleteSession(resolvedSessionId)}
                                disabled={deletingSessionId === resolvedSessionId}
                                title="حذف الجلسة"
                                className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-red-900/20 hover:bg-red-900/40 border border-red-500/20 text-xs text-red-400 transition-colors disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}

        {!uploadsLoading && hasAnySessions && visibleRows.length === 0 && (
          <div className="py-8 text-center text-slate-500 text-sm">لا توجد نتائج مطابقة للبحث/التصفية الحالية.</div>
        )}
      </div>
    </div>
  );
}
