#!/usr/bin/env node
import builder from 'electron-builder';

const { build, Platform, Arch } = builder;

const APPS = {
  'maintenance': { name: 'DSF - إدارة الهندسة والدعم الفني', scope: 'maintenance', redirect: '/dashboard/admin-gateway/maintenance' },
  'corrosion': { name: 'DSF - إدارة التآكل', scope: 'corrosion', redirect: '/dashboard/admin-gateway/corrosion' },
  'admin-affairs': { name: 'DSF - إدارة الموارد البشرية', scope: 'admin-affairs', redirect: '/dashboard/hr-center' },
  'finance': { name: 'DSF - الإدارة المالية', scope: 'finance', redirect: '/dashboard/admin-gateway/finance' },
  'materials': { name: 'DSF - إدارة المواد', scope: 'materials', redirect: '/dashboard/admin-gateway/materials' },
  'services': { name: 'DSF - الذكاء والخدمات', scope: 'services', redirect: '/dashboard/intelligence' },
  'remote-sensing': { name: 'DSF - مركز الاستشعار عن بعد', scope: 'remote-sensing', redirect: '/dashboard/gis-sovereignty/remote-sensing-center' },

  // Section-level real desktop apps
  'section-maintenance-planning': { name: 'DSF - قسم تخطيط الصيانة', scope: 'maintenance', redirect: '/dashboard/admin-gateway/maintenance/planning' },
  'section-maintenance-wells': { name: 'DSF - قسم مراقبة الآبار', scope: 'maintenance', redirect: '/dashboard/admin-gateway/maintenance/wells' },
  'section-maintenance-support': { name: 'DSF - قسم الدعم الفني (صيانة)', scope: 'maintenance', redirect: '/dashboard/admin-gateway/maintenance/technical' },
  'section-maintenance-operations': { name: 'DSF - قسم مراقبة التشغيل', scope: 'maintenance', redirect: '/dashboard/maintenance/operations' },

  'section-corrosion-monitoring': { name: 'DSF - قسم المراقبة الدورية', scope: 'corrosion', redirect: '/dashboard/admin-gateway/corrosion/monitoring' },
  'section-corrosion-support': { name: 'DSF - قسم الدعم الفني (تآكل)', scope: 'corrosion', redirect: '/dashboard/admin-gateway/corrosion/support' },
  'section-corrosion-coating': { name: 'DSF - قسم المكونات الهندسية', scope: 'corrosion', redirect: '/dashboard/admin-gateway/corrosion/coating' },

  'section-finance-budgets': { name: 'DSF - قسم الميزانيات', scope: 'finance', redirect: '/dashboard/admin-gateway/finance/budgets' },
  'section-finance-expenses': { name: 'DSF - قسم النفقات', scope: 'finance', redirect: '/dashboard/admin-gateway/finance/expenses' },
  'section-finance-accounting': { name: 'DSF - قسم المحاسبة', scope: 'finance', redirect: '/dashboard/admin-gateway/accounting' },
  'section-finance-reports': { name: 'DSF - قسم التقارير المالية', scope: 'finance', redirect: '/dashboard/admin-gateway/finance/reports' },
  'section-finance-payroll': { name: 'DSF - قسم الرواتب والأجور', scope: 'finance', redirect: '/dashboard/admin-gateway/finance/payroll' },

  'section-admin-hr': { name: 'DSF - قسم شؤون المستخدمين', scope: 'admin-affairs', redirect: '/dashboard/hr-center/personnel' },
  'section-admin-training': { name: 'DSF - قسم التدريب', scope: 'admin-affairs', redirect: '/dashboard/hr-center/training' },
  'section-admin-data-stats': { name: 'DSF - قسم البيانات والإحصاء', scope: 'admin-affairs', redirect: '/dashboard/hr-center/data' },
  'section-admin-systems-staffing': { name: 'DSF - قسم النظم والملاكات', scope: 'admin-affairs', redirect: '/dashboard/hr-center/staffing' },
  'section-admin-medical-affairs': { name: 'DSF - قسم الشؤون الطبية', scope: 'admin-affairs', redirect: '/dashboard/hr-center/medical' },

  'section-materials-assets': { name: 'DSF - قسم سجل الأصول', scope: 'materials', redirect: '/dashboard/admin-gateway/assets/registry' },
  'section-materials-inventory': { name: 'DSF - قسم المخزون', scope: 'materials', redirect: '/dashboard/admin-gateway/materials/inventory' },
  'section-materials-fleet': { name: 'DSF - قسم الأسطول', scope: 'materials', redirect: '/dashboard/admin-gateway/fleet' },
  'section-materials-procurement': { name: 'DSF - قسم المشتريات', scope: 'materials', redirect: '/dashboard/admin-gateway/materials/procurement' },

  'section-services-intelligence': { name: 'DSF - قسم الاستخبارات', scope: 'services', redirect: '/dashboard/intelligence' },
  'section-services-projects': { name: 'DSF - قسم متابعة المشاريع', scope: 'services', redirect: '/dashboard/projects-control' },
  'section-services-analytics': { name: 'DSF - قسم التحليلات', scope: 'services', redirect: '/dashboard/spatial-analytics' },

  'section-rs-remote-sensing': { name: 'DSF - قسم الاستشعار', scope: 'remote-sensing', redirect: '/dashboard/gis-sovereignty/remote-sensing-center' },
  'section-rs-spatial': { name: 'DSF - قسم التحليل المكاني', scope: 'remote-sensing', redirect: '/dashboard/gis-sovereignty/spatial-analytics' },
  'section-rs-satellite-intel': { name: 'DSF - قسم الاستخبارات الفضائية', scope: 'remote-sensing', redirect: '/dashboard/gis-sovereignty/satellite-intelligence-center' },
  'section-rs-engineering': { name: 'DSF - قسم مساحة العمل الهندسية', scope: 'remote-sensing', redirect: '/dashboard/gis-sovereignty/engineering-workspace' },
};

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    app: '',
    all: false,
    platform: 'linux',
    baseUrl: process.env.DSF_BASE_URL || 'https://dev.d-me.ly',
  };

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--all') opts.all = true;
    else if (a === '--app') opts.app = args[++i] || '';
    else if (a === '--platform') opts.platform = args[++i] || 'linux';
    else if (a === '--base-url') opts.baseUrl = args[++i] || opts.baseUrl;
  }

  return opts;
}

function sanitizeId(input) {
  return String(input).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

function targetFor(platform) {
  if (platform === 'windows') return Platform.WINDOWS.createTarget(['nsis'], Arch.x64);
  if (platform === 'mac') return Platform.MAC.createTarget(['dmg'], Arch.x64);
  return Platform.LINUX.createTarget(['AppImage'], Arch.x64);
}

async function buildOne(appKey, opts) {
  const meta = APPS[appKey];
  if (!meta) throw new Error(`Unknown app key: ${appKey}`);

  const safeKey = sanitizeId(appKey);
  const identifier = `ly.d-me.${safeKey}`;

  const config = {
    appId: identifier,
    productName: meta.name,
    directories: {
      output: `dist-electron/${safeKey}`,
    },
    files: [
      'electron/**/*',
      'package.json',
    ],
    extraMetadata: {
      main: 'electron/main.js',
      dsfLaunch: {
        appId: appKey,
        name: meta.name,
        scope: meta.scope,
        redirect: meta.redirect,
        baseUrl: opts.baseUrl,
      },
    },
    linux: {
      target: ['AppImage'],
      icon: 'electron/assets/icon.png',
      category: 'Office',
      artifactName: `${safeKey}-${'${version}'}-${'${arch}'}.${'${ext}'}`,
    },
    win: {
      target: ['nsis'],
      icon: 'electron/assets/icon.ico',
      artifactName: `${safeKey}-${'${version}'}-setup.${'${ext}'}`,
    },
    mac: {
      target: ['dmg'],
      artifactName: `${safeKey}-${'${version}'}.${'${ext}'}`,
    },
  };

  console.log(`\n[desktop-build] Building ${appKey} (${meta.name}) for ${opts.platform} ...`);
  await build({
    targets: targetFor(opts.platform),
    config,
    publish: 'never',
  });
  console.log(`[desktop-build] Done: ${appKey}`);
}

async function main() {
  const opts = parseArgs();
  const appKeys = opts.all ? Object.keys(APPS) : [opts.app].filter(Boolean);

  if (!appKeys.length) {
    console.error('Usage: node scripts/build-desktop-app.mjs --app <app-key> [--platform linux|windows|mac] [--base-url https://dev.d-me.ly]');
    console.error('   or: node scripts/build-desktop-app.mjs --all --platform linux');
    process.exit(1);
  }

  for (const key of appKeys) {
    await buildOne(key, opts);
  }
}

main().catch((err) => {
  console.error('[desktop-build] Failed:', err?.message || err);
  process.exit(1);
});
