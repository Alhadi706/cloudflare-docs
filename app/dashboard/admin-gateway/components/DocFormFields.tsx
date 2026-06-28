'use client';

import React from 'react';

// ─── types (exported for DeptAdminPage) ──────────────────────────────────────

export type DocType =
  | 'exit_permit' | 'leave_approval' | 'internal_memo'
  | 'outgoing_letter' | 'incoming_letter' | 'report' | 'work_order_doc'
  | 'inspection_request' | 'inspection_report';

export type DocFormData = Record<string, string>;

// ─── helpers ─────────────────────────────────────────────────────────────────

const LEAVE_TYPES: Record<string, string> = {
  annual: 'سنوية', sick: 'مرضية', emergency: 'طارئة',
  unpaid: 'بدون راتب', maternity: 'أمومة', paternity: 'أبوة',
};

const REPORT_TYPES: Record<string, string> = {
  weekly: 'أسبوعي', monthly: 'شهري', quarterly: 'ربعي',
  annual: 'سنوي', incident: 'حادثة', technical: 'فني',
};

const DEPT_CHIPS: [string, string][] = [
  ['corrosion', 'قسم التآكل'], ['maintenance', 'قسم الصيانة'],
  ['admin', 'الإدارة'], ['gm', 'المدير العام'],
  ['hr', 'الموارد البشرية'], ['documentation', 'التوثيق'],
];

function calcDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return Math.max(0, Math.round(diff / 86_400_000) + 1);
}

// ─── exported helpers for DeptAdminPage ──────────────────────────────────────

export function getAutoTitle(docType: DocType, data: DocFormData): string {
  switch (docType) {
    case 'exit_permit':
      return ['إذن خروج', data.employee_name, data.departure_date].filter(Boolean).join(' — ');
    case 'leave_approval':
      return ['طلب إجازة', LEAVE_TYPES[data.leave_type], data.employee_name].filter(Boolean).join(' — ');
    case 'internal_memo':
      return data.subject || 'مذكرة داخلية';
    case 'outgoing_letter':
      return data.subject || (data.recipient_org ? `خطاب صادر إلى ${data.recipient_org}` : 'خطاب صادر');
    case 'incoming_letter':
      return data.subject || (data.sender_org ? `خطاب وارد من ${data.sender_org}` : 'خطاب وارد');
    case 'report':
      return ['تقرير', REPORT_TYPES[data.report_type], data.period_start, data.period_end ? `— ${data.period_end}` : ''].filter(Boolean).join(' ');
    case 'work_order_doc':
      return data.work_order_number ? `أمر عمل — ${data.work_order_number}` : 'أمر عمل';
    case 'inspection_request':
      return data.pipeline_name ? `طلب كشف — ${data.pipeline_name}` : 'طلب كشف تآكل';
    case 'inspection_report':
      return data.inspector_name ? `تقرير كشف — ${data.inspector_name}` : 'تقرير نتائج الكشف';
  }
}

export function getBodyText(docType: DocType, data: DocFormData): string {
  const bodyKeys: Record<DocType, string> = {
    exit_permit: 'purpose', leave_approval: 'reason', internal_memo: 'body',
    outgoing_letter: 'body', incoming_letter: 'body', report: 'body', work_order_doc: 'work_description',
    inspection_request: 'urgency_reason', inspection_report: 'findings',
  };
  return data[bodyKeys[docType]] || '';
}

export function getMetadata(docType: DocType, data: DocFormData): Record<string, string> {
  const excludeFromMeta = new Set(['purpose', 'reason', 'body', 'work_description', 'subject', 'urgency_reason', 'findings']);
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v && !excludeFromMeta.has(k)) result[k] = v;
  }
  return result;
}

// ─── shared style helpers ─────────────────────────────────────────────────────

const inp = 'w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none';
const sel = inp;
const ta  = `${inp} resize-none`;

interface FieldProps { label: string; required?: boolean; children: React.ReactNode }
function Field({ label, required, children }: FieldProps) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-400">
        {label}{required && <span className="text-red-400 mr-1">*</span>}
      </label>
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

interface Props {
  docType: DocType;
  data: DocFormData;
  onChange: (key: string, value: string) => void;
}

export default function DocFormFields({ docType, data, onChange }: Props) {
  const v = (key: string) => data[key] || '';
  const bind = (key: string) => ({
    value: v(key),
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      onChange(key, e.target.value),
  });

  switch (docType) {

    // ── إذن خروج ────────────────────────────────────────────────────────────
    case 'exit_permit':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الموظف" required>
              <input className={inp} {...bind('employee_name')} placeholder="الاسم الكامل" />
            </Field>
            <Field label="تاريخ الخروج" required>
              <input type="date" className={inp} {...bind('departure_date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="وقت الخروج" required>
              <input type="time" className={inp} {...bind('departure_time')} />
            </Field>
            <Field label="وقت العودة المتوقع" required>
              <input type="time" className={inp} {...bind('return_time')} />
            </Field>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="veh_req"
              checked={v('vehicle_required') === 'yes'}
              onChange={(e) => onChange('vehicle_required', e.target.checked ? 'yes' : '')}
              className="h-4 w-4 accent-indigo-500"
            />
            <label htmlFor="veh_req" className="text-sm text-slate-400 cursor-pointer">يتطلب مركبة</label>
            {v('vehicle_required') === 'yes' && (
              <input className={`${inp} flex-1`} {...bind('vehicle_plate')} placeholder="رقم اللوحة" />
            )}
          </div>
          <Field label="الغرض من الخروج" required>
            <textarea className={ta} rows={2} {...bind('purpose')} placeholder="وصف مختصر للغرض" />
          </Field>
        </div>
      );

    // ── طلب إجازة ───────────────────────────────────────────────────────────
    case 'leave_approval':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الموظف" required>
              <input className={inp} {...bind('employee_name')} placeholder="الاسم الكامل" />
            </Field>
            <Field label="نوع الإجازة" required>
              <select className={sel} {...bind('leave_type')}>
                <option value="">— اختر —</option>
                {Object.entries(LEAVE_TYPES).map(([k, lbl]) => (
                  <option key={k} value={k}>{lbl}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="تاريخ البداية" required>
              <input type="date" className={inp} {...bind('start_date')} />
            </Field>
            <Field label="تاريخ النهاية" required>
              <input type="date" className={inp} {...bind('end_date')} />
            </Field>
            <Field label="عدد الأيام">
              <div className="flex items-center justify-center h-9 rounded border border-slate-700 bg-slate-900 text-sm text-indigo-300 font-bold">
                {calcDays(v('start_date'), v('end_date')) || '—'}
              </div>
            </Field>
          </div>
          <Field label="الموظف البديل">
            <input className={inp} {...bind('replacement_name')} placeholder="اسم البديل (اختياري)" />
          </Field>
          <Field label="السبب / ملاحظات">
            <textarea className={ta} rows={2} {...bind('reason')} placeholder="تفاصيل إضافية…" />
          </Field>
        </div>
      );

    // ── مذكرة داخلية ────────────────────────────────────────────────────────
    case 'internal_memo':
      return (
        <div className="space-y-3">
          <Field label="الموضوع" required>
            <input className={inp} {...bind('subject')} placeholder="موضوع المذكرة" />
          </Field>
          <Field label="جهات الاستلام">
            <div className="flex flex-wrap gap-2 mt-1">
              {DEPT_CHIPS.map(([k, lbl]) => {
                const selected = v('recipients').split(',').filter(Boolean);
                const active = selected.includes(k);
                return (
                  <button
                    key={k} type="button"
                    onClick={() => {
                      const next = active ? selected.filter((s) => s !== k) : [...selected, k];
                      onChange('recipients', next.join(','));
                    }}
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      active ? 'bg-indigo-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                    }`}
                  >
                    {lbl}
                  </button>
                );
              })}
            </div>
          </Field>
          <Field label="نص المذكرة" required>
            <textarea className={ta} rows={4} {...bind('body')} placeholder="محتوى المذكرة…" />
          </Field>
        </div>
      );

    // ── خطاب صادر ───────────────────────────────────────────────────────────
    case 'outgoing_letter':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجهة المُرسَل إليها" required>
              <input className={inp} {...bind('recipient_org')} placeholder="اسم الجهة / المؤسسة" />
            </Field>
            <Field label="الشخص المعني">
              <input className={inp} {...bind('recipient_person')} placeholder="الاسم (اختياري)" />
            </Field>
          </div>
          <Field label="الموضوع" required>
            <input className={inp} {...bind('subject')} placeholder="موضوع الخطاب" />
          </Field>
          <Field label="رقم الخطاب المرجعي">
            <input className={inp} {...bind('ref_number')} placeholder="رقم الخطاب المُشار إليه (اختياري)" />
          </Field>
          <Field label="نص الخطاب">
            <textarea className={ta} rows={4} {...bind('body')} placeholder="متن الخطاب…" />
          </Field>
        </div>
      );

    // ── خطاب وارد ───────────────────────────────────────────────────────────
    case 'incoming_letter':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجهة المُرسِلة" required>
              <input className={inp} {...bind('sender_org')} placeholder="اسم الجهة / المؤسسة" />
            </Field>
            <Field label="المُرسِل">
              <input className={inp} {...bind('sender_person')} placeholder="الاسم (اختياري)" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم الوارد الخارجي">
              <input className={inp} {...bind('external_ref')} placeholder="رقمهم المرجعي" />
            </Field>
            <Field label="تاريخ الاستلام" required>
              <input type="date" className={inp} {...bind('received_date')} />
            </Field>
          </div>
          <Field label="الموضوع" required>
            <input className={inp} {...bind('subject')} placeholder="موضوع الخطاب الوارد" />
          </Field>
          <Field label="ملخص / ملاحظات">
            <textarea className={ta} rows={3} {...bind('body')} placeholder="ملخص الخطاب وما يتطلبه من إجراء…" />
          </Field>
        </div>
      );

    // ── تقرير ────────────────────────────────────────────────────────────────
    case 'report':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Field label="نوع التقرير" required>
              <select className={sel} {...bind('report_type')}>
                <option value="">— اختر —</option>
                {Object.entries(REPORT_TYPES).map(([k, lbl]) => (
                  <option key={k} value={k}>{lbl}</option>
                ))}
              </select>
            </Field>
            <Field label="من تاريخ">
              <input type="date" className={inp} {...bind('period_start')} />
            </Field>
            <Field label="إلى تاريخ">
              <input type="date" className={inp} {...bind('period_end')} />
            </Field>
          </div>
          <Field label="قائمة التوزيع">
            <input className={inp} {...bind('distribution_list')} placeholder="الجهات المستلِمة (افصل بفاصلة)" />
          </Field>
          <Field label="محتوى التقرير" required>
            <textarea className={ta} rows={4} {...bind('body')} placeholder="ملخص التقرير والنتائج الرئيسية…" />
          </Field>
        </div>
      );

    // ── أمر عمل ─────────────────────────────────────────────────────────────
    case 'work_order_doc':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="رقم أمر العمل" required>
              <input className={inp} {...bind('work_order_number')} placeholder="مثال: WO-2026-001" />
            </Field>
            <Field label="معرف الأصل في النظام">
              <input className={inp} {...bind('asset_id')} placeholder="مثال: PIPE-001 أو رقم الأصل" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="منفذ العمل (الاسم)">
              <input className={inp} {...bind('performed_by')} placeholder="اسم الفني أو المشرف" />
            </Field>
            <Field label="رقم الموظف (للموارد البشرية)">
              <input type="number" className={inp} {...bind('performed_by_employee_id')} placeholder="رقم الموظف في النظام" min="1" />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="الجهة المنفذة">
              <input className={inp} {...bind('contractor_name')} placeholder="اسم الشركة أو الفريق" />
            </Field>
            <Field label="تاريخ البداية">
              <input type="date" className={inp} {...bind('work_start_date')} />
            </Field>
            <Field label="تاريخ الانتهاء">
              <input type="date" className={inp} {...bind('work_end_date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="التكلفة التقديرية (د.ل)">
              <input type="number" className={inp} {...bind('estimated_cost')} placeholder="0" min="0" />
            </Field>
          </div>
          <Field label="وصف العمل" required>
            <textarea className={ta} rows={3} {...bind('work_description')} placeholder="تفاصيل العمل المطلوب تنفيذه…" />
          </Field>
        </div>
      );

    // ── طلب كشف تآكل ────────────────────────────────────────────────────────
    case 'inspection_request':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم الخط / الشبكة" required>
              <input className={inp} {...bind('pipeline_name')} placeholder="مثال: خط تصدير الشمال" />
            </Field>            <Field label="معرف الأصل في النظام">
              <input className={inp} {...bind('asset_id')} placeholder="مثال: PIPE-001 أو رقم الأصل" />
            </Field>            <Field label="نوع الكشف" required>
              <select className={sel} {...bind('inspection_type')}>
                <option value="">— اختر —</option>
                <option value="cips">CIPS — حماية كاثودية</option>
                <option value="dcvg">DCVG — كشف العيوب</option>
                <option value="visual">كشف بصري</option>
                <option value="ultrasonic">موجات فوق صوتية</option>
                <option value="full">فحص شامل</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="من الكيلومتر">
              <input type="number" step="0.1" className={inp} {...bind('segment_from')} placeholder="0.0" />
            </Field>
            <Field label="إلى الكيلومتر">
              <input type="number" step="0.1" className={inp} {...bind('segment_to')} placeholder="10.0" />
            </Field>
          </div>
          <Field label="طالب الكشف" required>
            <input className={inp} {...bind('requested_by')} placeholder="الاسم والمنصب" />
          </Field>
          <Field label="سبب / تفاصيل الطلب">
            <textarea className={ta} rows={3} {...bind('urgency_reason')} placeholder="وصف المشكلة أو سبب طلب الكشف…" />
          </Field>
        </div>
      );

    // ── تقرير كشف تآكل ──────────────────────────────────────────────────────
    case 'inspection_report': {
      const assmtVal = v('overall_assessment');
      const assmtBorder =
        assmtVal === 'critical'   ? 'border-red-500 text-red-300'    :
        assmtVal === 'moderate'   ? 'border-yellow-500 text-yellow-300' :
        assmtVal === 'acceptable' ? 'border-green-500 text-green-300' : '';
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="اسم المفتش" required>
              <input className={inp} {...bind('inspector_name')} placeholder="الاسم الكامل" />
            </Field>
            <Field label="تاريخ الكشف" required>
              <input type="date" className={inp} {...bind('inspection_date')} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="معرف الأصل في النظام">
              <input className={inp} {...bind('asset_id')} placeholder="مثال: PIPE-001" />
            </Field>
            <Field label="رقم الموظف (للربط بالموارد البشرية)">
              <input type="number" className={inp} {...bind('performed_by_employee_id')} placeholder="رقم الموظف في النظام" min="1" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="معدل التآكل (ملم/سنة)">
              <input type="number" step="0.01" className={inp} {...bind('corrosion_rate')} placeholder="0.25" />
            </Field>
            <Field label="التقييم العام" required>
              <select className={`${sel} ${assmtBorder}`} {...bind('overall_assessment')}>
                <option value="">— اختر —</option>
                <option value="acceptable">✅ مقبول</option>
                <option value="moderate">⚠️ متوسط</option>
                <option value="critical">🔴 حرج</option>
              </select>
            </Field>
          </div>
          <Field label="قراءات CP (بالفولت)">
            <input className={inp} {...bind('cp_readings')} placeholder="مثال: -0.85V → -1.02V → -0.91V" />
          </Field>
          <Field label="النتائج الرئيسية" required>
            <textarea className={ta} rows={3} {...bind('findings')} placeholder="وصف ما تم رصده ميدانياً…" />
          </Field>
          <Field label="التوصيات">
            <textarea className={ta} rows={2} {...bind('recommendations')} placeholder="الإجراءات المقترحة…" />
          </Field>
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="follow_up_req"
              checked={v('follow_up_required') === 'yes'}
              onChange={(e) => onChange('follow_up_required', e.target.checked ? 'yes' : 'no')}
              className="h-4 w-4 accent-red-500"
            />
            <label htmlFor="follow_up_req" className="text-sm text-slate-400 cursor-pointer">يستوجب متابعة دورية</label>
          </div>
        </div>
      );
    }
  }
}
