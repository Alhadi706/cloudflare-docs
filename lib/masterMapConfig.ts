/**
 * Master Map Configuration
 * Central definition for all layers, roles, and layer visibility.
 * All departments inherit from this single source of truth.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export type UserRole =
  | 'executive'       // President / GM — read-only all-layers overview
  | 'director'        // Department director — shared + dept layers
  | 'officer'         // Analyst / officer — working layers only
  | 'engineer'        // GIS engineer — editing + all technical layers
  | 'admin';          // Full control

export type Department =
  | 'executive'
  | 'gis'
  | 'assets'
  | 'projects'
  | 'hr'
  | 'finance'
  | 'procurement'
  | 'maintenance'
  | 'admin';

export type LayerCategory =
  | 'base'
  | 'core'
  | 'infrastructure'
  | 'operations'
  | 'finance'
  | 'social'
  | 'alerts';

export type BaseMapStyle = 'satellite' | 'streets' | 'terrain';

export interface LayerDef {
  id: string;
  label: string;
  labelAr: string;
  category: LayerCategory;
  /** Which departments can see this layer */
  departments: Department[];
  /** Minimum role needed to see this layer */
  minRole: UserRole;
  /** Whether this layer can be edited (not just viewed) */
  editable: boolean;
  /** Color used for features in this layer */
  color: string;
  /** Icon name from lucide for the UI */
  icon: string;
  /** Whether visible by default */
  defaultVisible: boolean;
  /** Whether executive overview shows this */
  executiveVisible: boolean;
}

// ── Role hierarchy (higher number = more access) ───────────────────────────

export const ROLE_LEVEL: Record<UserRole, number> = {
  officer:   1,
  director:  2,
  engineer:  3,
  executive: 4,
  admin:     5,
};

// ── Libya + North Africa bounds (for map initialization) ───────────────────

export const LIBYA_CENTER: [number, number] = [17.0, 26.0]; // [lon, lat]
export const LIBYA_ZOOM = 6;
export const TRIPOLI_CENTER: [number, number] = [13.18, 32.9];
export const TRIPOLI_ZOOM = 11;

// ── Base map tile URLs ──────────────────────────────────────────────────────

export const BASE_TILE_URLS: Record<BaseMapStyle, { satellite?: string; labels?: string; streets?: string }> = {
  satellite: {
    satellite: '/tiles/satellite/{z}/{y}/{x}',
    labels:    '/tiles/labels/{z}/{y}/{x}',
  },
  streets: {
    streets: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  },
  terrain: {
    // CartoDB Positron (low-contrast, good for overlays)
    streets: 'https://{a-d}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
  },
};

// ── Layer definitions ───────────────────────────────────────────────────────

export const MASTER_LAYERS: LayerDef[] = [
  // ── Core / National ────────────────────────────────────────────────────
  {
    id: 'national-boundaries',
    label: 'National Boundaries',
    labelAr: 'الحدود الوطنية',
    category: 'core',
    departments: ['executive','gis','admin','projects','assets'],
    minRole: 'officer',
    editable: false,
    color: '#60a5fa',
    icon: 'Globe',
    defaultVisible: true,
    executiveVisible: true,
  },
  {
    id: 'municipalities',
    label: 'Municipalities',
    labelAr: 'البلديات',
    category: 'core',
    departments: ['executive','gis','admin','projects','assets','hr','finance'],
    minRole: 'officer',
    editable: false,
    color: '#34d399',
    icon: 'MapPin',
    defaultVisible: true,
    executiveVisible: true,
  },
  {
    id: 'districts',
    label: 'Districts / Sha\'biyat',
    labelAr: 'الشعبيات / المناطق',
    category: 'core',
    departments: ['executive','gis','admin'],
    minRole: 'officer',
    editable: false,
    color: '#a78bfa',
    icon: 'Map',
    defaultVisible: false,
    executiveVisible: true,
  },

  // ── Infrastructure ─────────────────────────────────────────────────────
  {
    id: 'roads',
    label: 'Roads & Transport',
    labelAr: 'الطرق والنقل',
    category: 'infrastructure',
    departments: ['executive','gis','projects','assets','maintenance'],
    minRole: 'officer',
    editable: false,
    color: '#fbbf24',
    icon: 'Route',
    defaultVisible: false,
    executiveVisible: false,
  },
  {
    id: 'facilities',
    label: 'Public Facilities',
    labelAr: 'المرافق العامة',
    category: 'infrastructure',
    departments: ['executive','gis','projects','assets','hr'],
    minRole: 'officer',
    editable: false,
    color: '#fb923c',
    icon: 'Building2',
    defaultVisible: false,
    executiveVisible: true,
  },
  {
    id: 'utilities',
    label: 'Utilities (Water/Power)',
    labelAr: 'المرافق (ماء/كهرباء)',
    category: 'infrastructure',
    departments: ['gis','projects','assets','maintenance'],
    minRole: 'officer',
    editable: false,
    color: '#38bdf8',
    icon: 'Zap',
    defaultVisible: false,
    executiveVisible: false,
  },

  // ── Projects ────────────────────────────────────────────────────────────
  {
    id: 'active-projects',
    label: 'Active Projects',
    labelAr: 'المشاريع النشطة',
    category: 'operations',
    departments: ['executive','gis','projects','assets','procurement','finance'],
    minRole: 'officer',
    editable: false,
    color: '#4ade80',
    icon: 'Hammer',
    defaultVisible: true,
    executiveVisible: true,
  },
  {
    id: 'project-sites',
    label: 'Project Sites',
    labelAr: 'مواقع المشاريع',
    category: 'operations',
    departments: ['gis','projects','assets','maintenance'],
    minRole: 'officer',
    editable: true,
    color: '#22d3ee',
    icon: 'MapPin',
    defaultVisible: true,
    executiveVisible: false,
  },

  // ── Assets ──────────────────────────────────────────────────────────────
  {
    id: 'asset-registry',
    label: 'Asset Registry',
    labelAr: 'سجل الأصول',
    category: 'operations',
    departments: ['gis','assets','projects','maintenance'],
    minRole: 'officer',
    editable: true,
    color: '#f97316',
    icon: 'Package',
    defaultVisible: false,
    executiveVisible: false,
  },
  {
    id: 'asset-alerts',
    label: 'Asset Alerts',
    labelAr: 'تنبيهات الأصول',
    category: 'alerts',
    departments: ['executive','gis','assets','maintenance'],
    minRole: 'officer',
    editable: false,
    color: '#ef4444',
    icon: 'AlertTriangle',
    defaultVisible: true,
    executiveVisible: true,
  },

  // ── Maintenance ─────────────────────────────────────────────────────────
  {
    id: 'work-orders',
    label: 'Work Orders',
    labelAr: 'أوامر العمل',
    category: 'operations',
    departments: ['gis','maintenance','projects','assets'],
    minRole: 'officer',
    editable: true,
    color: '#84cc16',
    icon: 'Wrench',
    defaultVisible: false,
    executiveVisible: false,
  },
  {
    id: 'corrosion-zones',
    label: 'Corrosion Zones',
    labelAr: 'مناطق التآكل',
    category: 'operations',
    departments: ['gis','maintenance','assets'],
    minRole: 'officer',
    editable: true,
    color: '#f59e0b',
    icon: 'AlertOctagon',
    defaultVisible: false,
    executiveVisible: false,
  },

  // ── HR / Social ─────────────────────────────────────────────────────────
  {
    id: 'staff-distribution',
    label: 'Staff Distribution',
    labelAr: 'توزيع الموظفين',
    category: 'social',
    departments: ['gis','hr','executive'],
    minRole: 'director',
    editable: false,
    color: '#c084fc',
    icon: 'Users',
    defaultVisible: false,
    executiveVisible: false,
  },
  {
    id: 'service-zones',
    label: 'Service Zones',
    labelAr: 'مناطق الخدمة',
    category: 'social',
    departments: ['gis','hr','projects','finance'],
    minRole: 'officer',
    editable: false,
    color: '#2dd4bf',
    icon: 'Layers',
    defaultVisible: false,
    executiveVisible: true,
  },

  // ── Finance ─────────────────────────────────────────────────────────────
  {
    id: 'budget-regions',
    label: 'Budget Regions',
    labelAr: 'المناطق الميزانية',
    category: 'finance',
    departments: ['executive','finance','gis'],
    minRole: 'director',
    editable: false,
    color: '#facc15',
    icon: 'DollarSign',
    defaultVisible: false,
    executiveVisible: false,
  },
  {
    id: 'contract-sites',
    label: 'Contract Sites',
    labelAr: 'مواقع العقود',
    category: 'finance',
    departments: ['finance','procurement','gis','projects'],
    minRole: 'officer',
    editable: false,
    color: '#e879f9',
    icon: 'FileText',
    defaultVisible: false,
    executiveVisible: false,
  },

  // ── Alerts / Hot zones ─────────────────────────────────────────────────
  {
    id: 'risk-zones',
    label: 'Risk Zones',
    labelAr: 'مناطق الخطر',
    category: 'alerts',
    departments: ['executive','gis','admin','maintenance'],
    minRole: 'officer',
    editable: false,
    color: '#dc2626',
    icon: 'ShieldAlert',
    defaultVisible: true,
    executiveVisible: true,
  },
  {
    id: 'change-detection',
    label: 'Change Detection',
    labelAr: 'كشف التغييرات',
    category: 'alerts',
    departments: ['executive','gis','admin'],
    minRole: 'officer',
    editable: false,
    color: '#f43f5e',
    icon: 'Scan',
    defaultVisible: false,
    executiveVisible: true,
  },
];

// ── Department → Layer mapping ──────────────────────────────────────────────

export function getLayersForDepartment(dept: Department, role: UserRole): LayerDef[] {
  const myLevel = ROLE_LEVEL[role];
  return MASTER_LAYERS.filter(l =>
    l.departments.includes(dept) && ROLE_LEVEL[l.minRole] <= myLevel
  );
}

export function getExecutiveLayers(): LayerDef[] {
  return MASTER_LAYERS.filter(l => l.executiveVisible);
}

// ── Demo marker data (Libya municipalities) ────────────────────────────────
// ⚠️  هذه بيانات تجريبية مُرمَّزة — لا تمثّل مشاريع أو أصولاً حقيقية.
// يجب عرضها مع شارة "بيانات تجريبية" المرئية دائماً.

export const IS_DEMO_DATA = true; // علامة واضحة تُستخدم في مكونات الخريطة

export interface DemoMarker {
  id: string;
  name: string;
  nameAr: string;
  lon: number;
  lat: number;
  layer: string;
  status: 'active' | 'warning' | 'alert' | 'info';
  value?: string;
  /** دائماً true — هذه بيانات تجريبية فقط */
  isDemo: true;
}

export const DEMO_MARKERS: DemoMarker[] = [
  { id: 'm1', name: 'Tripoli', nameAr: 'طرابلس', lon: 13.18, lat: 32.9, layer: 'municipalities', status: 'active', value: '12 projects', isDemo: true },
  { id: 'm2', name: 'Benghazi', nameAr: 'بنغازي', lon: 20.07, lat: 32.11, layer: 'municipalities', status: 'active', value: '8 projects', isDemo: true },
  { id: 'm3', name: 'Misrata', nameAr: 'مصراتة', lon: 15.09, lat: 32.37, layer: 'municipalities', status: 'warning', value: '3 alerts', isDemo: true },
  { id: 'm4', name: 'Sabha', nameAr: 'سبها', lon: 14.43, lat: 27.04, layer: 'municipalities', status: 'info', value: '2 projects', isDemo: true },
  { id: 'm5', name: 'Zintan', nameAr: 'الزنتان', lon: 12.26, lat: 31.93, layer: 'municipalities', status: 'active', isDemo: true },
  { id: 'm6', name: 'Zawiya', nameAr: 'الزاوية', lon: 12.73, lat: 32.76, layer: 'municipalities', status: 'active', isDemo: true },
  { id: 'm7', name: 'Port Project', nameAr: 'مشروع الميناء', lon: 13.20, lat: 32.88, layer: 'active-projects', status: 'active', value: '67% complete', isDemo: true },
  { id: 'm8', name: 'Road Network A', nameAr: 'شبكة الطرق أ', lon: 14.20, lat: 32.50, layer: 'active-projects', status: 'warning', value: 'Delayed', isDemo: true },
  { id: 'm9', name: 'Risk Zone: Al-Jufrah', nameAr: 'منطقة خطر: الجفرة', lon: 16.5, lat: 29.0, layer: 'risk-zones', status: 'alert', value: 'High risk', isDemo: true },
  { id: 'm10', name: 'Asset Cluster: Tripoli W', nameAr: 'تجمع أصول: طرابلس غ', lon: 12.9, lat: 32.85, layer: 'asset-registry', status: 'info', value: '45 assets', isDemo: true },
];
