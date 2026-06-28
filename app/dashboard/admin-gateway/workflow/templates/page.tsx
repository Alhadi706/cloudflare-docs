'use client';
import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2 } from 'lucide-react';

const getTenantId = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('tenant_id');
};


const ENTITY_LABELS: Record<string, string> = {
  purchase_request: 'طلب الشراء',
  purchase_order:   'أمر الشراء',
  journal_entry:    'القيد المحاسبي',
  stock_issue:      'صرف المخزن',
  contract:         'العقد',
};

const ROLE_LABELS: Record<string, string> = {
  supervisor:         'المشرف المباشر',
  finance_controller: 'المراقب المالي',
  management:         'الإدارة',
  director:           'المدير العام',
};

const ENTITY_COLORS: Record<string, string> = {
  purchase_request: 'border-orange-500/40 bg-orange-900/10',
  purchase_order:   'border-yellow-500/40 bg-yellow-900/10',
  journal_entry:    'border-indigo-500/40 bg-indigo-900/10',
  stock_issue:      'border-teal-500/40 bg-teal-900/10',
  contract:         'border-purple-500/40 bg-purple-900/10',
};

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm] = useState({
    entity_type: 'purchase_request', step_order: 1, step_name: '', role_required: 'supervisor',
  });
  const [saving, setSaving]       = useState(false);
  const [toast, setToast]         = useState<{ msg: string; ok: boolean } | null>(null);

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 4000);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/approval/templates', { headers: { 'X-Tenant-ID': getTenantId() || '' } });
      const data = await res.json();
      setTemplates(data.templates || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Group by entity_type
  const grouped: Record<string, any[]> = {};
  for (const t of templates) {
    if (!grouped[t.entity_type]) grouped[t.entity_type] = [];
    grouped[t.entity_type].push(t);
  }

  const save = async () => {
    if (!form.step_name.trim()) { showToast('أدخل اسم الخطوة', false); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/v1/approval/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Tenant-ID': getTenantId() || '' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.detail || 'خطأ', false); return; }
      showToast('تم حفظ الخطوة', true);
      setShowForm(false);
      setForm({ entity_type: 'purchase_request', step_order: 1, step_name: '', role_required: 'supervisor' });
      await load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('هل تريد حذف هذه الخطوة؟')) return;
    await fetch(`/api/v1/approval/templates/${id}`, {
      method: 'DELETE', headers: { 'X-Tenant-ID': getTenantId() || '' },
    });
    showToast('تم الحذف', true);
    await load();
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
            <Shield className="w-6 h-6 text-teal-400" /> قوالب تدفق الاعتماد
          </h1>
          <p className="text-gray-400 text-sm mt-1">تحديد خطوات الاعتماد لكل نوع من الكيانات</p>
        </div>
        <div className="flex gap-3">
          <a href="/dashboard/admin-gateway/workflow" className="text-gray-400 hover:text-white text-sm">← لوحة الاعتماد</a>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-teal-600 hover:bg-teal-700 text-white rounded-lg px-4 py-2 text-sm flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> إضافة خطوة
          </button>
        </div>
      </div>

      {/* Add Step Form */}
      {showForm && (
        <div className="bg-gray-900 border border-teal-500/40 rounded-xl p-5 mb-6">
          <h3 className="text-white font-semibold mb-4">إضافة / تعديل خطوة اعتماد</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="text-xs text-gray-400 block mb-1">نوع الكيان</label>
              <select
                value={form.entity_type}
                onChange={e => setForm(f => ({ ...f, entity_type: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(ENTITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">ترتيب الخطوة</label>
              <input type="number" min={1}
                value={form.step_order}
                onChange={e => setForm(f => ({ ...f, step_order: parseInt(e.target.value) }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">اسم الخطوة *</label>
              <input
                value={form.step_name}
                onChange={e => setForm(f => ({ ...f, step_name: e.target.value }))}
                placeholder="مثال: مراجعة المشرف"
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-xs text-gray-400 block mb-1">الدور المطلوب</label>
              <select
                value={form.role_required}
                onChange={e => setForm(f => ({ ...f, role_required: e.target.value }))}
                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg px-3 py-2 text-sm"
              >
                {Object.entries(ROLE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={save} disabled={saving}
              className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 text-white rounded-lg px-6 py-2 text-sm font-semibold">
              {saving ? 'جاري الحفظ...' : 'حفظ الخطوة'}
            </button>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white text-sm px-4 py-2">إلغاء</button>
          </div>
          <p className="text-gray-500 text-xs mt-2">
            ملاحظة: إذا كان الترتيب موجوداً بالفعل، سيتم تحديث الخطوة
          </p>
        </div>
      )}

      {/* Templates grouped by entity */}
      {loading ? (
        <div className="text-center py-12 text-gray-500">جاري التحميل...</div>
      ) : (
        <div className="space-y-5">
          {Object.keys(ENTITY_LABELS).map(etype => {
            const steps = grouped[etype] || [];
            return (
              <div key={etype} className={`rounded-xl border p-4 ${ENTITY_COLORS[etype] || 'border-gray-700 bg-gray-900'}`}>
                <h3 className="text-white font-semibold mb-3 flex items-center gap-2">
                  <Shield className="w-4 h-4 text-teal-400" />
                  {ENTITY_LABELS[etype]}
                  <span className="text-gray-500 text-xs font-normal">({steps.length} خطوة)</span>
                </h3>
                {steps.length === 0 ? (
                  <p className="text-gray-500 text-xs py-2">لا توجد خطوات محددة — يتم توليدها تلقائياً عند الحاجة</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {steps.map((s: any) => (
                      <div key={s.id} className="bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 flex items-center gap-3">
                        <span className="bg-gray-700 text-gray-300 text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                          {s.step_order}
                        </span>
                        <div>
                          <p className="text-white text-sm">{s.step_name}</p>
                          <p className="text-gray-500 text-xs">{ROLE_LABELS[s.role_required] || s.role_required}</p>
                        </div>
                        <button
                          onClick={() => remove(s.id)}
                          className="text-gray-600 hover:text-red-400 transition-colors mr-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-6 border border-teal-500/20 bg-teal-900/10 rounded-xl p-4 text-center">
        <p className="text-teal-300 text-sm">
          القوالب تُعبّأ تلقائياً بالقيم الافتراضية عند أول طلب اعتماد من كل نوع
        </p>
      </div>
    </div>
  );
}
