'use client';

import { useEffect, useState } from 'react';
import { PHASES, SECTIONS, Sec, DbStatus } from './data';
import { DepartmentCard, StatCard } from './components';

function getTenantHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'x-tenant-id': tenantId } : {};
}

// Map module paths to domain keys
const PATH_TO_DOMAIN: [RegExp, string][] = [
  [/^\/dashboard\/admin-gateway\/hr/, 'hr'],
  [/^\/dashboard\/admin-gateway\/finance/, 'finance'],
  [/^\/dashboard\/admin-gateway\/accounting/, 'accounting'],
  [/^\/dashboard\/admin-gateway\/revenue/, 'revenue'],
  [/^\/dashboard\/admin-gateway\/projects/, 'projects'],
  [/^\/dashboard\/admin-gateway\/assets/, 'assets'],
  [/^\/dashboard\/admin-gateway\/maintenance/, 'maintenance'],
  [/^\/dashboard\/maintenance/, 'maintenance'],
  [/^\/dashboard\/admin-gateway\/vehicles/, 'fleet'],
  [/^\/dashboard\/admin-gateway\/corrosion/, 'assets'],
  [/^\/dashboard\/admin-gateway\/procurement/, 'procurement'],
  [/^\/dashboard\/admin-gateway\/inventory/, 'inventory'],
  [/^\/dashboard\/admin-gateway\/correspondence/, 'admin'],
  [/^\/dashboard\/admin-gateway\/contracts/, 'contracts'],
  [/^\/dashboard\/admin-gateway\/workflow/, 'workflow'],
  [/^\/dashboard\/gis-sovereignty/, 'gis'],
  [/^\/dashboard\/command-center/, 'projects'],
  [/^\/dashboard\/admin-gateway$/, 'workspace'],
  [/^\/dashboard\/admin-gateway\/system/, 'workspace'],
  [/^\/dashboard\/admin-gateway\/my-dashboard/, 'workflow'],
  [/^\/dashboard\/admin-gateway\/platform-intelligence/, 'ai'],
  [/^\/dashboard\/admin-gateway\/intelligence/, 'ai'],
  [/^\/dashboard\/admin-gateway\/reports/, 'finance'],
  [/^\/dashboard\/admin-gateway\/notifications/, 'workspace'],
  [/^\/dashboard\/ai-assistant/, 'ai'],
  [/^\/dashboard\/system-explorer/, 'workspace'],
  [/^\/dashboard\/departments/, 'workspace'],
];

function getModDomain(path: string): string | null {
  for (const [regex, domain] of PATH_TO_DOMAIN) {
    if (regex.test(path)) return domain;
  }
  return null;
}

// Individual endpoint checks for domains not covered by health-stats
const DOMAIN_ENDPOINTS: Record<string, string> = {
  fleet: '/api/v1/fleet/vehicles',
  contracts: '/api/v1/contracts/list',
  workflow: '/api/v1/approval/requests',
  accounting: '/api/v1/accounting/journal-entries',
  revenue: '/api/v1/revenue/invoices',
  maintenance: '/api/v1/maintenance/assets',
};

async function checkEndpointStatus(url: string): Promise<DbStatus> {
  try {
    const tenantHeader = getTenantHeader();
    const res = await fetch(url, {
      headers: { ...tenantHeader, 'x-user-role': 'ADMIN' },
    });
    if (res.ok) return 'CONNECTED';
    if (res.status >= 500) return 'DISCONNECTED';
    return 'PARTIAL';
  } catch {
    return 'DISCONNECTED';
  }
}

export default function SystemExplorerPage() {
  const [liveStatus, setLiveStatus] = useState<Record<string, DbStatus>>({});
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const runChecks = async () => {
      setChecking(true);
      try {
        const statusMap: Record<string, DbStatus> = {};

        // 1. Fetch health-stats for main schemas
        const tenantHeader = getTenantHeader();
        const res = await fetch('/api/v1/system/health-stats', {
          headers: tenantHeader,
        });
        if (res.ok) {
          const data = await res.json();
          const summary = data.summary || {};
          const domainToKey: Record<string, string> = {
            hr: 'hr', finance: 'finance', admin: 'admin', gis: 'gis',
            projects: 'projects', inventory: 'inventory', procurement: 'procurement',
            workspace: 'workspace', assets: 'assets',
          };
          for (const [domain, key] of Object.entries(domainToKey)) {
            const s = summary[key];
            if (!s) { statusMap[domain] = 'DISCONNECTED'; continue; }
            statusMap[domain] = s.total_rows > 0 ? 'CONNECTED' : s.live_tables > 0 ? 'PARTIAL' : 'DISCONNECTED';
          }
          // AI backend is up if health-stats responded successfully
          statusMap['ai'] = 'CONNECTED';
        }

        // 2. Check remaining domains individually (in parallel)
        const extraDomains = Object.keys(DOMAIN_ENDPOINTS);
        const results = await Promise.all(
          extraDomains.map((domain) => checkEndpointStatus(DOMAIN_ENDPOINTS[domain]))
        );
        extraDomains.forEach((domain, i) => { statusMap[domain] = results[i]; });

        setLiveStatus(statusMap);
      } catch (err) {
        console.error('Health checks failed:', err);
      } finally {
        setChecking(false);
      }
    };

    runChecks();
    const interval = setInterval(runChecks, 60000);
    return () => clearInterval(interval);
  }, []);

  // Apply live status to sections (override static db field with live data)
  const liveSections: Sec[] = SECTIONS.map((sec) => ({
    ...sec,
    mods: sec.mods.map((mod) => {
      const domain = getModDomain(mod.path);
      const live = domain ? liveStatus[domain] : undefined;
      return live ? { ...mod, db: live } : mod;
    }),
  }));

  const allMods = liveSections.flatMap((s) => s.mods);
  const totalMods = allMods.length;
  const connectedMods = allMods.filter((m) => m.db === 'CONNECTED').length;
  const partialMods = allMods.filter((m) => m.db === 'PARTIAL').length;
  const completionPct = Math.round(((connectedMods + partialMods * 0.5) / totalMods) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2 flex-wrap">
          <h1 className="text-5xl font-bold text-white">🔍 مستكشف النظام</h1>
          {checking && (
            <span className="text-xs text-yellow-400 bg-yellow-900/20 border border-yellow-700/30 rounded-full px-3 py-1 animate-pulse">
              جاري التحقق من الاتصال...
            </span>
          )}
        </div>
        <p className="text-slate-400">جرد شامل لجميع إدارات ووحدات النظام · الحالة محدّثة من الـ API</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <StatCard title="إجمالي الوحدات" value={totalMods} icon="📦" color="border-blue-600/30 bg-blue-950/20" />
        <StatCard title="الوحدات المتصلة" value={connectedMods} icon="✅" color="border-emerald-600/30 bg-emerald-950/20" />
        <StatCard title="نسبة الإنجاز" value={`${completionPct}%`} icon="📊" color="border-cyan-600/30 bg-cyan-950/20" />
        <StatCard title="الأقسام" value={SECTIONS.length} icon="🏢" color="border-purple-600/30 bg-purple-950/20" />
      </div>

      {/* Phases */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-4">📋 مراحل التطوير</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {PHASES.map((phase) => (
            <div
              key={phase.id}
              className={`border rounded-lg p-3 ${
                phase.status === 'done'
                  ? 'border-emerald-600/30 bg-emerald-950/20'
                  : 'border-yellow-600/30 bg-yellow-950/20'
              }`}
            >
              <div className="flex items-start gap-2 mb-1">
                <span className="text-lg">{phase.status === 'done' ? '✅' : '⏳'}</span>
                <span className="font-semibold text-white text-sm">{phase.name}</span>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{phase.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-white">📁 الأقسام</h2>
        {liveSections.map((section) => (
          <DepartmentCard key={section.title} section={section} />
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 border-t border-slate-700/50 pt-8">
        <p className="text-center text-slate-500 text-sm">
          آخر تحديث: {new Date().toLocaleString('ar-SA', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>
    </div>
  );
}
