'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
const formatDate = (d: string) => new Date(d).toLocaleDateString('ar-LY', { day: '2-digit', month: 'short', year: 'numeric' });
import { 
  Wrench, AlertCircle, CheckCircle2, Clock, Plus, 
  ArrowRight, Zap, Calendar,
  ClipboardList, Settings, PackageOpen,
  BarChart2, Bot, MapPin, Activity,
} from 'lucide-react';
import DepartmentAssetInbox from '@/components/DepartmentAssetInbox';

const workLinks = [
  { href: '/dashboard/admin-gateway/maintenance/work-orders',  icon: ClipboardList, label: 'أوامر العمل',       desc: 'إنشاء وتتبع أوامر الصيانة',             color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
  { href: '/dashboard/admin-gateway/maintenance/preventive',   icon: Settings,      label: 'الصيانة الوقائية', desc: 'جداول الصيانة الدورية والوقائية',        color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
  { href: '/dashboard/admin-gateway/maintenance/wells',        icon: Zap,           label: 'الآبار',            desc: 'مراقبة وصيانة الآبار والضخ',            color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
];

interface Asset {
  id: number;
  name: string;
  asset_code: string;
  category: string;
  location: string;
  status: string;
  last_maintenance_date: string | null;
  next_maintenance_date: string | null;
}

interface MaintenanceRequest {
  id: string;
  asset_id: number;
  maintenance_type: string;
  priority: string;
  description: string;
  status: string;
  assigned_to: string | null;
  start_date: string | null;
  end_date: string | null;
}

interface Stats {
  total_assets: number;
  operational_assets: number;
  open_requests: number;
  completed_requests: number;
  completion_rate: number;
}

function getTenantHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

export default function OperationsSection() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterPriority, setFilterPriority] = useState<string>('');
  
  const [formData, setFormData] = useState({
    asset_id: '',
    maintenance_type: 'preventive',
    priority: 'medium',
    description: '',
    assigned_to: ''
  });

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const tenantHeader = getTenantHeader();
      
      const [assetsRes, requestsRes, statsRes] = await Promise.all([
        fetch('/api/v1/maintenance/assets', { headers: tenantHeader }),
        fetch(`/api/v1/maintenance/requests${filterStatus || filterPriority ? '?' + new URLSearchParams({
          ...(filterStatus && { status: filterStatus }),
          ...(filterPriority && { priority: filterPriority })
        }) : ''}`, { headers: tenantHeader }),
        fetch('/api/v1/maintenance/stats', { headers: tenantHeader })
      ]);

      if (assetsRes.ok) setAssets((await assetsRes.json()).assets || []);
      if (requestsRes.ok) setRequests((await requestsRes.json()).requests || []);
      if (statsRes.ok) setStats(await statsRes.json());
      
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.asset_id) { setError('اختر أصلاً'); return; }
    try {
      const params = new URLSearchParams({
        asset_id: formData.asset_id,
        maintenance_type: formData.maintenance_type,
        priority: formData.priority,
        description: formData.description,
        ...(formData.assigned_to && { assigned_to: formData.assigned_to })
      });
      const res = await fetch(`/api/v1/maintenance/requests?${params}`, {
        method: 'POST', headers: getTenantHeader()
      });
      if (res.ok) {
        setFormData({ asset_id: '', maintenance_type: 'preventive', priority: 'medium', description: '', assigned_to: '' });
        setShowCreateForm(false);
        await fetchData();
      } else {
        const errorData = await res.json();
        setError(errorData.detail || 'خطأ في إنشاء الطلب');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطأ في إنشاء الطلب');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'high': return 'bg-red-100 text-red-800 border-red-300';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'low': return 'bg-green-100 text-green-800 border-green-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return 'text-orange-600';
      case 'in-progress': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'open': return <AlertCircle className="w-4 h-4" />;
      case 'in-progress': return <Clock className="w-4 h-4" />;
      case 'completed': return <CheckCircle2 className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  const priorityLabel = { 'high': 'عالي', 'medium': 'متوسط', 'low': 'منخفض' };
  const typeLabel = { 'preventive': 'وقائية', 'corrective': 'إصلاحية', 'emergency': 'طارئة', 'routine': 'روتينية' };
  const statusLabel = { 'open': 'مفتوح', 'in-progress': 'جاري التنفيذ', 'completed': 'مكتمل' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6" dir="rtl">

      {/* Back link */}
      <Link href="/dashboard/maintenance" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors text-sm mb-6">
        <ArrowRight className="w-4 h-4" />
        إدارة الهندسة والدعم الفني
      </Link>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-orange-500/20 rounded-lg">
            <Wrench className="w-6 h-6 text-orange-500" />
          </div>
          <h1 className="text-3xl font-bold text-white">قسم العمليات الميدانية</h1>
        </div>
        <p className="text-slate-400 mr-11">Field Operations — أوامر العمل، الصيانة الوقائية، الآبار</p>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        {workLinks.map(({ href, icon: Icon, label, desc, color, bg, border }) => (
          <Link key={href} href={href}
            className={`group flex flex-col gap-2 p-3 rounded-xl border ${border} ${bg} hover:scale-[1.02] transition-transform`}>
            <div className={`w-8 h-8 rounded-lg bg-slate-900/60 border ${border} flex items-center justify-center`}>
              <Icon className={`w-3.5 h-3.5 ${color}`} />
            </div>
            <div>
              <p className={`font-semibold text-xs ${color}`}>{label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="h-px bg-slate-700/50 my-6" />
      <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">نشاط الصيانة الحالي</h2>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">{error}</div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          {[
            { label: 'إجمالي الأصول',   val: stats.total_assets,        color: 'text-white',       icon: <Zap className="w-5 h-5 text-blue-400" /> },
            { label: 'الأصول الفعالة',   val: stats.operational_assets,  color: 'text-green-400',   icon: <CheckCircle2 className="w-5 h-5 text-green-400" /> },
            { label: 'طلبات مفتوحة',    val: stats.open_requests,       color: 'text-orange-400',  icon: <AlertCircle className="w-5 h-5 text-orange-400" /> },
            { label: 'مكتملة',          val: stats.completed_requests,  color: 'text-blue-400',    icon: <CheckCircle2 className="w-5 h-5 text-blue-400" /> },
            { label: 'معدل الإنجاز',    val: `${stats.completion_rate}%`, color: 'text-cyan-400',  icon: <Activity className="w-5 h-5 text-cyan-400" /> },
          ].map(({ label, val, color, icon }) => (
            <div key={label} className="bg-slate-700/50 border border-slate-600 rounded-xl p-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-slate-400 text-sm mb-1">{label}</p>
                  <p className={`text-3xl font-bold ${color}`}>{val}</p>
                </div>
                {icon}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mb-8">
        <DepartmentAssetInbox department="maintenance" title="أصول إدارة الصيانة" compact />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Assets List */}
        <div className="lg:col-span-1">
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl p-6">
            <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <Zap className="w-5 h-5 text-blue-400" />
              الأصول
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="text-slate-400 text-center py-8">جاري التحميل...</div>
              ) : assets.length === 0 ? (
                <div className="text-slate-400 text-center py-8">لا توجد أصول</div>
              ) : (
                assets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => setSelectedAsset(asset.id)}
                    className={`w-full text-right p-3 rounded-lg border transition ${
                      selectedAsset === asset.id
                        ? 'bg-blue-500/20 border-blue-400'
                        : 'bg-slate-600/30 border-slate-500 hover:bg-slate-600/50'
                    }`}
                  >
                    <p className="font-semibold text-white text-sm">{asset.name}</p>
                    <p className="text-xs text-slate-400 mt-1">{asset.asset_code}</p>
                    <p className="text-xs text-slate-500">{asset.location}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition"
          >
            <Plus className="w-5 h-5" />
            طلب صيانة جديد
          </button>

          {showCreateForm && (
            <form onSubmit={handleCreateRequest} className="bg-slate-700/50 border border-slate-600 rounded-xl p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-white mb-2">الأصل</label>
                <select
                  value={formData.asset_id}
                  onChange={(e) => setFormData({ ...formData, asset_id: e.target.value })}
                  className="w-full bg-slate-600 text-white rounded-lg p-2 border border-slate-500 focus:border-blue-400 focus:outline-none"
                >
                  <option value="">اختر أصلاً</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>{asset.name} ({asset.asset_code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">نوع الصيانة</label>
                  <select value={formData.maintenance_type}
                    onChange={(e) => setFormData({ ...formData, maintenance_type: e.target.value })}
                    className="w-full bg-slate-600 text-white rounded-lg p-2 border border-slate-500 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="preventive">وقائية</option>
                    <option value="corrective">إصلاحية</option>
                    <option value="emergency">طارئة</option>
                    <option value="routine">روتينية</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-white mb-2">الأولوية</label>
                  <select value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                    className="w-full bg-slate-600 text-white rounded-lg p-2 border border-slate-500 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="high">عالي</option>
                    <option value="medium">متوسط</option>
                    <option value="low">منخفض</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-white mb-2">الوصف</label>
                <textarea value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="اكتب تفاصيل الصيانة..."
                  rows={3}
                  className="w-full bg-slate-600 text-white rounded-lg p-2 border border-slate-500 focus:border-blue-400 focus:outline-none resize-none"
                />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition">إنشاء الطلب</button>
                <button type="button" onClick={() => setShowCreateForm(false)} className="flex-1 bg-slate-600 hover:bg-slate-500 text-white font-semibold py-2 px-4 rounded-lg transition">إلغاء</button>
              </div>
            </form>
          )}

          {/* Filters */}
          <div className="flex gap-3">
            <select value={filterStatus}
              onChange={(e) => { setFilterStatus(e.target.value); fetchData(); }}
              className="flex-1 bg-slate-600 text-white rounded-lg p-2 border border-slate-500 text-sm"
            >
              <option value="">جميع الحالات</option>
              <option value="open">مفتوح</option>
              <option value="in-progress">جاري التنفيذ</option>
              <option value="completed">مكتمل</option>
            </select>
            <select value={filterPriority}
              onChange={(e) => { setFilterPriority(e.target.value); fetchData(); }}
              className="flex-1 bg-slate-600 text-white rounded-lg p-2 border border-slate-500 text-sm"
            >
              <option value="">جميع الأولويات</option>
              <option value="high">عالي</option>
              <option value="medium">متوسط</option>
              <option value="low">منخفض</option>
            </select>
          </div>

          {/* Requests List */}
          <div className="bg-slate-700/50 border border-slate-600 rounded-xl overflow-hidden">
            <div className="p-6 border-b border-slate-600">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Wrench className="w-5 h-5 text-orange-400" />
                طلبات الصيانة ({requests.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-600 max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-8 text-slate-400 text-center">جاري التحميل...</div>
              ) : requests.length === 0 ? (
                <div className="p-8 text-slate-400 text-center">لا توجد طلبات</div>
              ) : (
                requests.map((request) => {
                  const asset = assets.find(a => a.id === request.asset_id);
                  return (
                    <div key={request.id} className="p-4 hover:bg-slate-600/20 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <p className="font-semibold text-white flex items-center gap-2">
                            {asset?.name || `أصل #${request.asset_id}`}
                          </p>
                          <p className="text-xs text-slate-400 mt-1">{request.description}</p>
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className={`text-xs px-2 py-1 rounded border ${getPriorityColor(request.priority)}`}>
                              {priorityLabel[request.priority as keyof typeof priorityLabel] || request.priority}
                            </span>
                            <span className="text-xs px-2 py-1 rounded border bg-slate-600 text-slate-300">
                              {typeLabel[request.maintenance_type as keyof typeof typeLabel] || request.maintenance_type}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <div className={`flex items-center gap-1 ${getStatusColor(request.status)}`}>
                            {getStatusIcon(request.status)}
                            <span className="text-xs font-semibold">
                              {statusLabel[request.status as keyof typeof statusLabel] || request.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      {request.start_date && (
                        <div className="mt-2 text-xs text-slate-400">
                          <Calendar className="w-3 h-3 inline mr-1" />
                          {formatDate(request.start_date)}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
