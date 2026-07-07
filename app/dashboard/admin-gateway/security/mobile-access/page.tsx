'use client';
import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, UserCheck, UserX, Smartphone, Clock, CheckCircle, XCircle } from 'lucide-react';

interface AccessRequest {
  id: string;
  tenant_id: string;
  tenant_code: string;
  employee_no: string;
  full_name: string;
  department_code: string;
  status: 'pending' | 'approved' | 'rejected';
  requested_at: string;
  reviewed_by?: string;
  reviewed_at?: string;
  reject_reason?: string;
}

function getAuthHeaders() {
  if (typeof window === 'undefined') return { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('auth_token') || '';
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const ROLE_OPTIONS = [
  { value: 'employee',        label: '👷 موظف' },
  { value: 'supervisor',      label: '👁 مشرف ميداني' },
  { value: 'section_manager', label: '📋 رئيس قسم' },
  { value: 'dept_manager',    label: '🏛 مدير إدارة' },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending:  { label: 'في الانتظار', color: 'bg-amber-800/60 text-amber-200' },
  approved: { label: 'مقبول',       color: 'bg-emerald-800/60 text-emerald-200' },
  rejected: { label: 'مرفوض',       color: 'bg-red-800/60 text-red-200' },
};

export default function MobileAccessRequestsPage() {
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [rejectReasons, setRejectReasons] = useState<Record<string, string>>({});
  const [toast, setToast] = useState('');

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(''), 4000);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter === 'all' ? '/api/auth/mobile/access-requests' : `/api/auth/mobile/access-requests?status=${filter}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        setRequests(Array.isArray(data.requests) ? data.requests : []);
      }
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  async function review(reqId: string, action: 'approve' | 'reject') {
    setReviewing(reqId);
    try {
      const body: Record<string, string> = {
        request_id: reqId,
        action,
        ...(action === 'approve' ? { mobile_role: selectedRoles[reqId] || 'employee' } : {}),
        ...(action === 'reject'  ? { reason: rejectReasons[reqId] || '' } : {}),
      };
      const res = await fetch('/api/auth/mobile/access-requests', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(action === 'approve' ? '✓ تم القبول وتفعيل الحساب' : '✓ تم الرفض');
        void load();
      } else {
        showToast(`⚠ ${data.detail || 'حدث خطأ'}`);
      }
    } finally { setReviewing(null); }
  }

  const pending = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6" dir="rtl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-xl border border-emerald-500/40 bg-slate-900 px-5 py-3 text-sm font-bold text-emerald-200 shadow-xl">
          {toast}
        </div>
      )}

      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-violet-500/20 border border-violet-500/30 p-3">
            <Smartphone className="h-6 w-6 text-violet-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white">طلبات تسجيل الموبايل</h1>
            <p className="text-sm text-slate-400">مراجعة وقبول طلبات الوصول للتطبيق الميداني</p>
          </div>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          تحديث
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'في الانتظار', value: requests.filter(r => r.status === 'pending').length,  color: 'text-amber-300' },
          { label: 'مقبول',       value: requests.filter(r => r.status === 'approved').length, color: 'text-emerald-300' },
          { label: 'مرفوض',       value: requests.filter(r => r.status === 'rejected').length, color: 'text-red-300' },
        ].map(s => (
          <div key={s.label} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-4 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-xs text-slate-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-4">
        {(['pending', 'approved', 'rejected', 'all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-xl px-3 py-1.5 text-xs font-bold border transition-all ${filter === f ? 'bg-violet-700 border-violet-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/40'}`}
          >
            {f === 'pending' ? `⏳ معلق (${pending})` : f === 'approved' ? '✅ مقبول' : f === 'rejected' ? '❌ مرفوض' : '📋 الكل'}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16"><RefreshCw className="h-8 w-8 animate-spin text-violet-400" /></div>
      ) : requests.length === 0 ? (
        <div className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-12 text-center">
          <Smartphone className="mx-auto h-12 w-12 text-slate-600 mb-3" />
          <p className="text-slate-400 font-bold">لا توجد طلبات {filter !== 'all' ? STATUS_LABELS[filter]?.label : ''}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => {
            const st = STATUS_LABELS[req.status];
            const isReviewing = reviewing === req.id;
            return (
              <div key={req.id} className="rounded-2xl border border-slate-700/60 bg-slate-900/60 p-5 space-y-4">
                {/* Employee Info */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-black text-white text-lg">{req.full_name || req.employee_no}</p>
                    <p className="text-sm text-slate-400">رقم وظيفي: <span className="text-emerald-400 font-bold">{req.employee_no}</span></p>
                    {req.department_code && <p className="text-xs text-slate-500">الإدارة: {req.department_code}</p>}
                    <p className="text-xs text-slate-500 mt-1">
                      <Clock className="inline h-3 w-3 mr-1" />
                      {new Date(req.requested_at).toLocaleString('ar-SA')}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold ${st.color}`}>{st.label}</span>
                </div>

                {/* Approve Actions */}
                {req.status === 'pending' && (
                  <div className="space-y-3">
                    {/* Role selector */}
                    <div>
                      <p className="text-xs text-slate-500 mb-2">حدد صلاحية الحساب قبل القبول:</p>
                      <div className="grid grid-cols-2 gap-2">
                        {ROLE_OPTIONS.map(opt => (
                          <button key={opt.value}
                            onClick={() => setSelectedRoles(prev => ({ ...prev, [req.id]: opt.value }))}
                            className={`rounded-xl px-2 py-2 text-xs font-bold border transition-all text-right ${
                              (selectedRoles[req.id] || 'employee') === opt.value
                                ? 'bg-violet-700/80 border-violet-500 text-white'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-violet-500/40'
                            }`}>{opt.label}</button>
                        ))}
                      </div>
                    </div>

                    {/* Approve/Reject buttons */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => void review(req.id, 'approve')}
                        disabled={isReviewing}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-emerald-700 py-2.5 text-sm font-black text-white hover:bg-emerald-600 disabled:opacity-50"
                      >
                        {isReviewing ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UserCheck className="h-4 w-4" />}
                        قبول وتفعيل
                      </button>
                      <button
                        onClick={() => void review(req.id, 'reject')}
                        disabled={isReviewing}
                        className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-red-800/70 py-2.5 text-sm font-black text-white hover:bg-red-700 disabled:opacity-50"
                      >
                        <UserX className="h-4 w-4" /> رفض
                      </button>
                    </div>

                    {/* Reject reason */}
                    <input
                      type="text"
                      placeholder="سبب الرفض (اختياري)"
                      value={rejectReasons[req.id] || ''}
                      onChange={e => setRejectReasons(prev => ({ ...prev, [req.id]: e.target.value }))}
                      className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
                    />
                  </div>
                )}

                {/* Review Info */}
                {req.status !== 'pending' && (
                  <div className="rounded-xl bg-slate-800/50 px-3 py-2 text-xs text-slate-400 flex items-center gap-2">
                    {req.status === 'approved' ? <CheckCircle className="h-3.5 w-3.5 text-emerald-400" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                    <span>تمت المراجعة بواسطة {req.reviewed_by || '—'} في {req.reviewed_at ? new Date(req.reviewed_at).toLocaleDateString('ar-SA') : '—'}</span>
                    {req.reject_reason && <span>— السبب: {req.reject_reason}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
