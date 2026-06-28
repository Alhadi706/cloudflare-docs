'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  ClipboardList,
  Plus,
  ShoppingCart,
  Truck,
  XCircle,
} from 'lucide-react';

type MaterialItemRequest = {
  inventory_item_id?: number;
  item_name: string;
  item_category: string;
  requested_qty: number;
  unit: string;
  notes?: string;
};

type MaterialRequest = {
  id: string;
  request_no: string;
  requester_dept: string;
  requester_name: string;
  requester_contact?: string;
  target_use_case?: string;
  items: MaterialItemRequest[];
  status:
    | 'pending_dept_approval'
    | 'pending_materials_approval'
    | 'pending_finance_approval'
    | 'approved_waiting_fulfillment'
    | 'procurement_in_progress'
    | 'ready_for_pickup'
    | 'issued'
    | 'rejected';
  fulfillment_mode?: 'from_stock' | 'procure';
  notified_ready_at?: string;
  created_at: string;
  updated_at: string;
  events: Array<{ at: string; action: string; by: string; notes?: string }>;
};

type TemplateMap = Record<string, Array<{ item_name: string; item_category: string; unit: string }>>;

const DEPTS = [
  { id: 'admin-affairs', name: 'الشؤون الإدارية' },
  { id: 'finance', name: 'المالية' },
  { id: 'maintenance', name: 'الصيانة' },
  { id: 'corrosion', name: 'التآكل' },
  { id: 'services', name: 'الخدمات/الذكاء' },
  { id: 'materials', name: 'إدارة المواد' },
];

const STATUS_AR: Record<MaterialRequest['status'], string> = {
  pending_dept_approval: 'بانتظار اعتماد الإدارة الطالبة',
  pending_materials_approval: 'بانتظار اعتماد إدارة المواد',
  pending_finance_approval: 'بانتظار اعتماد المالية',
  approved_waiting_fulfillment: 'معتمد وجاهز لتحديد طريقة التوفير',
  procurement_in_progress: 'قيد التوفير عبر الشراء',
  ready_for_pickup: 'جاهز للاستلام من المخزن',
  issued: 'تم الصرف',
  rejected: 'مرفوض',
};

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || '';
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const token = localStorage.getItem('auth_token') || '';
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function statusCls(s: MaterialRequest['status']): string {
  if (s === 'ready_for_pickup') return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/40';
  if (s === 'issued') return 'text-cyan-300 bg-cyan-500/15 border-cyan-500/40';
  if (s === 'rejected') return 'text-rose-300 bg-rose-500/15 border-rose-500/40';
  if (s === 'procurement_in_progress') return 'text-violet-300 bg-violet-500/15 border-violet-500/40';
  return 'text-amber-300 bg-amber-500/15 border-amber-500/40';
}

const emptyItem = (): MaterialItemRequest => ({
  inventory_item_id: undefined,
  item_name: '',
  item_category: '',
  requested_qty: 1,
  unit: 'piece',
  notes: '',
});

export default function MaterialsRequestsPage() {
  const [tab, setTab] = useState<'new' | 'tracking' | 'approvals'>('new');
  const [requests, setRequests] = useState<MaterialRequest[]>([]);
  const [templates, setTemplates] = useState<TemplateMap>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState('');

  const [requesterDept, setRequesterDept] = useState('admin-affairs');
  const [requesterName, setRequesterName] = useState('');
  const [requesterContact, setRequesterContact] = useState('');
  const [targetUseCase, setTargetUseCase] = useState('');
  const [items, setItems] = useState<MaterialItemRequest[]>([emptyItem()]);

  const [actor, setActor] = useState('materials_officer');

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/material-requests', {
        headers: { 'X-Tenant-ID': getTenantId(), ...getAuthHeaders() },
      });
      const data = await res.json();
      setRequests(Array.isArray(data.requests) ? data.requests : []);
      setTemplates((data.templates || {}) as TemplateMap);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const selectedTemplates = useMemo(
    () => templates[requesterDept] || [],
    [templates, requesterDept]
  );

  const addItem = () => setItems((prev) => [...prev, emptyItem()]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, key: keyof MaterialItemRequest, val: string | number | undefined) => {
    setItems((prev) =>
      prev.map((it, i) => (i === idx ? { ...it, [key]: val } : it))
    );
  };

  const addFromTemplate = (tpl: { item_name: string; item_category: string; unit: string }) => {
    setItems((prev) => [
      ...prev,
      {
        inventory_item_id: undefined,
        item_name: tpl.item_name,
        item_category: tpl.item_category,
        requested_qty: 1,
        unit: tpl.unit,
        notes: '',
      },
    ]);
  };

  const submitRequest = async () => {
    const payloadItems = items.filter(
      (it) => it.item_name.trim() && it.item_category.trim() && Number(it.requested_qty) > 0
    );
    if (!requesterName.trim() || payloadItems.length === 0) {
      setMsg('أدخل اسم مقدم الطلب وأضف صنفاً صحيحاً واحداً على الأقل.');
      return;
    }

    const res = await fetch('/api/v1/material-requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tenant-ID': getTenantId(),
        ...getAuthHeaders(),
      },
      body: JSON.stringify({
        requester_dept: requesterDept,
        requester_name: requesterName,
        requester_contact: requesterContact,
        target_use_case: targetUseCase,
        items: payloadItems,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setMsg(data.detail || 'فشل إنشاء الطلب');
      return;
    }

    setMsg('تم إنشاء الطلب وإرساله لمسار الموافقات.');
    setRequesterName('');
    setRequesterContact('');
    setTargetUseCase('');
    setItems([emptyItem()]);
    setTab('tracking');
    load();
  };

  const doAction = async (
    id: string,
    action:
      | 'approve_dept'
      | 'approve_materials'
      | 'approve_finance'
      | 'set_fulfillment_stock'
      | 'set_fulfillment_procure'
      | 'mark_ready_for_pickup'
      | 'mark_issued'
      | 'reject'
  ) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/v1/material-requests/${id}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Tenant-ID': getTenantId(),
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ action, actor, notes: '' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.detail || 'تعذر تنفيذ الإجراء');
      } else {
        setMsg('تم تحديث حالة الطلب بنجاح.');
      }
      load();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-6" dir="rtl">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-200">بوابة الإدارة</Link>
          <ChevronLeft className="w-4 h-4" />
          <Link href="/dashboard/admin-gateway/materials" className="hover:text-slate-200">إدارة المواد</Link>
          <ChevronLeft className="w-4 h-4" />
          <span className="text-slate-100">طلبات المواد بين الإدارات</span>
        </div>

        <div className="rounded-2xl border border-white/10 bg-slate-900/40 p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-teal-500/40 bg-teal-500/10 p-2.5">
                <ShoppingCart className="w-5 h-5 text-teal-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">منصة طلب المواد المؤسسية</h1>
                <p className="text-sm text-slate-300">طلب -> موافقات -> فحص مخزون تلقائي -> صرف من المخزن أو توفير -> إشعار جهة الطلب -> استلام</p>
              </div>
            </div>
            <div className="text-xs text-slate-400">إجمالي الطلبات: {requests.length}</div>
          </div>
        </div>

        <div className="flex gap-2">
          {[
            { key: 'new', label: 'طلب جديد', icon: Plus },
            { key: 'tracking', label: 'متابعة الطلبات', icon: ClipboardList },
            { key: 'approvals', label: 'الموافقات والتنفيذ', icon: CheckCircle2 },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as 'new' | 'tracking' | 'approvals')}
              className={`rounded-xl border px-4 py-2 text-sm inline-flex items-center gap-2 ${
                tab === t.key
                  ? 'border-teal-500/50 bg-teal-500/15 text-teal-200'
                  : 'border-white/10 bg-white/5 text-slate-300'
              }`}
            >
              <t.icon className="w-4 h-4" />
              {t.label}
            </button>
          ))}
        </div>

        {msg && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200">
            {msg}
          </div>
        )}

        {tab === 'new' && (
          <section className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">الإدارة الطالبة</label>
                <select
                  value={requesterDept}
                  onChange={(e) => setRequesterDept(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                >
                  {DEPTS.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">اسم مقدم الطلب</label>
                <input
                  value={requesterName}
                  onChange={(e) => setRequesterName(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">جهة التواصل</label>
                <input
                  value={requesterContact}
                  onChange={(e) => setRequesterContact(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="هاتف / بريد / اسم المخوّل بالاستلام"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">الغرض التشغيلي</label>
                <input
                  value={targetUseCase}
                  onChange={(e) => setTargetUseCase(e.target.value)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
                  placeholder="مثال: صيانة محطة/قرطاسية قسم/احتياج مشروع"
                />
              </div>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-3">
              <h3 className="text-sm font-semibold text-slate-200 mb-2">اقتراحات حسب الإدارة</h3>
              <div className="flex flex-wrap gap-2">
                {selectedTemplates.map((tpl, i) => (
                  <button
                    key={`${tpl.item_name}-${i}`}
                    onClick={() => addFromTemplate(tpl)}
                    className="rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-200 hover:bg-slate-800"
                  >
                    + {tpl.item_name}
                  </button>
                ))}
                {selectedTemplates.length === 0 && <span className="text-xs text-slate-500">لا توجد قوالب جاهزة لهذه الإدارة بعد.</span>}
              </div>
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-slate-200">بنود الطلب</h3>
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 gap-2 rounded-lg border border-slate-700 bg-slate-900/60 p-2">
                  <input
                    type="number"
                    min={1}
                    value={it.inventory_item_id ?? ''}
                    onChange={(e) =>
                      updateItem(
                        idx,
                        'inventory_item_id',
                        e.target.value.trim() ? Number(e.target.value) : undefined
                      )
                    }
                    placeholder="ID الصنف بالمخزون (اختياري)"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    value={it.item_name}
                    onChange={(e) => updateItem(idx, 'item_name', e.target.value)}
                    placeholder="اسم الصنف"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    value={it.item_category}
                    onChange={(e) => updateItem(idx, 'item_category', e.target.value)}
                    placeholder="الفئة"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    type="number"
                    min={1}
                    value={it.requested_qty}
                    onChange={(e) => updateItem(idx, 'requested_qty', Number(e.target.value))}
                    placeholder="الكمية"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    value={it.unit}
                    onChange={(e) => updateItem(idx, 'unit', e.target.value)}
                    placeholder="الوحدة"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <input
                    value={it.notes || ''}
                    onChange={(e) => updateItem(idx, 'notes', e.target.value)}
                    placeholder="ملاحظات"
                    className="md:col-span-2 rounded-md border border-slate-700 bg-slate-900 px-2 py-1.5 text-xs text-slate-100"
                  />
                  <button
                    onClick={() => removeItem(idx)}
                    className="md:col-span-1 rounded-md border border-rose-500/40 bg-rose-500/10 text-rose-200 text-xs"
                  >
                    حذف
                  </button>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <button onClick={addItem} className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200">+ بند</button>
              <button onClick={submitRequest} className="rounded-lg border border-teal-500/50 bg-teal-500/20 px-3 py-2 text-sm text-teal-100">إرسال الطلب لمسار الموافقات</button>
            </div>
          </section>
        )}

        {tab === 'tracking' && (
          <section className="space-y-3">
            {loading ? (
              <div className="text-slate-400 text-sm">جارٍ التحميل...</div>
            ) : requests.length === 0 ? (
              <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-4 text-slate-400 text-sm">لا توجد طلبات بعد.</div>
            ) : (
              requests.map((r) => (
                <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm text-slate-200 font-semibold">{r.request_no} • {DEPTS.find((d) => d.id === r.requester_dept)?.name || r.requester_dept}</p>
                      <p className="text-xs text-slate-400">{r.requester_name} • {new Date(r.created_at).toLocaleString('ar-LY')}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs ${statusCls(r.status)}`}>
                      {STATUS_AR[r.status]}
                    </span>
                  </div>

                  <div className="text-xs text-slate-300">{r.target_use_case || '—'}</div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {r.items.map((it, i) => (
                      <div key={i} className="rounded-lg border border-slate-700 bg-slate-900/50 px-3 py-2 text-xs text-slate-300">
                        {it.item_name}
                        {it.inventory_item_id ? ` [ID:${it.inventory_item_id}]` : ''}
                        {' '}• {it.requested_qty} {it.unit} • {it.item_category}
                      </div>
                    ))}
                  </div>

                  {r.notified_ready_at && (
                    <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200 inline-flex items-center gap-2">
                      <Bell className="w-3.5 h-3.5" />
                      تم إشعار جهة الطلب بتوفر المواد: {new Date(r.notified_ready_at).toLocaleString('ar-LY')}
                    </div>
                  )}
                </div>
              ))
            )}
          </section>
        )}

        {tab === 'approvals' && (
          <section className="space-y-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 flex items-center gap-2">
              <span className="text-xs text-slate-400">المنفذ الحالي:</span>
              <input
                value={actor}
                onChange={(e) => setActor(e.target.value)}
                className="rounded-md border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-slate-100"
                placeholder="اسم/دور المنفذ"
              />
              <span className="text-xs text-slate-500">مثال: dept_manager / materials_manager / finance_controller / store_keeper — بعد اعتماد المالية يتم فحص المخزون تلقائيًا.</span>
            </div>

            {requests.map((r) => (
              <div key={r.id} className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-100 font-semibold">{r.request_no}</p>
                    <p className="text-xs text-slate-400">{DEPTS.find((d) => d.id === r.requester_dept)?.name || r.requester_dept} • {r.requester_name}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-1 text-xs ${statusCls(r.status)}`}>{STATUS_AR[r.status]}</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {r.status === 'pending_dept_approval' && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'approve_dept')} className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100">اعتماد الإدارة الطالبة</button>
                  )}
                  {r.status === 'pending_materials_approval' && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'approve_materials')} className="rounded-lg border border-teal-500/40 bg-teal-500/15 px-3 py-1.5 text-xs text-teal-100">اعتماد إدارة المواد</button>
                  )}
                  {r.status === 'pending_finance_approval' && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'approve_finance')} className="rounded-lg border border-indigo-500/40 bg-indigo-500/15 px-3 py-1.5 text-xs text-indigo-100">اعتماد المالية + فحص مخزون تلقائي</button>
                  )}
                  {r.status === 'approved_waiting_fulfillment' && (
                    <>
                      <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'set_fulfillment_stock')} className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100 inline-flex items-center gap-1.5"><Truck className="w-3.5 h-3.5" />متوفر في المخزن: تجهيز للاستلام</button>
                      <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'set_fulfillment_procure')} className="rounded-lg border border-violet-500/40 bg-violet-500/15 px-3 py-1.5 text-xs text-violet-100">غير متوفر: البدء بالتوفير</button>
                    </>
                  )}
                  {r.status === 'procurement_in_progress' && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'mark_ready_for_pickup')} className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-1.5 text-xs text-emerald-100">تم التوفير: إشعار جهة الطلب بالاستلام</button>
                  )}
                  {r.status === 'ready_for_pickup' && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'mark_issued')} className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs text-cyan-100">تأكيد الاستلام والصرف</button>
                  )}

                  {!['issued', 'rejected'].includes(r.status) && (
                    <button disabled={busyId === r.id} onClick={() => doAction(r.id, 'reject')} className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs text-rose-100 inline-flex items-center gap-1.5"><XCircle className="w-3.5 h-3.5" />رفض</button>
                  )}
                </div>

                <details className="rounded-lg border border-slate-700 bg-slate-900/40 p-2">
                  <summary className="cursor-pointer text-xs text-slate-300">عرض سجل الإجراءات</summary>
                  <div className="mt-2 space-y-1.5">
                    {r.events.map((ev, i) => (
                      <div key={i} className="text-xs text-slate-400">
                        <span className="text-slate-300">{new Date(ev.at).toLocaleString('ar-LY')}</span>
                        {' '}• {ev.action} • {ev.by}
                        {ev.notes ? ` • ${ev.notes}` : ''}
                      </div>
                    ))}
                  </div>
                </details>
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
