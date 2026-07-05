'use client';

import { useState, useEffect } from 'react';
import { Download, MonitorSmartphone } from 'lucide-react';

interface Props {
  appId: string;
  /** For sections: the parent department scope (e.g. 'maintenance').
   *  When appId has no direct file, the parent scope files are used instead. */
  parentScopeId?: string;
  accentBorder: string;
  accentText: string;
}

type AppFile = { linux: string | null; windows: string | null; linuxSize: string; winSize: string };

// ── خريطة اختصارات الداشبورد لكل إدارة/قسم ──────────────────────────────────
const APP_DASHBOARD: Record<string, { name: string; url: string }> = {
  'corrosion':      { name: 'إدارة التآكل',               url: '/dashboard/admin-gateway/corrosion' },
  'maintenance':    { name: 'إدارة الهندسة والدعم الفني',  url: '/dashboard/admin-gateway/maintenance' },
  'admin-affairs':  { name: 'إدارة الموارد البشرية',       url: '/dashboard/hr-center' },
  'finance':        { name: 'إدارة المالية',               url: '/dashboard/admin-gateway/finance' },
  'materials':      { name: 'إدارة المواد والأصول',         url: '/dashboard/admin-gateway/materials' },
  'services':       { name: 'إدارة الذكاء والخدمات',       url: '/dashboard/admin-gateway/services' },
  'remote-sensing': { name: 'مركز الاستشعار عن بعد',       url: '/dashboard/admin-gateway/gis' },
  'section-maintenance-planning':   { name: 'قسم تخطيط الصيانة',    url: '/dashboard/admin-gateway/maintenance/planning' },
  'section-maintenance-wells':      { name: 'قسم مراقبة الآبار',     url: '/dashboard/admin-gateway/maintenance/wells' },
  'section-maintenance-support':    { name: 'قسم الدعم الفني',       url: '/dashboard/admin-gateway/maintenance/support' },
  'section-maintenance-operations': { name: 'قسم مراقبة التشغيل',    url: '/dashboard/admin-gateway/maintenance/operations' },
  'section-corrosion-monitoring':   { name: 'قسم المراقبة الدورية',  url: '/dashboard/admin-gateway/corrosion/monitoring' },
  'section-corrosion-support':      { name: 'قسم الدعم الفني (تآكل)', url: '/dashboard/admin-gateway/corrosion/support' },
  'section-corrosion-coating':      { name: 'قسم المكونات الهندسية', url: '/dashboard/admin-gateway/corrosion/coating' },
  'section-finance-budgets':        { name: 'قسم الميزانيات',        url: '/dashboard/admin-gateway/finance/budgets' },
  'section-finance-expenses':       { name: 'قسم النفقات',           url: '/dashboard/admin-gateway/finance/expenses' },
  'section-finance-accounting':     { name: 'قسم المحاسبة',          url: '/dashboard/admin-gateway/finance/accounting' },
  'section-finance-reports':        { name: 'قسم التقارير المالية',   url: '/dashboard/admin-gateway/finance/reports' },
  'section-admin-affairs-hr':             { name: 'قسم شؤون المستخدمين', url: '/dashboard/hr-center' },
  'section-admin-affairs-correspondence': { name: 'قسم المراسلات',        url: '/dashboard/hr-center/correspondence' },
  'section-admin-affairs-contracts':      { name: 'قسم العقود',           url: '/dashboard/hr-center/contracts' },
  'section-admin-affairs-workflow':       { name: 'قسم سير العمل',         url: '/dashboard/hr-center/workflow' },
  'section-materials-assets':      { name: 'قسم سجل الأصول',     url: '/dashboard/admin-gateway/materials/assets' },
  'section-materials-inventory':   { name: 'قسم المخزون',         url: '/dashboard/admin-gateway/materials/inventory' },
  'section-materials-fleet':       { name: 'قسم الأسطول',         url: '/dashboard/admin-gateway/materials/fleet' },
  'section-materials-procurement': { name: 'قسم المشتريات',       url: '/dashboard/admin-gateway/materials/procurement' },
  'section-services-intelligence': { name: 'قسم الاستخبارات',     url: '/dashboard/admin-gateway/services/intelligence' },
  'section-services-projects':     { name: 'قسم متابعة المشاريع', url: '/dashboard/admin-gateway/services/projects' },
  'section-services-analytics':    { name: 'قسم التحليلات',       url: '/dashboard/admin-gateway/services/analytics' },
  'section-rs-remote-sensing':     { name: 'قسم الاستشعار',       url: '/dashboard/admin-gateway/gis/remote-sensing' },
  'section-rs-spatial':            { name: 'قسم التحليل المكاني', url: '/dashboard/admin-gateway/gis/spatial' },
  'section-rs-satellite-intel':    { name: 'قسم الاستخبارات الفضائية', url: '/dashboard/admin-gateway/gis/satellite' },
  'section-rs-engineering':        { name: 'قسم مساحة العمل الهندسية', url: '/dashboard/admin-gateway/gis/engineering' },
};

// ── توليد ملف الاختصار وتنزيله ───────────────────────────────────────────────
function downloadShortcut(displayName: string, dashPath: string, os: 'linux' | 'windows' | 'unknown') {
  const origin = window.location.origin;
  const fullUrl = `${origin}${dashPath}`;
  const safeName = displayName.replace(/\s+/g, '-');

  let content: string;
  let filename: string;
  let mimeType: string;

  if (os === 'windows') {
    // Internet Shortcut (.url) for Windows
    content = `[InternetShortcut]\r\nURL=${fullUrl}\r\nIconIndex=0\r\n`;
    filename = `DSF-${safeName}.url`;
    mimeType = 'text/plain';
  } else {
    // XDG Desktop Entry (.desktop) for Linux
    content = [
      '[Desktop Entry]',
      `Name=${displayName}`,
      `Name[ar]=${displayName}`,
      `GenericName=DSF Gateway`,
      `Comment=نظام إدارة البنية التحتية — ${displayName}`,
      `Exec=xdg-open ${fullUrl}`,
      `Icon=web-browser`,
      `Type=Application`,
      `Terminal=false`,
      `StartupNotify=true`,
      `Categories=Network;WebBrowser;`,
    ].join('\n') + '\n';
    filename = `dsf-${safeName}.desktop`;
    mimeType = 'application/x-desktop';
  }

  const blob = new Blob([content], { type: mimeType });
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(href);
}

// خريطة كل إدارة/قسم → ملف التنزيل المخصص له
// null = لم يُبنَ بعد → يظهر "قيد الرفع"
const APP_FILES: Record<string, AppFile> = {
  // ── الإدارات الرئيسية ──────────────────────────────────────────────────────
  'maintenance':    { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'corrosion':      { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'admin-affairs':  { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'finance':        { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'materials':      { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'services':       { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },
  'remote-sensing': { linux: 'dsf_gateway_flutter-linux-x64.tar.gz', windows: null, linuxSize: '9.7 MB', winSize: '2.8 MB' },

  // ── أقسام الشؤون الإدارية ──────────────────────────────────────────────────
  'section-admin-affairs-hr':             { linux: null, windows: 'DSF-AdminHR_0.1.0_x64-setup.exe',             linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-admin-affairs-correspondence': { linux: null, windows: 'DSF-AdminCorrespondence_0.1.0_x64-setup.exe', linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-admin-affairs-contracts':      { linux: null, windows: 'DSF-AdminContracts_0.1.0_x64-setup.exe',      linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-admin-affairs-workflow':       { linux: null, windows: 'DSF-AdminWorkflow_0.1.0_x64-setup.exe',       linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام الصيانة ──────────────────────────────────────────────────────────
  'section-maintenance-planning':    { linux: null, windows: 'DSF-MaintPlanning_0.1.0_x64-setup.exe',    linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-maintenance-wells':       { linux: null, windows: 'DSF-MaintWells_0.1.0_x64-setup.exe',       linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-maintenance-support':     { linux: null, windows: 'DSF-Maintenance_0.1.0_x64-setup.exe',      linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-maintenance-operations':  { linux: null, windows: 'DSF-MaintOperations_0.1.0_x64-setup.exe',  linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام التآكل — قيد البناء ─────────────────────────────────────────────
  'section-corrosion-monitoring': { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-corrosion-support':    { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-corrosion-coating':    { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام المالية — قيد البناء ────────────────────────────────────────────
  'section-finance-budgets':     { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-finance-expenses':    { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-finance-accounting':  { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-finance-reports':     { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام المواد — قيد البناء ─────────────────────────────────────────────
  'section-materials-assets':      { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-materials-inventory':   { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-materials-fleet':       { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-materials-procurement': { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام الخدمات — قيد البناء ────────────────────────────────────────────
  'section-services-intelligence': { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-services-projects':     { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-services-analytics':    { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },

  // ── أقسام الاستشعار — قيد البناء ──────────────────────────────────────────
  'section-rs-remote-sensing':    { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-rs-spatial':           { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-rs-satellite-intel':   { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
  'section-rs-engineering':       { linux: null, windows: null, linuxSize: '77 MB', winSize: '2.8 MB' },
};

const EMPTY_FILE: AppFile = { linux: null, windows: null, linuxSize: '—', winSize: '—' };

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
      return APP_FILES[scope] ?? EMPTY_FILE;
    }
  }
  return EMPTY_FILE;
}

export default function DownloadButtons({ appId, parentScopeId, accentBorder, accentText }: Props) {
  const [os, setOs] = useState<'linux' | 'windows' | 'unknown'>('unknown');
  const [shortcutDone, setShortcutDone] = useState(false);

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

  const handleShortcut = () => {
    if (!dashInfo) return;
    downloadShortcut(dashInfo.name, dashInfo.url, os);
    setShortcutDone(true);
    setTimeout(() => setShortcutDone(false), 3000);
  };

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

      {/* زر اختصار سطح المكتب */}
      {dashInfo && (
        <button
          onClick={handleShortcut}
          className={`
            flex items-center justify-center gap-2 w-full rounded-xl border py-2 text-xs font-medium transition-all
            ${shortcutDone
              ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300'
              : 'border-slate-600/40 bg-slate-800/30 hover:bg-slate-700/30 text-slate-400 hover:text-slate-200 hover:border-slate-500/50'
            }
          `}
          title="تنزيل ملف اختصار يفتح الداشبورد مباشرةً على سطح المكتب"
        >
          <MonitorSmartphone className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{shortcutDone ? '✓ تم تنزيل الاختصار' : '📌 اختصار سطح المكتب'}</span>
          <span className="text-[9px] opacity-50 mr-auto">
            {os === 'windows' ? '.url' : '.desktop'}
          </span>
        </button>
      )}
    </div>
  );
}
