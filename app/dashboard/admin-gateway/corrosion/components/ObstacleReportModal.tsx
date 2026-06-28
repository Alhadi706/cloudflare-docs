'use client';
// ═══════════════════════════════════════════════════════════════════════════════
// نافذة رفع تقرير العوائق
// يُستدعى عند وجود عوائق في مرحلة كشف العوائق
// يتيح: تقرير عوائق + اختيار جهة الإزالة (فريق أو إدارة خارجية)
// ═══════════════════════════════════════════════════════════════════════════════
import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, Loader2, Send, Shield, Wrench, X } from 'lucide-react';

const DOC_API = '/api/v1/dept-admin';
const WF_API  = '/api/v1/workflow';
function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'x-staff-api-key': 'haoAJhwAboEQTsgXex1q4T-vQ7q3d6YOLjpNHqszA9A',
    'Content-Type': 'application/json',
  };
  if (typeof window === 'undefined') return headers;
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

/** External departments that can assist with obstacle removal */
const EXTERNAL_DEPTS = [
  { value: 'operations', label: 'إدارة الإنتاج / العمليات', hint: 'رمال زاحفة، عوائق على الممر' },
  { value: 'engineering', label: 'إدارة الهندسة والدعم الفني', hint: 'عوائق إنشائية أو تقنية' },
  { value: 'logistics', label: 'إدارة اللوجستيات', hint: 'حواجز طريق، مركبات، معدات' },
  { value: 'gis', label: 'إدارة GIS', hint: 'تعديل مسار الكشف' },
];

type RemovalType = 'team' | 'external';

interface Props {
  workOrder: { id: number | string; work_order_number?: string; title?: string; asset_name?: string };
  onClose: () => void;
  /** Called on success with the new status so WorkOrdersTab can refresh */
  onSuccess: (newStatus: string) => void;
}

export default function ObstacleReportModal({ workOrder, onClose, onSuccess }: Props) {
  const [description, setDescription] = useState('');
  const [obstacleType, setObstacleType] = useState('');
  const [removalType, setRemovalType] = useState<RemovalType>('team');
  const [externalDept, setExternalDept] = useState('operations');
  const [externalNotes, setExternalNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const OBSTACLE_TYPES = [
    'رمال زاحفة على نقاط الفحص',
    'ركام وأنقاض',
    'مياه راكدة / فيضان',
    'حواجز / أسوار',
    'نباتات كثيفة',
    'مركبات أو معدات متوقفة',
    'تلف في المسار (حفريات)',
    'عوائق أخرى',
  ];

  const handleSubmit = async () => {
    if (!description.trim() || !obstacleType) {
      setError('يرجى وصف العائق واختيار نوعه');
      return;
    }
    if (removalType === 'external' && !externalDept) {
      setError('يرجى تحديد الإدارة المطلوب المساعدة منها');
      return;
    }
    setSaving(true);
    setError('');
    try {
      // 1. Create obstacle report document
      const docBody = {
        doc_type: 'obstacle_report',
        title: `تقرير عوائق — ${workOrder.asset_name ?? workOrder.title ?? `أمر #${workOrder.work_order_number ?? workOrder.id}`}`,
        body_text: [
          `نوع العائق: ${obstacleType}`,
          `الوصف: ${description}`,
          `جهة الإزالة: ${removalType === 'team' ? 'فريق القسم' : `الإدارة الخارجية: ${EXTERNAL_DEPTS.find(d => d.value === externalDept)?.label}`}`,
          externalNotes ? `ملاحظات: ${externalNotes}` : '',
          `أمر العمل: ${workOrder.work_order_number ?? workOrder.id}`,
        ].filter(Boolean).join('\n'),
        dest_dept: removalType === 'external' ? externalDept : 'corrosion',
        priority: 'high',
        created_by: 'corrosion_monitoring',
        metadata: {
          obstacle_type: obstacleType,
          removal_by: removalType,
          external_dept: removalType === 'external' ? externalDept : null,
          related_wo_id: workOrder.id,
          section: 'monitoring',
          workflow_stage: removalType === 'external' ? 'pending_external_removal' : 'team_removal',
        },
      };

      await fetch(`${DOC_API}/corrosion/documents`, {
        method: 'POST', headers: getHeaders(), body: JSON.stringify(docBody),
      });

      // 2. If external dept, also forward the doc as a request
      if (removalType === 'external') {
        const fwdBody = {
          doc_type: 'obstacle_removal_request',
          target_dept: externalDept,
          title: `طلب إزالة عوائق — ${obstacleType}`,
          body_text: [
            `تطلب إدارة مكافحة التآكل المساعدة في إزالة العوائق التالية:`,
            `النوع: ${obstacleType}`,
            `الموقع: ${workOrder.asset_name ?? ''}`,
            `الوصف: ${description}`,
            externalNotes ? `تفاصيل إضافية: ${externalNotes}` : '',
            `بعد الإزالة يرجى إشعار قسم المراقبة للمباشرة بالمسح.`,
          ].filter(Boolean).join('\n'),
          forwarded_by: 'corrosion_monitoring',
          metadata: {
            related_wo_id: workOrder.id,
            obstacle_type: obstacleType,
            requesting_section: 'monitoring',
          },
        };
        await fetch(`${DOC_API}/corrosion/documents`, {
          method: 'POST', headers: getHeaders(), body: JSON.stringify({ ...docBody, ...fwdBody }),
        });
      }

      // 3. Update WO status
      const newStatus = removalType === 'team' ? 'obstacle_team_removal' : 'obstacle_external_removal';
      await fetch(`${WF_API}/work-orders/${workOrder.id}/status`, {
        method: 'PATCH', headers: getHeaders(),
        body: JSON.stringify({
          status: newStatus,
          notes: `[OBSTACLE_REPORT] ${obstacleType} — إزالة: ${removalType === 'team' ? 'بالفريق' : externalDept}`,
        }),
      });

      onSuccess(newStatus);
    } catch (e: any) {
      setError(e.message ?? 'خطأ في رفع التقرير');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              رفع تقرير العوائق
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {workOrder.work_order_number ?? `#${workOrder.id}`} — {workOrder.asset_name ?? workOrder.title ?? ''}
            </p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Obstacle type */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">نوع العائق *</label>
            <div className="grid grid-cols-2 gap-2">
              {OBSTACLE_TYPES.map(t => (
                <button
                  key={t}
                  onClick={() => setObstacleType(t)}
                  className={`px-3 py-2 rounded-xl text-xs text-right transition-all border ${
                    obstacleType === t
                      ? 'border-amber-500/50 bg-amber-900/20 text-amber-300 font-semibold'
                      : 'border-slate-700 text-slate-400 hover:border-slate-600'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs text-slate-400 mb-1.5">وصف العائق بالتفصيل *</label>
            <textarea
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="مثال: رمال زاحفة تغطي نقاط القياس من المحطة 260 حتى 275، يصعب الوصول إليها بدون معدات خاصة"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-500 resize-none"
            />
          </div>

          {/* Removal type selection */}
          <div>
            <label className="block text-xs text-slate-400 mb-2">جهة الإزالة *</label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setRemovalType('team')}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all ${
                  removalType === 'team'
                    ? 'border-emerald-500/50 bg-emerald-900/20 text-emerald-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Wrench className="w-4 h-4" />
                  <span className="text-sm font-semibold">فريق القسم</span>
                </div>
                <span className="text-[11px] opacity-70">عوائق بسيطة يمكن للفريق إزالتها</span>
              </button>
              <button
                onClick={() => setRemovalType('external')}
                className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border transition-all ${
                  removalType === 'external'
                    ? 'border-blue-500/50 bg-blue-900/20 text-blue-300'
                    : 'border-slate-700 text-slate-400 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  <span className="text-sm font-semibold">الاستعانة بإدارة أخرى</span>
                </div>
                <span className="text-[11px] opacity-70">عوائق تتطلب معدات أو صلاحيات خاصة</span>
              </button>
            </div>
          </div>

          {/* External dept options */}
          {removalType === 'external' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-2">الإدارة المطلوب المساعدة منها *</label>
                <div className="space-y-2">
                  {EXTERNAL_DEPTS.map(d => (
                    <button
                      key={d.value}
                      onClick={() => setExternalDept(d.value)}
                      className={`w-full flex items-start gap-3 p-3 rounded-xl border text-right transition-all ${
                        externalDept === d.value
                          ? 'border-blue-500/50 bg-blue-900/20 text-blue-300'
                          : 'border-slate-700 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      <Shield className="w-4 h-4 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-sm font-semibold">{d.label}</p>
                        <p className="text-xs opacity-60">{d.hint}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1.5">ملاحظات للإدارة الخارجية</label>
                <textarea
                  rows={2}
                  value={externalNotes}
                  onChange={e => setExternalNotes(e.target.value)}
                  placeholder="تعليمات أو متطلبات خاصة لإتمام الإزالة..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 resize-none"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="text-xs text-red-300 bg-red-900/20 border border-red-500/20 rounded-lg px-3 py-2">{error}</div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-5 border-t border-slate-800 sticky bottom-0 bg-slate-900">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-400 hover:text-white">إلغاء</button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
              removalType === 'team'
                ? 'bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 hover:bg-emerald-600/30'
                : 'bg-blue-600/20 border border-blue-500/30 text-blue-300 hover:bg-blue-600/30'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {removalType === 'team' ? 'رفع التقرير — الفريق يتولى الإزالة' : 'رفع التقرير وإرسال طلب للإدارة'}
          </button>
        </div>
      </div>
    </div>
  );
}
