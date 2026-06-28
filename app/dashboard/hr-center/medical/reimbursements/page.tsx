'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, FileText, Plus } from 'lucide-react';

type Reimbursement = {
  id: string;
  employeeNo: string;
  employeeName: string;
  amount: number;
  status: 'جديد' | 'قيد المراجعة' | 'مصروف';
};

type ApiRecord = {
  id: string;
  payload: Record<string, unknown>;
};

function getAuthHeaders(): HeadersInit {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token') || '';
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  if (token) headers.Authorization = `Bearer ${token}`;
  if (tenantId) headers['x-tenant-id'] = tenantId;
  return headers;
}

export default function MedicalReimbursementsPage() {
  const [rows, setRows] = useState<Reimbursement[]>([]);

  const [employeeNo, setEmployeeNo] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [amount, setAmount] = useState(0);
  const [status, setStatus] = useState<Reimbursement['status']>('جديد');

  const removeRow = async (id: string) => {
    if (!confirm('تأكيد حذف طلب الاسترجاع؟')) return;
    const res = await fetch('/api/hr-center/medical-reimbursements', {
      method: 'DELETE',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id }),
    });
    if (res.ok) setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const editRow = async (row: Reimbursement) => {
    const raw = prompt('عدّل بيانات الاسترجاع كـ JSON', JSON.stringify(row, null, 2));
    if (!raw) return;
    let parsed: Reimbursement;
    try {
      parsed = JSON.parse(raw);
    } catch {
      alert('تنسيق JSON غير صالح');
      return;
    }
    const payload = {
      employeeNo: String(parsed.employeeNo || '').trim(),
      employeeName: String(parsed.employeeName || '').trim(),
      amount: Number(parsed.amount || 0),
      status: (['جديد', 'قيد المراجعة', 'مصروف'].includes(String(parsed.status || ''))
        ? String(parsed.status)
        : 'جديد') as Reimbursement['status'],
    };
    const res = await fetch('/api/hr-center/medical-reimbursements', {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ id: row.id, payload }),
    });
    if (res.ok) setRows((prev) => prev.map((r) => (r.id === row.id ? { id: row.id, ...payload } : r)));
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/hr-center/medical-reimbursements', { headers: getAuthHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (!mounted) return;
        const records = Array.isArray(d?.data) ? (d.data as ApiRecord[]) : [];
        setRows(
          records.map((row) => ({
            id: row.id,
            employeeNo: String(row.payload?.employeeNo || ''),
            employeeName: String(row.payload?.employeeName || ''),
            amount: Number(row.payload?.amount || 0),
            status: (['جديد', 'قيد المراجعة', 'مصروف'].includes(String(row.payload?.status || ''))
              ? String(row.payload?.status)
              : 'جديد') as Reimbursement['status'],
          }))
        );
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/dashboard/hr-center/medical" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-sm mb-4">
            <ArrowRight className="w-4 h-4" /> قسم الشؤون الطبية
          </Link>
          <h1 className="text-2xl font-bold text-white">استرجاعات العلاج</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
          <div className="grid md:grid-cols-4 gap-3">
            <input value={employeeNo} onChange={(e) => setEmployeeNo(e.target.value)} placeholder="الرقم الوظيفي" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} placeholder="اسم الموظف" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <input type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value) || 0)} placeholder="المبلغ" className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm" />
            <select value={status} onChange={(e) => setStatus(e.target.value as Reimbursement['status'])} className="rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm">
              <option>جديد</option>
              <option>قيد المراجعة</option>
              <option>مصروف</option>
            </select>
          </div>
          <button
            type="button"
            onClick={async () => {
              if (!employeeNo.trim() || !employeeName.trim()) return;
              const payload = { employeeNo: employeeNo.trim(), employeeName: employeeName.trim(), amount, status };
              const res = await fetch('/api/hr-center/medical-reimbursements', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
              });
              const json = await res.json().catch(() => ({}));
              if (res.ok && json?.data?.id) {
                setRows((prev) => [{ id: String(json.data.id), ...payload }, ...prev]);
              }
              setEmployeeNo('');
              setEmployeeName('');
              setAmount(0);
            }}
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600/20 border border-amber-500/40 px-3 py-2 text-sm text-amber-300"
          >
            <Plus className="w-4 h-4" /> إضافة طلب استرجاع
          </button>
        </div>

        <div className="grid gap-3">
          {rows.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{r.employeeName} ({r.employeeNo})</p>
                <p className="text-xs text-slate-400 mt-1">المبلغ: {r.amount.toLocaleString('ar-LY')} • الحالة: {r.status}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => editRow(r)} className="text-xs px-2 py-1 rounded border border-cyan-600/50 text-cyan-300">تعديل</button>
                <button type="button" onClick={() => removeRow(r.id)} className="text-xs px-2 py-1 rounded border border-rose-600/50 text-rose-300">حذف</button>
                <FileText className="w-4 h-4 text-amber-400" />
              </div>
            </div>
          ))}
          {!rows.length && <p className="text-sm text-slate-500">لا توجد طلبات استرجاع مسجلة بعد.</p>}
        </div>
      </div>
    </div>
  );
}
