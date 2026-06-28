'use client';

import Link from 'next/link';
import React from 'react';
import {
  Download, Laptop2, Wrench, Building2,
  Wallet, Brain, Warehouse, ZapOff, CheckCircle2,
  MonitorDown, ChevronLeft, Satellite, Users, ClipboardList,
  Activity, Droplets, Eye, Radio, BookOpen, BarChart2, ShieldCheck,
  Package, FileText, Layers, Info,
} from 'lucide-react';
import DownloadButtons from './DownloadButtons';

// ─── بيانات الإدارات ──────────────────────────────────────────────────────────
interface DeptCard {
  id: string;
  name: string;
  subtitle: string;
  downloadName: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
  badgeText?: string;
  badgeColor?: string;
}

interface SectionCard {
  id: string;
  sectionName: string;
  departmentId: string;
  parentDepartment: string;
  subtitle: string;
  accentBorder: string;
  accentBg: string;
  accentText: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

interface ApiDepartment {
  id?: number;
  dept_code?: string;
  name?: string;
  name_ar?: string;
  description?: string;
  parent_dept_id?: number | null;
}

const DEPT_CARDS: DeptCard[] = [
  {
    id: 'corrosion',
    name: 'إدارة التآكل',
    subtitle: 'رصد التدهور — التحليل — تنبؤ المخاطر',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-orange-500/40',
    accentBg: 'bg-orange-950/30',
    accentText: 'text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    icon: <ZapOff className="w-7 h-7" />,
    badgeText: 'Legacy',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  {
    id: 'maintenance',
    name: 'إدارة الهندسة والدعم الفني',
    subtitle: 'تخطيط الصيانة — مراقبة الآبار — الدعم الفني — مراقبة التشغيل',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-rose-500/40',
    accentBg: 'bg-rose-950/30',
    accentText: 'text-rose-300',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    icon: <Wrench className="w-7 h-7" />,
  },
  {
    id: 'admin-affairs',
    name: 'إدارة الموارد البشرية',
    subtitle: 'شؤون المستخدمين — التدريب — البيانات والإحصاء — النظم والملاكات — الشؤون الطبية',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/30',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <Building2 className="w-7 h-7" />,
  },
  {
    id: 'finance',
    name: 'المالية',
    subtitle: 'الميزانيات — المحاسبة — الإيرادات',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/30',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <Wallet className="w-7 h-7" />,
  },
  {
    id: 'materials',
    name: 'إدارة المواد',
    subtitle: 'الأصول — المخزون — المركبات والمعدات',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/30',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <Warehouse className="w-7 h-7" />,
  },
  {
    id: 'services',
    name: 'الذكاء والخدمات',
    subtitle: 'التحليلات — التقارير — الذكاء المكاني',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-fuchsia-500/40',
    accentBg: 'bg-fuchsia-950/30',
    accentText: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    icon: <Brain className="w-7 h-7" />,
    badgeText: 'AI',
    badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  },
  {
    id: 'remote-sensing',
    name: 'مركز الاستشعار عن بعد',
    subtitle: 'الأقمار الاصطناعية — التحليل المكاني — رصد الأصول',
    downloadName: 'Flutter Windows (قيد الرفع)',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/30',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Satellite className="w-7 h-7" />,
    badgeText: 'GIS',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
];

const SECTION_CARDS: SectionCard[] = [
  // ── إدارة الهندسة والدعم الفني (maintenance) — 4 أقسام ──────────────────
  {
    id: 'section-maintenance-planning',
    sectionName: 'تخطيط الصيانة',
    departmentId: 'maintenance',
    parentDepartment: 'إدارة الهندسة والدعم الفني',
    subtitle: 'أوامر العمل — الصيانة الوقائية — الجدولة الدورية — الفرق التقنية',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <ClipboardList className="w-6 h-6" />,
  },
  {
    id: 'section-maintenance-wells',
    sectionName: 'مراقبة الآبار',
    departmentId: 'maintenance',
    parentDepartment: 'إدارة الهندسة والدعم الفني',
    subtitle: 'قراءات الضغط — معدلات الضخ — تنبيهات الأعطال — مناسيب المياه',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <Droplets className="w-6 h-6" />,
  },
  {
    id: 'section-maintenance-support',
    sectionName: 'الدعم الفني',
    departmentId: 'maintenance',
    parentDepartment: 'إدارة الهندسة والدعم الفني',
    subtitle: 'مراسلات — طلبات الدعم — التقارير الدورية — أذونات الخروج',
    accentBorder: 'border-emerald-500/40',
    accentBg: 'bg-emerald-950/20',
    accentText: 'text-emerald-300',
    iconBg: 'bg-emerald-500/15',
    iconColor: 'text-emerald-400',
    icon: <ShieldCheck className="w-6 h-6" />,
  },
  {
    id: 'section-maintenance-operations',
    sectionName: 'مراقبة التشغيل',
    departmentId: 'maintenance',
    parentDepartment: 'إدارة الهندسة والدعم الفني',
    subtitle: 'المراقبة الحية — لوحة الأداء — التنبيهات — مؤشرات التشغيل',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/20',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Eye className="w-6 h-6" />,
  },

  // ── إدارة التآكل (corrosion) — 3 أقسام ─────────────────────────────────
  {
    id: 'section-corrosion-monitoring',
    sectionName: 'قسم المراقبة الدورية والصيانة',
    departmentId: 'corrosion',
    parentDepartment: 'إدارة التآكل',
    subtitle: 'قراءات ميدانية — جولات دورية — إنذارات مبكرة — تتبع التدهور',
    accentBorder: 'border-orange-500/40',
    accentBg: 'bg-orange-950/20',
    accentText: 'text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    icon: <Radio className="w-6 h-6" />,
  },
  {
    id: 'section-corrosion-support',
    sectionName: 'قسم الدعم الفني',
    departmentId: 'corrosion',
    parentDepartment: 'إدارة التآكل',
    subtitle: 'مراسلات فنية — طلبات دعم — تقارير — أذونات',
    accentBorder: 'border-orange-500/40',
    accentBg: 'bg-orange-950/20',
    accentText: 'text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    icon: <ShieldCheck className="w-6 h-6" />,
  },
  {
    id: 'section-corrosion-coating',
    sectionName: 'قسم المكونات الهندسية والطلاء',
    departmentId: 'corrosion',
    parentDepartment: 'إدارة التآكل',
    subtitle: 'أنظمة الحماية — الطلاء المضاد — تقارير الحماية الكاثودية',
    accentBorder: 'border-orange-500/40',
    accentBg: 'bg-orange-950/20',
    accentText: 'text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    icon: <Layers className="w-6 h-6" />,
  },

  // ── إدارة الموارد البشرية (admin-affairs) — 5 أقسام ─────────────────────
  {
    id: 'section-admin-hr',
    sectionName: 'قسم شؤون المستخدمين',
    departmentId: 'admin-affairs',
    parentDepartment: 'إدارة الموارد البشرية',
    subtitle: 'ملفات المستخدمين الوظيفية — التعيين — الحركة الوظيفية — الالتزام المؤسسي',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <Users className="w-6 h-6" />,
  },
  {
    id: 'section-admin-training',
    sectionName: 'قسم التدريب',
    departmentId: 'admin-affairs',
    parentDepartment: 'إدارة الموارد البشرية',
    subtitle: 'تأهيل الكفاءات — خطط تدريب سنوية — تقييم أثر التدريب',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <BookOpen className="w-6 h-6" />,
  },
  {
    id: 'section-admin-data-stats',
    sectionName: 'قسم البيانات والإحصاء',
    departmentId: 'admin-affairs',
    parentDepartment: 'إدارة الموارد البشرية',
    subtitle: 'مؤشرات الموارد البشرية — جودة البيانات — تقارير إحصائية معيارية',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <BarChart2 className="w-6 h-6" />,
  },
  {
    id: 'section-admin-systems-staffing',
    sectionName: 'قسم النظم والملاكات',
    departmentId: 'admin-affairs',
    parentDepartment: 'إدارة الموارد البشرية',
    subtitle: 'الهياكل التنظيمية — الملاك الوظيفي — توصيف الوظائف — الحوكمة',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <Layers className="w-6 h-6" />,
  },
  {
    id: 'section-admin-medical-affairs',
    sectionName: 'قسم الشؤون الطبية',
    departmentId: 'admin-affairs',
    parentDepartment: 'إدارة الموارد البشرية',
    subtitle: 'الملف الطبي الوظيفي — السلامة المهنية — الجاهزية الصحية',
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/20',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <ShieldCheck className="w-6 h-6" />,
  },

  // ── المالية (finance) — 4 أقسام ─────────────────────────────────────────
  {
    id: 'section-finance-budgets',
    sectionName: 'الميزانيات',
    departmentId: 'finance',
    parentDepartment: 'المالية',
    subtitle: 'تخطيط مالي — مراجعة بنود — تحويلات — التقارير الدورية',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <Wallet className="w-6 h-6" />,
  },
  {
    id: 'section-finance-expenses',
    sectionName: 'النفقات والتخصيصات',
    departmentId: 'finance',
    parentDepartment: 'المالية',
    subtitle: 'إدارة النفقات — تخصيص الموارد — مراقبة الصرف',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <BarChart2 className="w-6 h-6" />,
  },
  {
    id: 'section-finance-accounting',
    sectionName: 'المحاسبة',
    departmentId: 'finance',
    parentDepartment: 'المالية',
    subtitle: 'دليل الحسابات — مراكز التكلفة — القيود اليومية',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <ClipboardList className="w-6 h-6" />,
  },
  {
    id: 'section-finance-reports',
    sectionName: 'التقارير المالية',
    departmentId: 'finance',
    parentDepartment: 'المالية',
    subtitle: 'التتبع المالي للأصول — التقارير الدورية — مؤشرات الأداء',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <FileText className="w-6 h-6" />,
  },
  {
    id: 'section-finance-payroll',
    sectionName: 'الرواتب والأجور',
    departmentId: 'finance',
    parentDepartment: 'المالية',
    subtitle: 'مسير الرواتب — البدلات — الاستقطاعات — التسويات الدورية',
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/20',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <Wallet className="w-6 h-6" />,
  },

  // ── إدارة المواد (materials) — 4 أقسام ──────────────────────────────────
  {
    id: 'section-materials-assets',
    sectionName: 'سجل الأصول',
    departmentId: 'materials',
    parentDepartment: 'إدارة المواد',
    subtitle: 'سجل الأصول — التصنيف — الصحة — التقييمات المالية',
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/20',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <Warehouse className="w-6 h-6" />,
  },
  {
    id: 'section-materials-inventory',
    sectionName: 'المخزون',
    departmentId: 'materials',
    parentDepartment: 'إدارة المواد',
    subtitle: 'المواد — المستودعات — الاستلام — الإصدار والسحب',
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/20',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <Package className="w-6 h-6" />,
  },
  {
    id: 'section-materials-fleet',
    sectionName: 'الأسطول والمركبات',
    departmentId: 'materials',
    parentDepartment: 'إدارة المواد',
    subtitle: 'سجل المركبات — المعدات — الوقود — تتبع الاستخدام',
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/20',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <Activity className="w-6 h-6" />,
  },
  {
    id: 'section-materials-procurement',
    sectionName: 'المشتريات',
    departmentId: 'materials',
    parentDepartment: 'إدارة المواد',
    subtitle: 'طلبات الشراء — الموردون — أوامر الشراء — التسليم',
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/20',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <ClipboardList className="w-6 h-6" />,
  },

  // ── الذكاء والخدمات (services) — 3 أقسام ───────────────────────────────
  {
    id: 'section-services-intelligence',
    sectionName: 'مركز الاستخبارات',
    departmentId: 'services',
    parentDepartment: 'الذكاء والخدمات',
    subtitle: 'البريفينج اليومي — التوقعات — تقييم المخاطر — لوحة الأداء',
    accentBorder: 'border-fuchsia-500/40',
    accentBg: 'bg-fuchsia-950/20',
    accentText: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    icon: <Brain className="w-6 h-6" />,
  },
  {
    id: 'section-services-projects',
    sectionName: 'متابعة المشاريع',
    departmentId: 'services',
    parentDepartment: 'الذكاء والخدمات',
    subtitle: 'قائمة المشاريع — المراحل — الميزانيات — الوثائق',
    accentBorder: 'border-fuchsia-500/40',
    accentBg: 'bg-fuchsia-950/20',
    accentText: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    icon: <BarChart2 className="w-6 h-6" />,
  },
  {
    id: 'section-services-analytics',
    sectionName: 'التحليلات والتقارير',
    departmentId: 'services',
    parentDepartment: 'الذكاء والخدمات',
    subtitle: 'لوحات ذكاء — مؤشرات تشغيل — تقارير تلقائية',
    accentBorder: 'border-fuchsia-500/40',
    accentBg: 'bg-fuchsia-950/20',
    accentText: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    icon: <Activity className="w-6 h-6" />,
  },

  // ── مركز الاستشعار عن بعد (remote-sensing) — 4 أقسام ────────────────────
  {
    id: 'section-rs-remote-sensing',
    sectionName: 'مركز الاستشعار عن بعد',
    departmentId: 'remote-sensing',
    parentDepartment: 'مركز الاستشعار عن بعد',
    subtitle: 'أقمار اصطناعية — بيانات الطيف — رصد الأصول عن بُعد',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/20',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Satellite className="w-6 h-6" />,
  },
  {
    id: 'section-rs-spatial',
    sectionName: 'التحليل المكاني',
    departmentId: 'remote-sensing',
    parentDepartment: 'مركز الاستشعار عن بعد',
    subtitle: 'تحليل صور — طبقات GIS — رصد التغيرات — خرائط تفاعلية',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/20',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Layers className="w-6 h-6" />,
  },
  {
    id: 'section-rs-satellite-intel',
    sectionName: 'مركز الاستخبارات الفضائية',
    departmentId: 'remote-sensing',
    parentDepartment: 'مركز الاستشعار عن بعد',
    subtitle: 'تحليل صور فضائية — رصد بنية تحتية — كشف التغيرات',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/20',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Eye className="w-6 h-6" />,
  },
  {
    id: 'section-rs-engineering',
    sectionName: 'مساحة العمل الهندسية',
    departmentId: 'remote-sensing',
    parentDepartment: 'مركز الاستشعار عن بعد',
    subtitle: 'خرائط هندسية — طبقات مشاريع — تحرير جغرافي',
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/20',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Building2 className="w-6 h-6" />,
  },
];

const FEATURES = [
  'نافذة مستقلة — بدون متصفح',
  'شاشة دخول احترافية',
  'أيقونة على سطح المكتب',
  'موافقة واحدة للإدارة وأقسامها',
];

const DEPT_VISUALS = [
  {
    accentBorder: 'border-orange-500/40',
    accentBg: 'bg-orange-950/30',
    accentText: 'text-orange-300',
    iconBg: 'bg-orange-500/15',
    iconColor: 'text-orange-400',
    icon: <ZapOff className="w-7 h-7" />,
    badgeText: 'AI',
    badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  },
  {
    accentBorder: 'border-rose-500/40',
    accentBg: 'bg-rose-950/30',
    accentText: 'text-rose-300',
    iconBg: 'bg-rose-500/15',
    iconColor: 'text-rose-400',
    icon: <Wrench className="w-7 h-7" />,
  },
  {
    accentBorder: 'border-blue-500/40',
    accentBg: 'bg-blue-950/30',
    accentText: 'text-blue-300',
    iconBg: 'bg-blue-500/15',
    iconColor: 'text-blue-400',
    icon: <Building2 className="w-7 h-7" />,
  },
  {
    accentBorder: 'border-amber-500/40',
    accentBg: 'bg-amber-950/30',
    accentText: 'text-amber-300',
    iconBg: 'bg-amber-500/15',
    iconColor: 'text-amber-400',
    icon: <Wallet className="w-7 h-7" />,
  },
  {
    accentBorder: 'border-teal-500/40',
    accentBg: 'bg-teal-950/30',
    accentText: 'text-teal-300',
    iconBg: 'bg-teal-500/15',
    iconColor: 'text-teal-400',
    icon: <Warehouse className="w-7 h-7" />,
  },
  {
    accentBorder: 'border-fuchsia-500/40',
    accentBg: 'bg-fuchsia-950/30',
    accentText: 'text-fuchsia-300',
    iconBg: 'bg-fuchsia-500/15',
    iconColor: 'text-fuchsia-400',
    icon: <Brain className="w-7 h-7" />,
    badgeText: 'AI',
    badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
  },
  {
    accentBorder: 'border-violet-500/40',
    accentBg: 'bg-violet-950/30',
    accentText: 'text-violet-300',
    iconBg: 'bg-violet-500/15',
    iconColor: 'text-violet-400',
    icon: <Satellite className="w-7 h-7" />,
    badgeText: 'GIS',
    badgeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
] as const;

function getTenantId(): string {
  if (typeof window === 'undefined') return '';
  const fromStorage = localStorage.getItem('tenant_id') || '';
  if (fromStorage) return fromStorage;
  const fromCookie = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('tenant_id='))
    ?.split('=')[1] || '';
  return decodeURIComponent(fromCookie || '');
}

function normalizeAppId(input: string): string {
  return input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function toArrayDepartments(data: unknown): ApiDepartment[] {
  if (Array.isArray(data)) return data as ApiDepartment[];
  if (data && typeof data === 'object' && Array.isArray((data as { departments?: unknown[] }).departments)) {
    return (data as { departments: ApiDepartment[] }).departments;
  }
  return [];
}

function inferScopeKey(textValue: string): string {
  const text = textValue.toLowerCase();
  if (text.includes('corr') || text.includes('corrosion') || text.includes('تآكل')) return 'corrosion';
  if (text.includes('maint') || text.includes('ops') || text.includes('project') || text.includes('صيانة') || text.includes('مشاريع') || text.includes('هندسة')) return 'maintenance';
  if (text.includes('fin') || text.includes('account') || text.includes('مالية') || text.includes('محاسب') || text.includes('ميزاني')) return 'finance';
  if (text.includes('gis') || text.includes('remote') || text.includes('spatial') || text.includes('جغرا') || text.includes('استشعار') || text.includes('فضاء')) return 'remote-sensing';
  if (text.includes('admin') || text.includes('hr') || text.includes('legal') || text.includes('إدار') || text.includes('الموارد') || text.includes('شؤون')) return 'admin-affairs';
  if (text.includes('material') || text.includes('asset') || text.includes('inventory') || text.includes('مواد') || text.includes('مخزون') || text.includes('أسطول')) return 'materials';
  if (text.includes('service') || text.includes('intel') || text.includes('ai') || text.includes('خدمات') || text.includes('ذكاء') || text.includes('مشاريع')) return 'services';
  return 'generic';
}

type SectionTemplate = {
  slug: string;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
};

const SECTION_TEMPLATES: Record<string, SectionTemplate[]> = {
  corrosion: [
    { slug: 'monitoring', title: 'قسم المراقبة الدورية والصيانة', subtitle: 'قراءات ميدانية — جولات دورية — إنذارات مبكرة — تتبع التدهور', icon: <Radio className="w-6 h-6" /> },
    { slug: 'support', title: 'قسم الدعم الفني', subtitle: 'مراسلات فنية — طلبات دعم — تقارير — أذونات', icon: <ShieldCheck className="w-6 h-6" /> },
    { slug: 'coating', title: 'قسم المكونات الهندسية والطلاء', subtitle: 'طلاء وقائي — فحص مواد — توصيات معالجة', icon: <Layers className="w-6 h-6" /> },
  ],
  maintenance: [
    { slug: 'planning', title: 'تخطيط الصيانة', subtitle: 'أوامر العمل — الصيانة الوقائية — الجدولة الدورية', icon: <ClipboardList className="w-6 h-6" /> },
    { slug: 'wells', title: 'مراقبة الآبار', subtitle: 'قراءات الضغط — معدلات الضخ — تنبيهات الأعطال', icon: <Droplets className="w-6 h-6" /> },
    { slug: 'support', title: 'الدعم الفني', subtitle: 'مراسلات — طلبات الدعم — أذونات الخروج', icon: <ShieldCheck className="w-6 h-6" /> },
    { slug: 'operations', title: 'مراقبة التشغيل', subtitle: 'المراقبة الحية — لوحة الأداء — مؤشرات التشغيل', icon: <Eye className="w-6 h-6" /> },
  ],
  finance: [
    { slug: 'budgets', title: 'الميزانيات', subtitle: 'تخطيط مالي — مراجعة بنود — تحويلات', icon: <Wallet className="w-6 h-6" /> },
    { slug: 'expenses', title: 'النفقات والتخصيصات', subtitle: 'إدارة النفقات — تخصيص الموارد — مراقبة الصرف', icon: <BarChart2 className="w-6 h-6" /> },
    { slug: 'accounting', title: 'المحاسبة', subtitle: 'دليل الحسابات — مراكز التكلفة — القيود اليومية', icon: <ClipboardList className="w-6 h-6" /> },
    { slug: 'reports', title: 'التقارير المالية', subtitle: 'التتبع المالي للأصول — التقارير الدورية — مؤشرات الأداء', icon: <FileText className="w-6 h-6" /> },
    { slug: 'payroll', title: 'الرواتب والأجور', subtitle: 'مسير الرواتب — البدلات — الاستقطاعات — التسويات', icon: <Wallet className="w-6 h-6" /> },
  ],
  'remote-sensing': [
    { slug: 'remote-sensing-center', title: 'مركز الاستشعار عن بعد', subtitle: 'أقمار اصطناعية — بيانات الطيف — رصد الأصول عن بُعد', icon: <Satellite className="w-6 h-6" /> },
    { slug: 'spatial-analytics', title: 'التحليل المكاني', subtitle: 'تحليل صور — طبقات GIS — رصد التغيرات', icon: <Layers className="w-6 h-6" /> },
    { slug: 'satellite-intel', title: 'مركز الاستخبارات الفضائية', subtitle: 'تحليل صور فضائية — رصد بنية تحتية', icon: <Eye className="w-6 h-6" /> },
    { slug: 'engineering-workspace', title: 'مساحة العمل الهندسية', subtitle: 'خرائط هندسية — طبقات مشاريع — تحرير جغرافي', icon: <Building2 className="w-6 h-6" /> },
  ],
  'admin-affairs': [
    // Structured per global HR governance practices (workforce admin, capability, data, staffing, occupational health)
    { slug: 'user-affairs', title: 'قسم شؤون المستخدمين', subtitle: 'سياسات المستخدمين الوظيفية ودورة الحياة الوظيفية', icon: <Users className="w-6 h-6" /> },
    { slug: 'training', title: 'قسم التدريب', subtitle: 'خطة تدريب سنوية مبنية على الكفاءات وقياس الأثر', icon: <BookOpen className="w-6 h-6" /> },
    { slug: 'data-stats', title: 'قسم البيانات والإحصاء', subtitle: 'مؤشرات ومعايير بيانات الموارد البشرية وتقارير إحصائية', icon: <BarChart2 className="w-6 h-6" /> },
    { slug: 'systems-staffing', title: 'قسم النظم والملاكات', subtitle: 'الهياكل التنظيمية والملاك الوظيفي وتوصيف الوظائف', icon: <Layers className="w-6 h-6" /> },
    { slug: 'medical-affairs', title: 'قسم الشؤون الطبية', subtitle: 'الصحة المهنية والملف الطبي الوظيفي والجاهزية الصحية', icon: <ShieldCheck className="w-6 h-6" /> },
  ],
  materials: [
    { slug: 'assets', title: 'سجل الأصول', subtitle: 'سجل الأصول — التصنيف — الصحة — التقييمات', icon: <Warehouse className="w-6 h-6" /> },
    { slug: 'inventory', title: 'المخزون', subtitle: 'المواد — المستودعات — الاستلام — الإصدار', icon: <Package className="w-6 h-6" /> },
    { slug: 'fleet', title: 'الأسطول والمركبات', subtitle: 'سجل المركبات — المعدات — الوقود', icon: <Activity className="w-6 h-6" /> },
    { slug: 'procurement', title: 'المشتريات', subtitle: 'طلبات الشراء — الموردون — أوامر الشراء', icon: <ClipboardList className="w-6 h-6" /> },
  ],
  services: [
    { slug: 'intelligence', title: 'مركز الاستخبارات', subtitle: 'البريفينج — التوقعات — تقييم المخاطر — لوحة الأداء', icon: <Brain className="w-6 h-6" /> },
    { slug: 'projects', title: 'متابعة المشاريع', subtitle: 'قائمة المشاريع — المراحل — الميزانيات', icon: <BarChart2 className="w-6 h-6" /> },
    { slug: 'analytics', title: 'التحليلات والتقارير', subtitle: 'لوحات ذكاء — مؤشرات — تقارير تلقائية', icon: <Activity className="w-6 h-6" /> },
  ],
  generic: [
    { slug: 'operations', title: 'قسم العمليات', subtitle: 'تشغيل يومي — متابعة مهام — تقارير', icon: <Users className="w-6 h-6" /> },
    { slug: 'planning', title: 'قسم التخطيط', subtitle: 'خطط تشغيل — أولويات — تتبع تنفيذ', icon: <ClipboardList className="w-6 h-6" /> },
  ],
};

function buildCatalogFromDepartments(rows: ApiDepartment[]): { departments: DeptCard[]; sections: SectionCard[] } {
  const byId = new Map<number, ApiDepartment>();
  rows.forEach((r) => {
    if (typeof r.id === 'number') byId.set(r.id, r);
  });

  const rootRows = rows.filter((r) => !r.parent_dept_id);
  const sectionRows = rows.filter((r) => !!r.parent_dept_id);

  const departments: DeptCard[] = rootRows.map((row, index) => {
    const visual = DEPT_VISUALS[index % DEPT_VISUALS.length];
    const name = row.name_ar || row.name || 'إدارة بدون اسم';
    const appId = normalizeAppId(row.dept_code || row.name || name);
    return {
      id: appId,
      name,
      subtitle: row.description || 'تطبيق إدارة مستقل',
      downloadName: `${appId}.AppImage`,
      accentBorder: visual.accentBorder,
      accentBg: visual.accentBg,
      accentText: visual.accentText,
      iconBg: visual.iconBg,
      iconColor: visual.iconColor,
      icon: visual.icon,
      badgeText: ('badgeText' in visual ? visual.badgeText : undefined) as string | undefined,
      badgeColor: ('badgeColor' in visual ? visual.badgeColor : undefined) as string | undefined,
    };
  });

  const rootIdToAppId = new Map<number, string>();
  rootRows.forEach((row, index) => {
    if (typeof row.id !== 'number') return;
    const name = row.name_ar || row.name || `dept-${index + 1}`;
    rootIdToAppId.set(row.id, normalizeAppId(row.dept_code || row.name || name));
  });

  const sections: SectionCard[] = sectionRows
    .map((row, index) => {
      const parentId = row.parent_dept_id;
      if (!parentId || !rootIdToAppId.has(parentId)) return null;
      const parent = byId.get(parentId);
      const parentName = parent?.name_ar || parent?.name || 'إدارة رئيسية';
      const visual = DEPT_VISUALS[index % DEPT_VISUALS.length];
      const sectionName = row.name_ar || row.name || 'قسم بدون اسم';
      return {
        id: normalizeAppId(row.dept_code || `section-${row.id || index + 1}-${sectionName}`),
        sectionName,
        departmentId: rootIdToAppId.get(parentId) || '',
        parentDepartment: parentName,
        subtitle: row.description || 'تطبيق قسم مستقل',
        accentBorder: visual.accentBorder,
        accentBg: 'bg-slate-900/35',
        accentText: visual.accentText,
        iconBg: visual.iconBg,
        iconColor: visual.iconColor,
        icon: <Users className="w-6 h-6" />,
      };
    })
    .filter((row): row is NonNullable<typeof row> => !!row) as SectionCard[];

  // When API returns only top-level departments (no children), inject template sections
  const existingDeptIds = new Set(sections.map((s) => s.departmentId));
  departments.forEach((dept, index) => {
    if (existingDeptIds.has(dept.id)) return;
    const scopeKey = inferScopeKey(`${dept.id} ${dept.name} ${dept.subtitle}`);
    const templates = SECTION_TEMPLATES[scopeKey] || SECTION_TEMPLATES.generic;
    const visual = DEPT_VISUALS[index % DEPT_VISUALS.length];
    templates.forEach((template) => {
      sections.push({
        id: normalizeAppId(`section-${dept.id}-${template.slug}`),
        sectionName: template.title,
        departmentId: dept.id,
        parentDepartment: dept.name,
        subtitle: template.subtitle,
        accentBorder: visual.accentBorder,
        accentBg: 'bg-slate-900/35',
        accentText: visual.accentText,
        iconBg: visual.iconBg,
        iconColor: visual.iconColor,
        icon: template.icon,
      });
    });
  });

  return { departments, sections };
}

export default function InstallPage() {
  const deptCards = DEPT_CARDS;
  const sectionCards = SECTION_CARDS;

  const sectionsByDepartment = sectionCards.reduce<Record<string, SectionCard[]>>((acc, section) => {
    if (!acc[section.departmentId]) acc[section.departmentId] = [];
    acc[section.departmentId].push(section);
    return acc;
  }, {});

  return (
    <div dir="rtl" className="min-h-screen bg-[#050b17] text-white" style={{ backgroundColor: '#050b17', color: '#f8fafc' }}>
      {/* ─── الرأس ─────────────────────────────────────────────── */}
      <div className="border-b border-white/8 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center">
            <Laptop2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white">DSF Gateway</h1>
            <p className="text-xs text-slate-400">منصة الإدارات الرقمية</p>
          </div>
        </div>
        <Link href="/entry" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
          تسجيل الدخول
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">

        {/* ─── العنوان الرئيسي ─────────────────────────────────── */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/25 rounded-full px-4 py-1.5 text-xs text-indigo-300">
            <MonitorDown className="w-3.5 h-3.5" />
            تطبيق سطح المكتب — Tauri v2 · Linux
          </div>
          <h2 className="text-3xl font-bold text-white">حمّل الإدارة أو القسم كتطبيق مستقل</h2>
          <p className="text-slate-400 text-sm max-w-xl mx-auto leading-relaxed">
            كل إدارة تظهر مع أقسامها التابعة مباشرة لتوضيح التبعية.
            التنزيل يتم بشكل مستقل لكل إدارة ولكل قسم، لكن الموافقة تكون موحدة على مستوى الإدارة مع أقسامها.
          </p>
          <p className="text-slate-500 text-xs max-w-2xl mx-auto leading-relaxed">
            ملاحظة: الكتالوج يعرض جميع التطبيقات المتاحة، لكن التفعيل النهائي يعتمد على الرخصة ونطاق مؤسستك.
            عند إضافة إدارة جديدة لمؤسسة فيها إدارة فعالة، يتم إنشاء طلب موافقة أمني قبل التفعيل.
          </p>
        </div>

        {/* ─── المميزات ────────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {FEATURES.map(f => (
            <div key={f} className="flex items-center gap-2 bg-white/4 border border-white/8 rounded-xl px-3 py-2.5 text-xs text-slate-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              {f}
            </div>
          ))}
        </div>

        {/* ─── الإدارات مع الأقسام التابعة ─────────────────────── */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-100">كتالوج الإدارات والأقسام التابعة</h3>
          <span className="text-xs text-slate-400">{deptCards.length} إدارات · {sectionCards.length} أقسام</span>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {deptCards.map(dept => (
            <div
              key={dept.id}
              className={`relative flex flex-col rounded-2xl border ${dept.accentBorder} ${dept.accentBg} p-5 space-y-4 overflow-hidden tree-department-card`}
            >
              {/* الأيقونة والاسم */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl ${dept.iconBg} flex items-center justify-center ${dept.iconColor}`}>
                    {dept.icon}
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm leading-tight">{dept.name}</p>
                    <p className={`text-xs mt-0.5 ${dept.accentText} opacity-80`}>{dept.subtitle}</p>
                  </div>
                </div>
                {dept.badgeText && (
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${dept.badgeColor}`}>
                    {dept.badgeText}
                  </span>
                )}
              </div>

              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/20 px-3 py-2 text-[11px] text-emerald-200/90">
                موافقة واحدة: تفعيل الإدارة يربط معها أقسامها التابعة مباشرة ضمن نفس المؤسسة.
              </div>

              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-200">تنزيل تطبيق الإدارة</p>
                <DownloadButtons appId={dept.id} accentBorder={dept.accentBorder} accentText={dept.accentText} />
              </div>

              <div className="h-px bg-white/10" />

              <div className="space-y-3 tree-sections-wrap">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-200">الأقسام التابعة ({(sectionsByDepartment[dept.id] || []).length})</p>
                  <span className="text-[10px] text-slate-400">تنزيل مستقل لكل قسم</span>
                </div>

                {(sectionsByDepartment[dept.id] || []).length === 0 ? (
                  <div className="rounded-xl border border-dashed border-white/15 bg-white/5 px-3 py-2 text-xs text-slate-400">
                    لا توجد أقسام معروضة حالياً لهذه الإدارة.
                  </div>
                ) : (
                  <div className="space-y-3 tree-list">
                    {(sectionsByDepartment[dept.id] || []).map(section => (
                      <div key={section.id} className={`rounded-xl border ${section.accentBorder} ${section.accentBg} p-3 space-y-2 tree-section-item`}>
                        <div className="tree-branch" aria-hidden="true" />
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-9 h-9 rounded-lg ${section.iconBg} flex items-center justify-center ${section.iconColor}`}>
                              {section.icon}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-white">{section.sectionName}</p>
                              <p className="text-[11px] text-slate-400">{section.subtitle}</p>
                            </div>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border border-white/20 text-slate-300 bg-white/5">
                            قسم
                          </span>
                        </div>
                        <DownloadButtons appId={section.id} parentScopeId={section.departmentId} accentBorder={section.accentBorder} accentText={section.accentText} />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="text-[11px] text-slate-500 text-center -mt-2">AppImage · EXE · 77 MB / 2.8 MB · x64</p>
            </div>
          ))}
        </div>

        {/* ─── كيفية ربط عدة إدارات ───────────────────────────── */}
        <div className="bg-slate-900/60 border border-slate-700/50 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2.5">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <h3 className="text-sm font-bold text-white">كيف تربط عدة إدارات بنفس المؤسسة؟</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {([
              {
                step: '١',
                title: 'نزّل الإدارة الأولى',
                desc: 'اختر الإدارة التي اشتريتها ونزّل تطبيقها. عند أول تشغيل ستنشئ المؤسسة وتحصل على كود الربط.',
                color: 'text-indigo-400',
                border: 'border-indigo-500/25',
              },
              {
                step: '٢',
                title: 'احفظ كود الربط',
                desc: 'بعد الإعداد الأول ستظهر كود من 8 أحرف — مثل: XK-48219. هذا الكود يمثل مؤسستك.',
                color: 'text-amber-400',
                border: 'border-amber-500/25',
              },
              {
                step: '٣',
                title: 'فعّل الإدارة مع أقسامها',
                desc: 'عند إضافة إدارة جديدة لنفس المؤسسة، يُرسل طلب موافقة واحد. بعد قبوله، تصبح الإدارة وأقسامها التابعة جاهزة حسب الترخيص، بينما يبقى تنزيل كل تطبيق منفصلًا.',
                color: 'text-emerald-400',
                border: 'border-emerald-500/25',
              },
            ] as const).map(item => (
              <div key={item.step} className={`rounded-xl border ${item.border} bg-white/3 p-4 space-y-2`}>
                <div className={`text-2xl font-black ${item.color}`}>{item.step}</div>
                <p className="text-sm font-semibold text-white">{item.title}</p>
                <p className="text-xs text-slate-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gradient-to-r from-indigo-950/50 to-slate-900/50 border border-indigo-500/20 rounded-2xl p-6 space-y-3">
          <h3 className="text-base font-bold text-white">ملاحظة سرعة التحميل</h3>
          <p className="text-sm text-slate-300 leading-relaxed">
            تم اعتماد مسار التحميل المباشر للتطبيقات المكتبية فقط. صفحة التثبيت أصبحت ثابتة وخفيفة
            بدون منطق عميل إضافي، لتحسين سرعة الفتح وتقليل كلفة JavaScript عند أول زيارة.
          </p>
          <p className="text-xs text-slate-500">
            الأفضل للاستخدام اليومي: تنزيل تطبيق الإدارة المطلوبة وتشغيلها مباشرة بدلاً من وضع الويب.
          </p>
        </div>

        {/* ─── تعليمات التشغيل ────────────────────────────────── */}
        <div className="bg-black/30 border border-white/8 rounded-xl p-4 space-y-4">
          <p className="text-xs font-semibold text-slate-300">تعليمات التشغيل بعد التنزيل:</p>

          {/* Windows - Flutter pending */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-sky-300">🪟 Windows (Flutter Native · قريباً)</p>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div dir="ltr" className="bg-black/40 rounded-lg px-3 py-2">1. سيتم تفعيل زر التحميل فور رفع حزمة Flutter</div>
              <div dir="ltr" className="bg-black/40 rounded-lg px-3 py-2">2. حالياً تم إيقاف تنزيل نسخة Legacy الثقيلة</div>
            </div>
            <p className="text-[11px] text-slate-500">سنفعّل تنزيل Flutter Windows مباشرة بعد رفع dsf_gateway_flutter-windows-x64.zip.</p>
          </div>

          {/* Linux Legacy */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-indigo-300">🐧 Linux (AppImage · Legacy)</p>
            <div className="space-y-1 text-xs font-mono text-slate-400">
              <div dir="ltr" className="bg-black/40 rounded-lg px-3 py-2">chmod +x DSF-Gateway_0.1.0_amd64.AppImage</div>
              <div dir="ltr" className="bg-black/40 rounded-lg px-3 py-2">./DSF-Gateway_0.1.0_amd64.AppImage</div>
            </div>
            <p className="text-[11px] text-slate-500">AppImage محمول — بدون تثبيت — للقراءات التاريخية فقط</p>
          </div>
        </div>

      </div>

      <style jsx>{`
        .tree-department-card {
          background-color: rgba(15, 23, 42, 0.55);
          backdrop-filter: blur(2px);
        }

        .tree-sections-wrap {
          position: relative;
        }

        .tree-list {
          position: relative;
          margin-inline-start: 8px;
          padding-inline-start: 16px;
          border-inline-start: 1px solid rgba(148, 163, 184, 0.32);
        }

        .tree-section-item {
          position: relative;
        }

        .tree-section-item .tree-branch {
          position: absolute;
          top: 20px;
          inset-inline-start: -17px;
          width: 14px;
          height: 1px;
          background: rgba(148, 163, 184, 0.5);
        }

        @media (max-width: 640px) {
          .tree-list {
            margin-inline-start: 4px;
            padding-inline-start: 12px;
          }

          .tree-section-item .tree-branch {
            inset-inline-start: -13px;
            width: 10px;
          }
        }
      `}</style>
    </div>
  );
}
