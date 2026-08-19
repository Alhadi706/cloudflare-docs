'use client';

import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';

interface Props {
  appId: string;
  /** For sections: the parent department scope (e.g. 'maintenance').
   *  When appId has no direct file, the parent scope files are used instead. */
  parentScopeId?: string;
  accentBorder: string;
  accentText: string;
}

type AppFile = { linux: string | null; windows: string | null; linuxSize: string; winSize: string };
type ScopeId = 'corrosion' | 'maintenance' | 'admin-affairs' | 'finance' | 'materials' | 'services' | 'remote-sensing';
type DashboardInfo = { name: string; url: string; scope: ScopeId };

// ── خريطة اختصارات الداشبورد لكل إدارة/قسم ──────────────────────────────────
const APP_DASHBOARD: Record<string, DashboardInfo> = {
  'corrosion':      { name: 'إدارة التآكل',              url: '/dashboard/admin-gateway/corrosion', scope: 'corrosion' },
  'maintenance':    { name: 'إدارة الهندسة والدعم الفني', url: '/dashboard/admin-gateway/maintenance', scope: 'maintenance' },
  'admin-affairs':  { name: 'إدارة الموارد البشرية',      url: '/dashboard/hr-center', scope: 'admin-affairs' },
  'finance':        { name: 'إدارة المالية',              url: '/dashboard/admin-gateway/finance', scope: 'finance' },
  'materials':      { name: 'إدارة المواد والأصول',        url: '/dashboard/admin-gateway/materials', scope: 'materials' },
  'services':       { name: 'إدارة الذكاء والخدمات',      url: '/dashboard/intelligence', scope: 'services' },
  'remote-sensing': { name: 'مركز الاستشعار عن بعد',      url: '/dashboard/gis-sovereignty/remote-sensing-center', scope: 'remote-sensing' },

  // Maintenance sections
  'section-maintenance-planning':   { name: 'قسم تخطيط الصيانة',   url: '/dashboard/admin-gateway/maintenance/planning', scope: 'maintenance' },
  'section-maintenance-wells':      { name: 'قسم مراقبة الآبار',    url: '/dashboard/admin-gateway/maintenance/wells', scope: 'maintenance' },
  'section-maintenance-support':    { name: 'قسم الدعم الفني',      url: '/dashboard/admin-gateway/maintenance/technical', scope: 'maintenance' },
  'section-maintenance-operations': { name: 'قسم مراقبة التشغيل',   url: '/dashboard/maintenance/operations', scope: 'maintenance' },

  // Corrosion sections
  'section-corrosion-monitoring':   { name: 'قسم المراقبة الدورية',  url: '/dashboard/admin-gateway/corrosion/monitoring', scope: 'corrosion' },
  'section-corrosion-support':      { name: 'قسم الدعم الفني (تآكل)', url: '/dashboard/admin-gateway/corrosion/support', scope: 'corrosion' },
  'section-corrosion-coating':      { name: 'قسم المكونات الهندسية', url: '/dashboard/admin-gateway/corrosion/coating', scope: 'corrosion' },

  // Finance sections
  'section-finance-budgets':        { name: 'قسم الميزانيات',       url: '/dashboard/admin-gateway/finance/budgets', scope: 'finance' },
  'section-finance-expenses':       { name: 'قسم النفقات',          url: '/dashboard/admin-gateway/finance/expenses', scope: 'finance' },
  'section-finance-accounting':     { name: 'قسم المحاسبة',         url: '/dashboard/admin-gateway/accounting', scope: 'finance' },
  'section-finance-reports':        { name: 'قسم التقارير المالية',  url: '/dashboard/admin-gateway/finance/reports', scope: 'finance' },
  'section-finance-payroll':        { name: 'قسم الرواتب والأجور',   url: '/dashboard/admin-gateway/finance/payroll', scope: 'finance' },

  // HR / admin-affairs sections (supports both old and current IDs)
  'section-admin-hr':                     { name: 'قسم شؤون المستخدمين',  url: '/dashboard/hr-center/personnel', scope: 'admin-affairs' },
  'section-admin-training':               { name: 'قسم التدريب',           url: '/dashboard/hr-center/training', scope: 'admin-affairs' },
  'section-admin-data-stats':             { name: 'قسم البيانات والإحصاء',  url: '/dashboard/hr-center/data', scope: 'admin-affairs' },
  'section-admin-systems-staffing':       { name: 'قسم النظم والملاكات',    url: '/dashboard/hr-center/staffing', scope: 'admin-affairs' },
  'section-admin-medical-affairs':        { name: 'قسم الشؤون الطبية',      url: '/dashboard/hr-center/medical', scope: 'admin-affairs' },
  'section-admin-affairs-hr':             { name: 'قسم شؤون المستخدمين',   url: '/dashboard/hr-center/personnel', scope: 'admin-affairs' },
  'section-admin-affairs-correspondence': { name: 'قسم المراسلات',         url: '/dashboard/admin-gateway/correspondence', scope: 'admin-affairs' },
  'section-admin-affairs-contracts':      { name: 'قسم العقود',            url: '/dashboard/admin-gateway/contracts', scope: 'admin-affairs' },
  'section-admin-affairs-workflow':       { name: 'قسم سير العمل',          url: '/dashboard/admin-gateway/workflow', scope: 'admin-affairs' },

  // Materials sections
  'section-materials-assets':      { name: 'قسم سجل الأصول',     url: '/dashboard/admin-gateway/assets/registry', scope: 'materials' },
  'section-materials-inventory':   { name: 'قسم المخزون',         url: '/dashboard/admin-gateway/materials/inventory', scope: 'materials' },
  'section-materials-fleet':       { name: 'قسم الأسطول',         url: '/dashboard/admin-gateway/fleet', scope: 'materials' },
  'section-materials-procurement': { name: 'قسم المشتريات',       url: '/dashboard/admin-gateway/materials/procurement', scope: 'materials' },

  // Services sections
  'section-services-intelligence': { name: 'قسم الاستخبارات',     url: '/dashboard/intelligence', scope: 'services' },
  'section-services-projects':     { name: 'قسم متابعة المشاريع',  url: '/dashboard/projects-control', scope: 'services' },
  'section-services-analytics':    { name: 'قسم التحليلات',       url: '/dashboard/spatial-analytics', scope: 'services' },

  // Remote sensing sections
  'section-rs-remote-sensing':   { name: 'قسم الاستشعار',          url: '/dashboard/gis-sovereignty/remote-sensing-center', scope: 'remote-sensing' },
  'section-rs-spatial':          { name: 'قسم التحليل المكاني',    url: '/dashboard/gis-sovereignty/spatial-analytics', scope: 'remote-sensing' },
  'section-rs-satellite-intel':  { name: 'قسم الاستخبارات الفضائية', url: '/dashboard/gis-sovereignty/satellite-intelligence-center', scope: 'remote-sensing' },
  'section-rs-engineering':      { name: 'قسم مساحة العمل الهندسية', url: '/dashboard/gis-sovereignty/engineering-workspace', scope: 'remote-sensing' },
};

function resolveScope(appId: string, parentScopeId?: string): ScopeId {
  const fromMap = APP_DASHBOARD[appId]?.scope;
  if (fromMap) return fromMap;

  const candidate = parentScopeId || appId;
  if (candidate === 'corrosion') return 'corrosion';
  if (candidate === 'maintenance') return 'maintenance';
  if (candidate === 'admin-affairs') return 'admin-affairs';
  if (candidate === 'finance') return 'finance';
  if (candidate === 'materials') return 'materials';
  if (candidate === 'services') return 'services';
  return 'remote-sensing';
}

function buildLaunchUrl(appId: string, dashPath: string, scope: ScopeId): string {
  const origin = window.location.origin;
  const launch = new URL('/entry', origin);
  launch.searchParams.set('auto', '1');
  launch.searchParams.set('app', appId);
  launch.searchParams.set('scope', scope);
  launch.searchParams.set('redirect', dashPath);
  return launch.toString();
}

// ── توليد ملف الاختصار وتنزيله ───────────────────────────────────────────────
const APP_VERSION = '0.1.0';
const APP_FILES: Record<string, AppFile> = {
  // Keep compatibility with legacy prebuilt Flutter package for now.
  'legacy-flutter-linux': { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '—' },
};

const EMPTY_FILE: AppFile = { linux: null, windows: null, linuxSize: '—', winSize: '—' };

function toSafeId(raw: string): string {
  return String(raw).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
}

function nativeFilesFor(appId: string): AppFile {
  const safe = toSafeId(appId);
  return {
    linux: `${safe}-${APP_VERSION}-x86_64.AppImage`,
    windows: `${safe}-${APP_VERSION}-setup.exe`,
    linuxSize: '≈140 MB',
    winSize: '≈120 MB',
  };
}

/** Resolve which file record to use for a given appId.
 *  Sections fall back to their parent department scope. */
function resolveFiles(appId: string, parentScopeId?: string): AppFile {
  // 1. Direct match (departments or explicitly registered section IDs)
  if (APP_FILES[appId]) return APP_FILES[appId];
  // 2. Use parent scope if provided (for section cards)
  if (parentScopeId && APP_FILES[parentScopeId]) return APP_FILES[parentScopeId];
  // 3. Try to extract scope from section ID pattern: "section-{scope}-{...}" or contains scope keyword
  const SCOPES: [string, string][] = [
    ['maintenance', 'maintenance'], ['maint', 'maintenance'],
    ['corrosion', 'corrosion'],     ['corr', 'corrosion'],
    ['admin-affairs', 'admin-affairs'], ['admin', 'admin-affairs'],
    ['finance', 'finance'],         ['fin', 'finance'],
    ['materials', 'materials'],     ['material', 'materials'],
    ['services', 'services'],
    ['remote-sensing', 'remote-sensing'], ['rs', 'remote-sensing'],
  ];
  for (const [keyword, scope] of SCOPES) {
    if (appId === keyword || appId.startsWith(`${keyword}-`) || appId.includes(`-${keyword}-`) || appId.endsWith(`-${keyword}`)) {
      return APP_FILES[scope] ?? nativeFilesFor(appId);
    }
  }
  // 4. Any app present in dashboard map gets a native package name.
  if (APP_DASHBOARD[appId]) return nativeFilesFor(appId);
  return EMPTY_FILE;
}

export default function DownloadButtons({ appId, parentScopeId, accentBorder, accentText }: Props) {
  const [os, setOs] = useState<'linux' | 'windows' | 'unknown'>('unknown');

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setOs('windows');
    else if (ua.includes('linux') || ua.includes('x11')) setOs('linux');
    else setOs('unknown');
  }, []);

  const files = resolveFiles(appId, parentScopeId);
  const isLinux   = os === 'linux' || os === 'unknown';
  const isWindows = os === 'windows';

  // Resolve dashboard info (fall back to parent scope)
  const dashInfo = APP_DASHBOARD[appId]
    ?? (parentScopeId ? APP_DASHBOARD[parentScopeId] : undefined);

  const PendingUpload = ({ label }: { label: string }) => (
    <div className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-700/40 bg-slate-800/20 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none">
      <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/40 rounded-full px-2 py-0.5 font-bold">قيد الرفع</span>
      {label}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* زر Linux */}
      {files.linux ? (
        <a
          href={`/downloads/${files.linux}`}
          download
          className={`
            flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm font-semibold transition-all group relative
            ${isLinux
              ? `${accentBorder} bg-white/10 hover:bg-white/18 ${accentText} ring-1 ring-inset ring-white/10`
              : `${accentBorder} bg-white/4 hover:bg-white/10 ${accentText} opacity-60 hover:opacity-100`
            }
          `}
        >
          <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
          🐧 تنزيل للـ Linux
          {isLinux && (
            <span className="absolute top-1 left-1 text-[9px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-bold">
              لنظامك
            </span>
          )}
          <span className="text-[10px] opacity-60 mr-auto">{files.linuxSize}</span>
        </a>
      ) : (
        <PendingUpload label="🐧 Linux Flutter" />
      )}

      {/* زر Windows */}
      {files.windows ? (
        <a
          href={`/downloads/${files.windows}`}
          download
          className={`
            flex items-center justify-center gap-2 w-full rounded-xl border py-2.5 text-sm font-semibold transition-all group relative
            ${isWindows
              ? 'border-sky-500/40 bg-sky-950/30 hover:bg-sky-950/50 text-sky-300 ring-1 ring-inset ring-sky-500/20'
              : 'border-sky-500/20 bg-sky-950/10 hover:bg-sky-950/30 text-sky-400 opacity-60 hover:opacity-100'
            }
          `}
        >
          <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
          🪟 تنزيل للـ Windows
          {isWindows && (
            <span className="absolute top-1 left-1 text-[9px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-bold">
              لنظامك
            </span>
          )}
          <span className="text-[10px] opacity-60 mr-auto">{files.winSize}</span>
        </a>
      ) : (
        <PendingUpload label="🪟 Windows Flutter" />
      )}

      {dashInfo && (
        <div className="text-[10px] text-slate-500 px-1">
          يتم فتح التطبيق كمنصة مستقلة عند تثبيت ملف البرنامج (AppImage/Installer).
        </div>
      )}
    </div>
  );
}
