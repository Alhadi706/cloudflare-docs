'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CheckSquare, XCircle, RotateCcw, Clock, ChevronDown, ExternalLink, Building2 } from 'lucide-react';
import Link from 'next/link';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};

const ROLES = [
  { value: 'supervisor',         label: 'المشرف المباشر' },
  { value: 'admin_officer',      label: 'مسؤول إداري' },
  { value: 'finance_controller', label: 'المراقب المالي' },
  { value: 'management',         label: 'الإدارة' },
  { value: 'director',           label: 'المدير العام' },
];

const ENTITY_LABELS: Record<string, string> = {
  purchase_request: 'طلب شراء',
  purchase_order:   'أمر شراء',
  journal_entry:    'قيد محاسبي',
  stock_issue:      'صرف مخزن',
  contract:         'عقد',
};

// مصفوفة الأقسام: كل قسم يرى فقط طلبات entity_type الخاصة به
// نفس الكيان يظهر في متحددين من نفس المصدر (لا نسخ)
const DEPT_CONFIG: Record<string, { label: string; color: string; entityTypes: string[]; defaultRole: string }> = {
  'admin-affairs': {
    label: 'الشؤون الإدارية',
    color: 'blue',
    entityTypes: ['contract'],         // الإداري: عقود فقط
    defaultRole: 'admin_officer',
  },
  'finance': {
    label: 'الإدارة المالية',
    color: 'amber',
    entityTypes: ['purchase_order', 'journal_entry', 'stock_issue', 'purchase_request'],
    defaultRole: 'finance_controller',
  },
  'materials': {
    label: 'إدارة المواد',
    color: 'teal',
    entityTypes: ['stock_issue', 'purchase_request'],  // مركبات + مخزن
    defaultRole: 'supervisor',
  },
  'maintenance': {
    label: 'إدارة الصيانة',
    color: 'rose',
    entityTypes: ['contract', 'purchase_order'],       // عقود + أوامر شراء للصيانة
    defaultRole: 'supervisor',
  },
};

// ألوان شريط السياق لكل قسم
const DEPT_COLORS: Record<string, string> = {
  blue:  'bg-blue-900/30 border-blue-500/40 text-blue-300',
  amber: 'bg-amber-900/30 border-amber-500/40 text-amber-300',
  teal:  'bg-teal-900/30 border-teal-500/40 text-teal-300',
  rose:  'bg-rose-900/30 border-rose-500/40 text-rose-300',
};

function ApprovalsContent() {
  const searchParams = useSearchParams();
  const deptParam = searchParams.get('dept') ?? '';
  const roleParam = searchParams.get('role') ?? '';

  const deptCfg = DEPT_CONFIG[deptParam] ?? null;
  const initialRole = roleParam || deptCfg?.defaultRole || 'supervisor';

  const [role, setRole]           = useState(initialRole);
  const [userName, setUserName]   = useState('');
  const [items, setItems]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(false);
  const [selected, setSelected]   = useState<any>(null);
  const [detail, setDetail]       = useState<any>(null);
  const [comments, setComments]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/v1/approval/requests/pending?role=${role}`,
        { headers: { 'X-Tenant-ID': getTenantId() || '' } }
      );
      const data = await res.json();
      setItems(data.pending || []);
    } finally {
      setLoading(false);
    }
  }, [role]);

  useEffect(() => { loadPending(); }, [loadPending]);

  // تصفية بالقسم: نفس الكيان لا يتكرر — كل قسم يرى entity_type الخاص به فقط
  const filteredItems = deptCfg
    ? items.filter(i => deptCfg.entityTypes.includes(i.entity_type))
    : items;

  const openDetail = async (item: any) => {
    setSelected(item);
    setComments('');
    const res = await fetch(`/api/v1/approval/requests/${item.id}`, {
      headers: { 'X-Tenant-ID': getTenantId() || '' },
    });
    setDetail(await res.json());
  };

  const doAction = async (action: 'approve' | 'reject' | 'return') => {
    if (!userName.trim()) { showToast('أدخل اسمك أولاً', false); return; }
    if ((action === 'reject' || action === 'return') && !comments.trim()) {
      showToast('يجب إدخال سبب واضح عند الرفض أو الإرجاع', false);
      return;
    }
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/approval/requests/${selected.id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({ action, performed_by: userName, role, comments }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.detail || 'خطأ', false); return; }
      showToast(data.message, true);
      setSelected(null);
      setDetail(null);
      await loadPending();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6" dir="rtl">
      {toast && (
        <div className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl text-sm font-medium shadow-xl ${toast.ok ? 'bg-green-700' : 'bg-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* شريط سياق القسم — يظهر فقط عند الدخول من قسم محدد */}
      {deptCfg && (
        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl border mb-4 ${DEPT_COLORS[deptCfg.color] || 'bg-gray-800 border-gray-700 text-gray-300'}`}>
          <Building2 className="w-4 h-4 shrink-0" />
          <p className="text-sm font-semibold">سياق: {deptCfg.label}</p>
          <span className="text-sm opacity-70 mr-1">— تعرض فقط: {deptCfg.entityTypes.map(t => ENTITY_LABELS[t] || t).join(' ، ')}</span>
          <Link href="/dashboard/admin-gateway" className="mr-auto text-xs underline opacity-60 hover:opacity-100">← كل الأقسام</Link>
        </div>
      )}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CheckSquare className="w-6 h-6 text-amber-400" /> موافقاتي
            <span className="text-xs font-bold bg-green-500 text-black px-2.5 py-0.5 rounded">APPROVALS LIVE ✔</span>
          </h1>
          <p className="text-gray-400 text-sm mt-1">الطلبات المنتظرة لاتخاذ إجراء حسب دورك</p>
        </div>
        <Link href="/dashboard/admin-gateway/workflow" className="text-gray-400 hover:text-white text-sm">← مركز الاعتماد</Link>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">دورك الحالي</label>
          <select
            value={role} onChange={e => setRole(e.target.value)}
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-base"
          >
            {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-sm text-gray-400">اسمك (للتوقيع)</label>
          <input
            value={userName} onChange={e => setUserName(e.target.value)}
            placeholder="e.g. محمد العمر"
            className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-base w-48"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* List */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-white font-semibold text-base">
              {deptCfg ? deptCfg.label + ' — ' : ''}طلبات منتظرة
              {filteredItems.length > 0 && (
                <span className="mr-2 bg-amber-500/20 text-amber-400 text-sm px-2.5 py-0.5 rounded-full font-bold">
                  {filteredItems.length}
                </span>
              )}
            </h2>
            <button onClick={loadPending} className="text-gray-400 hover:text-white text-xs">↻ تحديث</button>
          </div>

          {loading ? (
            <p className="text-gray-500 text-sm text-center py-8">جاري التحميل...</p>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-10">
              <CheckSquare className="w-12 h-12 text-green-500/40 mx-auto mb-3" />
              <p className="text-gray-400">لا توجد طلبات معلقة {deptCfg ? 'لـ' + deptCfg.label : 'لدور ' + ROLES.find(r => r.value === role)?.label}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map((item: any) => (
                <button
                  key={item.id}
                  onClick={() => openDetail(item)}
                  className={`w-full text-right rounded-lg border px-4 py-3 transition-all ${
                    selected?.id === item.id
                      ? 'border-amber-500 bg-amber-900/20'
                      : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-base font-medium truncate">{item.title}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        {ENTITY_LABELS[item.entity_type] || item.entity_type} #{item.entity_id}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 mr-3 flex-shrink-0">
                      <span className="text-amber-400 font-mono text-sm">{item.request_number}</span>
                      <span className="text-gray-500 text-sm">
                        خطوة {item.current_step}/{item.total_steps}
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-500 text-sm mt-2">
                    <Clock className="w-3 h-3 inline ml-1" />
                    {item.step_name} · قدّمه: {item.submitted_by}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Detail & Actions */}
        <div className="bg-gray-900 rounded-xl border border-gray-700 p-4">
          {!selected ? (
            <div className="text-center py-16 text-gray-500">
              <ChevronDown className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p>اختر طلباً من القائمة لاتخاذ إجراء</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">{selected.title}</h3>
                  <p className="text-purple-400 font-mono text-sm mt-0.5">{selected.request_number}</p>
                </div>
                <Link href={`/dashboard/admin-gateway/workflow/requests/${selected.id}`}
                  className="flex items-center gap-1 text-gray-400 hover:text-white text-xs border border-gray-700 px-2 py-1 rounded">
                  <ExternalLink className="w-3 h-3" /> عرض كامل
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-3 text-base">
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">نوع الكيان</p>
                  <p className="text-white">{ENTITY_LABELS[selected.entity_type] || selected.entity_type}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">رقم الكيان</p>
                  <p className="text-white">#{selected.entity_id}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">الخطوة الحالية</p>
                  <p className="text-amber-400">{selected.step_name}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">تقدم</p>
                  <p className="text-white">{selected.current_step} / {selected.total_steps}</p>
                </div>
              </div>

              {/* Steps timeline */}
              {detail?.steps && (
                <div>
                  <p className="text-gray-400 text-sm mb-2 font-medium">مسار الاعتماد</p>
                  <div className="space-y-1">
                    {detail.steps.map((s: any) => (
                      <div key={s.id} className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm ${
                        s.step_order === selected.current_step ? 'bg-amber-900/30 border border-amber-500/30' : 'bg-gray-800'
                      }`}>
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          s.status === 'approved' ? 'bg-green-600 text-white' :
                          s.status === 'rejected' ? 'bg-red-600 text-white' :
                          s.status === 'returned' ? 'bg-blue-600 text-white' :
                          s.step_order === selected.current_step ? 'bg-amber-500 text-black' :
                          'bg-gray-700 text-gray-400'
                        }`}>{s.step_order}</span>
                        <span className="text-white flex-1 text-sm">{s.step_name}</span>
                        <span className="text-gray-500 text-sm">{s.acted_by || '—'}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes from submitter */}
              {selected.notes && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <p className="text-gray-400 text-sm mb-1">ملاحظات مقدم الطلب</p>
                  <p className="text-gray-300 text-base">{selected.notes}</p>
                </div>
              )}

              {/* Comments */}
              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  التعليق
                  <span className="text-red-400 mr-2 text-xs">* مطلوب عند الرفض أو الإرجاع</span>
                </label>
                <textarea
                  value={comments}
                  onChange={e => setComments(e.target.value)}
                  placeholder="أضف ملاحظاتك على هذا القرار..."
                  className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm resize-none h-20"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => doAction('approve')}
                  disabled={submitting || !userName.trim()}
                  className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <CheckSquare className="w-4 h-4" /> موافقة
                </button>
                <button
                  onClick={() => doAction('return')}
                  disabled={submitting || !userName.trim()}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> إعادة
                </button>
                <button
                  onClick={() => doAction('reject')}
                  disabled={submitting || !userName.trim()}
                  className="flex-1 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white rounded-lg py-2.5 font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
                >
                  <XCircle className="w-4 h-4" /> رفض
                </button>
              </div>

              {!userName.trim() && (
                <p className="text-amber-400 text-sm text-center">⚠️ أدخل اسمك أعلاه قبل اتخاذ الإجراء</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}  // end ApprovalsContent

export default function MyApprovalsPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center text-gray-400">جاري التحميل...</div>
    }>
      <ApprovalsContent />
    </Suspense>
  );
}
