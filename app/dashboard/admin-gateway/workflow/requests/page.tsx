'use client';
import { useState, useEffect, useCallback } from 'react';
import { FileText, ChevronLeft, Clock, CheckSquare, XCircle, RotateCcw, Plus } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const ENTITY_LABELS: Record<string, string> = {
  purchase_request: 'طلب شراء',
  purchase_order:   'أمر شراء',
  journal_entry:    'قيد محاسبي',
  stock_issue:      'صرف مخزن',
  contract:         'عقد',
};

const STATUS_CFG: Record<string, { label: string; color: string; icon: any }> = {
  pending:   { label: 'قيد الانتظار', color: 'text-amber-400 bg-amber-900/30',  icon: Clock },
  approved:  { label: 'معتمد',        color: 'text-green-400 bg-green-900/30',   icon: CheckSquare },
  rejected:  { label: 'مرفوض',       color: 'text-red-400 bg-red-900/30',       icon: XCircle },
  returned:  { label: 'معاد',         color: 'text-blue-400 bg-blue-900/30',     icon: RotateCcw },
  cancelled: { label: 'ملغي',         color: 'text-gray-400 bg-gray-800/30',     icon: XCircle },
};

const ROLE_LABELS: Record<string, string> = {
  supervisor:         'المشرف المباشر',
  finance_controller: 'المراقب المالي',
  management:         'الإدارة',
  director:           'المدير العام',
};

export default function RequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [total, setTotal]       = useState(0);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [detail, setDetail]     = useState<any>(null);

  // Filters
  const [fStatus, setFStatus]   = useState('');
  const [fType, setFType]       = useState('');

  // New request form
  const [showForm, setShowForm]     = useState(false);
  const [formData, setFormData] = useState({
    entity_type: 'purchase_request', entity_id: '', title: '', submitted_by: '', notes: ''
  });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast]       = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (fStatus) params.append('status', fStatus);
      if (fType)   params.append('entity_type', fType);
      const res = await fetch(`/api/v1/approval/requests?${params}`, {
        headers: { 'X-Tenant-ID': getTenantId() || '' },
      });
      const data = await res.json();
      setRequests(data.requests || []);
      setTotal(data.total || 0);
    } finally {
      setLoading(false);
    }
  }, [fStatus, fType]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const openDetail = async (req: any) => {
    setSelected(req);
    const res = await fetch(`/api/v1/approval/requests/${req.id}`, {
      headers: { 'X-Tenant-ID': getTenantId() || '' },
    });
    setDetail(await res.json());
  };

  const submitRequest = async () => {
    if (!formData.entity_id || !formData.title || !formData.submitted_by) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', false); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/approval/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify({ ...formData, entity_id: parseInt(formData.entity_id) }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.detail || 'فشل في التقديم', false); return; }
      showToast(`✅ تم تقديم الطلب: ${data.request_number}`, true);
      setShowForm(false);
      setFormData({ entity_type: 'purchase_request', entity_id: '', title: '', submitted_by: '', notes: '' });
      await loadRequests();
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

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" /> طلبات الاعتماد
          </h1>
          <p className="text-gray-400 text-sm mt-1">عرض وتتبع جميع طلبات الاعتماد · {total} طلب</p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard/admin-gateway/workflow" className="text-gray-400 hover:text-white text-sm">← لوحة الاعتماد</a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-purple-600 hover:bg-purple-700 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> طلب اعتماد جديد
          </button>
        </div>
      </div>

      {/* New Request Form */}
      {showForm && (
        <div className="bg-gray-900 border border-purple-500/40 rounded-xl p-5 mb-5">
          <h3 className="text-white font-semibold mb-4">تقديم طلب اعتماد جديد</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">نوع الكيان *</label>
              <select
                value={formData.entity_type}
                onChange={e => setFormData(f => ({ ...f, entity_type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">معرّف الكيان (ID) *</label>
              <input type="number"
                value={formData.entity_id}
                onChange={e => setFormData(f => ({ ...f, entity_id: e.target.value }))}
                placeholder="e.g. 5"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">عنوان الطلب *</label>
              <input
                value={formData.title}
                onChange={e => setFormData(f => ({ ...f, title: e.target.value }))}
                placeholder="وصف مختصر للطلب"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">مقدم بواسطة *</label>
              <input
                value={formData.submitted_by}
                onChange={e => setFormData(f => ({ ...f, submitted_by: e.target.value }))}
                placeholder="اسمك"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-gray-400 block mb-1">ملاحظات</label>
              <textarea
                value={formData.notes}
                onChange={e => setFormData(f => ({ ...f, notes: e.target.value }))}
                placeholder="تفاصيل إضافية..."
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm resize-none h-16"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={submitRequest} disabled={submitting}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white rounded-lg px-6 py-2 text-sm font-semibold"
            >
              {submitting ? 'جاري التقديم...' : 'تقديم الطلب'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-4 py-2">إلغاء</button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <select
          value={fStatus} onChange={e => setFStatus(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الحالات</option>
          {Object.entries(STATUS_CFG).map(([v, c]) => <option key={v} value={v}>{c.label}</option>)}
        </select>
        <select
          value={fType} onChange={e => setFType(e.target.value)}
          className="bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
        >
          <option value="">كل الأنواع</option>
          {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button onClick={loadRequests} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-4 py-2 text-sm">
          تحديث
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* List — 3 cols */}
        <div className="lg:col-span-3 bg-gray-900 rounded-xl border border-gray-700 overflow-hidden">
          {loading ? (
            <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
          ) : requests.length === 0 ? (
            <div className="text-center py-12 text-gray-500">لا توجد طلبات</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr className="text-gray-400 text-right">
                  <th className="py-3 pr-4">الطلب</th>
                  <th className="py-3">النوع</th>
                  <th className="py-3">الخطوة</th>
                  <th className="py-3">الحالة</th>
                  <th className="py-3 pl-4"></th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r: any) => {
                  const st = STATUS_CFG[r.status] || { label: r.status, color: 'text-gray-400 bg-gray-800', icon: Clock };
                  const Icon = st.icon;
                  return (
                    <tr
                      key={r.id}
                      className={`border-t border-gray-800 hover:bg-gray-800/50 cursor-pointer ${selected?.id === r.id ? 'bg-gray-800/70' : ''}`}
                      onClick={() => openDetail(r)}
                    >
                      <td className="py-3 pr-4">
                        <p className="text-white font-medium truncate max-w-[180px]">{r.title}</p>
                        <p className="text-purple-400 font-mono text-xs">{r.request_number}</p>
                      </td>
                      <td className="py-3 text-gray-400 text-xs">{ENTITY_LABELS[r.entity_type] || r.entity_type}</td>
                      <td className="py-3 text-gray-400 text-xs">{r.current_step}/{r.total_steps}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${st.color}`}>
                          <Icon className="w-3 h-3" />{st.label}
                        </span>
                      </td>
                      <td className="py-3 pl-4 text-gray-500 text-xs text-left">
                        <ChevronLeft className="w-4 h-4" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Detail — 2 cols */}
        <div className="lg:col-span-2 bg-gray-900 rounded-xl border border-gray-700 p-4">
          {!selected ? (
            <div className="text-center py-16 text-gray-600">
              <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm">اختر طلباً للتفاصيل</p>
            </div>
          ) : detail ? (
            <div className="space-y-4">
              <div>
                <p className="text-purple-400 font-mono text-xs">{detail.request_number}</p>
                <h3 className="text-white font-semibold mt-1">{detail.title}</h3>
                <p className="text-gray-400 text-xs mt-1">
                  {ENTITY_LABELS[detail.entity_type]} #{detail.entity_id} · قدّمه: {detail.submitted_by}
                </p>
              </div>

              {/* Steps */}
              <div>
                <p className="text-gray-400 text-xs mb-2 font-medium">مسار الاعتماد</p>
                <div className="space-y-1.5">
                  {detail.steps?.map((s: any) => (
                    <div key={s.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs ${
                      s.step_order === detail.current_step && detail.status === 'pending'
                        ? 'bg-amber-900/30 border border-amber-500/30'
                        : 'bg-gray-800'
                    }`}>
                      <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        s.status === 'approved' ? 'bg-green-600 text-white' :
                        s.status === 'rejected' ? 'bg-red-600 text-white' :
                        s.status === 'returned' ? 'bg-blue-600 text-white' :
                        s.step_order === detail.current_step ? 'bg-amber-500 text-black' :
                        'bg-gray-700 text-gray-400'
                      }`}>{s.step_order}</span>
                      <span className="text-white flex-1">{s.step_name}</span>
                      <span className="text-gray-500">{ROLE_LABELS[s.role_required] || s.role_required}</span>
                      {s.acted_by && <span className="text-gray-400">({s.acted_by})</span>}
                    </div>
                  ))}
                </div>
              </div>

              {/* History */}
              {detail.history?.length > 0 && (
                <div>
                  <p className="text-gray-400 text-xs mb-2 font-medium">سجل الإجراءات</p>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {detail.history.map((h: any) => {
                      const actionLabels: Record<string, string> = {
                        submitted: 'تقديم', approved: 'موافقة', rejected: 'رفض',
                        returned: 'إعادة', cancelled: 'إلغاء',
                      };
                      const actionColors: Record<string, string> = {
                        submitted: 'text-purple-400', approved: 'text-green-400',
                        rejected: 'text-red-400', returned: 'text-blue-400',
                        cancelled: 'text-gray-400',
                      };
                      return (
                        <div key={h.id} className="bg-gray-800 rounded px-3 py-2 text-xs">
                          <div className="flex items-center justify-between">
                            <span className={`font-medium ${actionColors[h.action] || 'text-white'}`}>
                              {actionLabels[h.action] || h.action}
                            </span>
                            <span className="text-gray-500">{h.performed_by}</span>
                          </div>
                          {h.notes && <p className="text-gray-400 mt-0.5">{h.notes}</p>}
                          <p className="text-gray-600 text-xs mt-0.5">
                            {new Date(h.performed_at).toLocaleString('ar-SA')}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 text-sm">جاري التحميل...</div>
          )}
        </div>
      </div>
    </div>
  );
}
