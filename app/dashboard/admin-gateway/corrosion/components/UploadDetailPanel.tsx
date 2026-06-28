'use client';
import { Database, Briefcase } from 'lucide-react';
import { UploadDetail } from '../types';
import { STATUS_BADGE } from '../constants';

export function UploadDetailPanel({
  detail,
  viewMode,
  onClose,
}: {
  detail: UploadDetail;
  viewMode: 'specialist' | 'manager';
  onClose: () => void;
}) {
  const successRate = detail.total_rows > 0
    ? ((detail.inserted_rows / detail.total_rows) * 100).toFixed(1)
    : '0.0';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div className="flex items-center gap-3">
            <Database className="w-5 h-5 text-orange-400" />
            <h2 className="text-base font-bold text-white truncate max-w-xs">{detail.filename}</h2>
            <span className={`px-2 py-0.5 rounded-md text-xs border font-medium ${STATUS_BADGE[detail.processing_status] ?? STATUS_BADGE['error']}`}>
              {detail.processing_status === 'success' ? 'نجاح' : detail.processing_status === 'partial' ? 'جزئي' : 'خطأ'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-xl leading-none">&times;</button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'إجمالي الصفوف', value: detail.total_rows, color: 'text-slate-200' },
              { label: 'مُدرَج', value: detail.inserted_rows, color: 'text-emerald-400' },
              { label: 'مُتخطَّى', value: detail.skipped_rows, color: 'text-amber-400' },
              { label: 'فاشل', value: detail.failed_rows, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-slate-800/60 rounded-xl border border-slate-700 p-3 text-center">
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-xs text-slate-500 mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm text-slate-400">نسبة النجاح</span>
              <span className="text-sm font-bold text-white">{successRate}%</span>
            </div>
            <div className="h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${parseFloat(successRate) >= 80 ? 'bg-emerald-500' : parseFloat(successRate) >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: 'تاريخ الرفع', value: new Date(detail.upload_timestamp).toLocaleString('ar-SA') },
              { label: 'تاريخ المسح', value: detail.survey_date ?? '—' },
              { label: 'Pipeline', value: detail.pipeline_id ?? '—' },
              { label: 'نوع الملف', value: detail.file_type ?? '—' },
              { label: 'صف الرأسية', value: detail.detected_header_row != null ? `صف ${detail.detected_header_row}` : '—' },
              { label: 'المحرك', value: detail.engine_used ?? '—' },
            ].map(m => (
              <div key={m.label} className="flex items-start gap-2">
                <span className="text-slate-500 shrink-0">{m.label}:</span>
                <span className="text-slate-300 font-medium">{m.value}</span>
              </div>
            ))}
          </div>

          {(detail.sheets_processed || detail.sheets_skipped) && (
            <div className="bg-slate-800/40 rounded-xl border border-slate-700 p-4 space-y-2">
              <h4 className="text-sm font-semibold text-slate-300">الأوراق (Sheets)</h4>
              {detail.sheets_processed && detail.sheets_processed.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-slate-500 self-center">معالجة:</span>
                  {detail.sheets_processed.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-md bg-emerald-900/40 border border-emerald-600/40 text-emerald-300 text-xs">{s}</span>
                  ))}
                </div>
              )}
              {detail.sheets_skipped && detail.sheets_skipped.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  <span className="text-xs text-slate-500 self-center">متخطاة:</span>
                  {detail.sheets_skipped.map(s => (
                    <span key={s} className="px-2 py-0.5 rounded-md bg-slate-700 border border-slate-600 text-slate-400 text-xs">{s}</span>
                  ))}
                </div>
              )}
            </div>
          )}

          {viewMode === 'manager' && (
            <div className={`rounded-xl border p-4 ${detail.processing_status === 'success' ? 'bg-emerald-900/20 border-emerald-600/30' : 'bg-amber-900/20 border-amber-600/30'}`}>
              <h4 className="text-sm font-bold text-slate-200 mb-2 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> ملخص تنفيذي
              </h4>
              <p className="text-sm text-slate-300">
                تم رفع الملف <strong className="text-white">{detail.filename}</strong> بنجاح {detail.processing_status === 'success' ? 'كامل' : 'جزئي'}.
                {'  '} أُدرج <strong className="text-emerald-400">{detail.inserted_rows}</strong> سجل من أصل <strong className="text-white">{detail.total_rows}</strong>
                {' '}(معدل النجاح: <strong className="text-white">{successRate}%</strong>).
                {detail.failed_rows > 0 && ` فشل ${detail.failed_rows} سجل.`}
              </p>
            </div>
          )}

          {viewMode === 'specialist' && (
            <>
              {detail.column_mapping && Object.keys(detail.column_mapping).length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">تعيين الأعمدة</h4>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/60">
                          <th className="px-3 py-2 text-right text-slate-400">عمود الملف</th>
                          <th className="px-3 py-2 text-right text-slate-400">عمود النظام</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(detail.column_mapping).map(([src, dst]) => (
                          <tr key={src} className="border-b border-slate-800/50">
                            <td className="px-3 py-1.5 text-slate-400 font-mono">{src}</td>
                            <td className="px-3 py-1.5 text-emerald-300 font-mono">{dst}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {detail.sample_rows && detail.sample_rows.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">عينة البيانات (أول {detail.sample_rows.length} صفوف)</h4>
                  <div className="bg-slate-800/40 rounded-xl border border-slate-700 overflow-x-auto">
                    <table className="w-full text-xs whitespace-nowrap">
                      <thead>
                        <tr className="border-b border-slate-700 bg-slate-800/60">
                          {Object.keys(detail.sample_rows[0]).map(k => (
                            <th key={k} className="px-3 py-2 text-right text-slate-400 font-mono">{k}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {detail.sample_rows.map((row, ri) => (
                          <tr key={ri} className="border-b border-slate-800/50">
                            {Object.values(row).map((v: any, vi) => (
                              <td key={vi} className="px-3 py-1.5 text-slate-300">{v != null ? String(v) : '—'}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}

          {detail.error_messages && detail.error_messages.length > 0 && (
            <div className="bg-red-900/20 border border-red-600/30 rounded-xl p-4">
              <h4 className="text-sm font-bold text-red-300 mb-2">رسائل الخطأ</h4>
              <ul className="space-y-1">
                {detail.error_messages.map((e, i) => (
                  <li key={i} className="text-xs text-red-400 font-mono">{e}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
