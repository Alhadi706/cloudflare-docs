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

// خريطة كل إدارة/قسم → ملف التنزيل المخصص له
// ⚠️ TEMP: استخدام NSIS installers حتى اكتمال بناء Windows Flutter
// سيتم تحديث إلى Flutter binary عند الانتهاء من GitHub Actions build
const APP_FILES: Record<string, AppFile> = {
  // ── الإدارات الرئيسية ──────────────────────────────────────────────────────
  'maintenance':    { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'corrosion':      { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'admin-affairs':  { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'finance':        { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'materials':      { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'services':       { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },
  'remote-sensing': { linux: null, windows: 'dsf_gateway_flutter-windows-x64.zip', linuxSize: '—', winSize: '38 MB' },

  // ── أقسام الشؤون الإدارية ──────────────────────────────────────────────────
  'section-admin-affairs-hr':             { linux: null, windows: 'DSF-AdminHR_0.1.0_x64-setup.exe',             linuxSize: '—', winSize: '2.8 MB' },
  'section-admin-affairs-correspondence': { linux: null, windows: 'DSF-AdminCorrespondence_0.1.0_x64-setup.exe', linuxSize: '—', winSize: '2.8 MB' },
  'section-admin-affairs-contracts':      { linux: null, windows: 'DSF-AdminContracts_0.1.0_x64-setup.exe',      linuxSize: '—', winSize: '2.8 MB' },
  'section-admin-affairs-workflow':       { linux: null, windows: 'DSF-AdminWorkflow_0.1.0_x64-setup.exe',       linuxSize: '—', winSize: '2.8 MB' },

  // ── أقسام الصيانة ──────────────────────────────────────────────────────────
  'section-maintenance-planning':    { linux: null, windows: 'DSF-MaintPlanning_0.1.0_x64-setup.exe',    linuxSize: '—', winSize: '2.8 MB' },
  'section-maintenance-wells':       { linux: null, windows: null,                                        linuxSize: '—', winSize: '—' },
  'section-maintenance-support':     { linux: null, windows: 'DSF-Maintenance_0.1.0_x64-setup.exe',      linuxSize: '—', winSize: '2.8 MB' },
  'section-maintenance-operations':  { linux: null, windows: 'DSF-MaintOperations_0.1.0_x64-setup.exe',  linuxSize: '—', winSize: '2.8 MB' },

  // ── أقسام التآكل — قيد البناء ─────────────────────────────────────────────
  'section-corrosion-monitoring': { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-corrosion-support':    { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-corrosion-coating':    { linux: null, windows: null, linuxSize: '—', winSize: '—' },

  // ── أقسام المالية — قيد البناء ────────────────────────────────────────────
  'section-finance-budgets':     { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-finance-expenses':    { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-finance-accounting':  { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-finance-reports':     { linux: null, windows: null, linuxSize: '—', winSize: '—' },

  // ── أقسام المواد — قيد البناء ─────────────────────────────────────────────
  'section-materials-assets':      { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-materials-inventory':   { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-materials-fleet':       { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-materials-procurement': { linux: null, windows: null, linuxSize: '—', winSize: '—' },

  // ── أقسام الخدمات — قيد البناء ────────────────────────────────────────────
  'section-services-intelligence': { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-services-projects':     { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-services-analytics':    { linux: null, windows: null, linuxSize: '—', winSize: '—' },

  // ── أقسام الاستشعار — قيد البناء ──────────────────────────────────────────
  'section-rs-remote-sensing':    { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-rs-spatial':           { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-rs-satellite-intel':   { linux: null, windows: null, linuxSize: '—', winSize: '—' },
  'section-rs-engineering':       { linux: null, windows: null, linuxSize: '—', winSize: '—' },
};

const EMPTY_FILE: AppFile = { linux: null, windows: null, linuxSize: '—', winSize: '—' };

/** Resolve which file record to use for a given appId.
 *  Sections fall back to their parent department scope. */
function resolveFiles(appId: string, parentScopeId?: string): AppFile {
  // 1. Use parent scope first (for section cards) to keep one package per scope.
  if (parentScopeId && APP_FILES[parentScopeId]) return APP_FILES[parentScopeId];
  // 2. Direct match (departments or explicitly registered section IDs)
  if (APP_FILES[appId]) return APP_FILES[appId];
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
  const windowsFlutterReady = process.env.NEXT_PUBLIC_WINDOWS_FLUTTER_READY === '1';

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('win')) setOs('windows');
    else if (ua.includes('linux') || ua.includes('x11')) setOs('linux');
    else setOs('unknown');
  }, []);

  const files = resolveFiles(appId, parentScopeId);
  const isLinux   = os === 'linux' || os === 'unknown';
  const isWindows = os === 'windows';

  const ComingSoon = ({ label }: { label: string }) => (
    <div className="flex items-center justify-center gap-2 w-full rounded-xl border border-slate-700/40 bg-slate-800/20 py-2.5 text-sm text-slate-500 cursor-not-allowed select-none">
      <span className="text-[10px] bg-slate-700/50 text-slate-400 border border-slate-600/40 rounded-full px-2 py-0.5 font-bold">قريباً</span>
      {label}
    </div>
  );

  return (
    <div className="space-y-2">
      {/* زر Linux */}
      {files.linux ? (
        <a
          href={`/downloads/${files.linux}?app=${encodeURIComponent(appId)}${parentScopeId ? `&scope=${encodeURIComponent(parentScopeId)}` : ''}`}
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
        <ComingSoon label="🐧 Linux — قيد الإعداد" />
      )}

      {/* زر Windows */}
      {windowsFlutterReady && files.windows ? (
        <a
          href={`/downloads/${files.windows}?app=${encodeURIComponent(appId)}${parentScopeId ? `&scope=${encodeURIComponent(parentScopeId)}` : ''}`}
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
          🪟 تنزيل Flutter للـ Windows
          {isWindows && (
            <span className="absolute top-1 left-1 text-[9px] bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 rounded-full px-1.5 py-0.5 font-bold">
              لنظامك
            </span>
          )}
          <span className="text-[10px] opacity-60 mr-auto">{files.winSize}</span>
        </a>
      ) : (
        <ComingSoon label="🪟 Windows Flutter — قيد الرفع حالياً" />
      )}
    </div>
  );
}
