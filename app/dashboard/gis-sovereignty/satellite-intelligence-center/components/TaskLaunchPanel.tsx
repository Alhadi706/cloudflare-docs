'use client';
/**
 * TaskLaunchPanel — لوحة اختيار المهمة
 * بدلاً من مواجهة المستخدم بـ 14 تبويب في وقت واحد،
 * يختار المهمة أولاً ثم يُوجَّه عبر خطوات واضحة
 */
import React, { useState } from 'react';
import {
  Waves, Flame, Droplets, Radio, Map, ArrowLeft,
  CheckCircle2, Circle, X, ChevronLeft,
} from 'lucide-react';

export type TaskMode =
  | 'flood_disaster'   // كشف فيضان/كارثة (Derna نموذج)
  | 'fire_monitor'     // رصد الحرائق الميدانية
  | 'water_leak'       // كشف تسريبات المياه
  | 'insar_subsidence' // هبوط الأرض التاريخي
  | 'area_overview'    // نظرة عامة على منطقة
  | 'custom';          // أدوات متقدمة حرة

export type TaskStep = {
  id: string;
  label: string;
  desc: string;
  ribbonGroup: string;
  action?: string;
};

export const TASKS: {
  id: TaskMode;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  color: string;
  border: string;
  steps: TaskStep[];
}[] = [
  {
    id: 'flood_disaster',
    icon: <Waves className="w-7 h-7" />,
    title: 'كشف كارثة / فيضان',
    subtitle: 'تحليل الأضرار بعد فيضان، انهيار، أو كارثة طبيعية',
    color: 'text-blue-400',
    border: 'border-blue-500/40',
    steps: [
      { id: 'draw',    label: 'ارسم المنطقة', desc: 'حدد المنطقة المتضررة على الخريطة', ribbonGroup: 'draw',   action: 'فعّل وضع الرسم' },
      { id: 'scenes',  label: 'اختر الصور',   desc: 'صورة قبل الحادثة وصورة بعدها',    ribbonGroup: 'scenes',  action: 'افتح متصفح الصور' },
      { id: 'cva',     label: 'تحليل التغيير', desc: 'كشف مناطق التغيير بين الصورتين',  ribbonGroup: 'cva',    action: 'شغّل CVA' },
      { id: 'insar',   label: 'InSAR اختياري', desc: 'قياس الهبوط والتشوه إن وُجد',     ribbonGroup: 'insar',  action: 'حلّل الإزاحة' },
      { id: 'report',  label: 'التقرير',       desc: 'تقرير موحّد بكل النتائج',          ribbonGroup: 'report', action: 'أنشئ التقرير' },
    ],
  },
  {
    id: 'fire_monitor',
    icon: <Flame className="w-7 h-7" />,
    title: 'رصد الحرائق',
    subtitle: 'متابعة الحرائق الحية، حوادث المدن، والمناطق المتكررة',
    color: 'text-orange-400',
    border: 'border-orange-500/40',
    steps: [
      { id: 'monitoring', label: 'خريطة الحرائق',  desc: 'عرض حرائق VIIRS المؤكدة والحضرية', ribbonGroup: 'monitoring', action: 'فعّل طبقة الحرائق' },
      { id: 'archive',    label: 'السجل التاريخي',  desc: 'حرائق المنطقة خلال سنوات',         ribbonGroup: 'scenes',    action: 'ابحث في الأرشيف' },
      { id: 'gas',        label: 'رصد الدخان',      desc: 'CO و NO₂ من Sentinel-5P TROPOMI', ribbonGroup: 'monitoring', action: 'فعّل رصد الغاز' },
      { id: 'report',     label: 'التقرير',          desc: 'ملخص الحوادث والمناطق المتأثرة',  ribbonGroup: 'report',    action: 'أنشئ التقرير' },
    ],
  },
  {
    id: 'water_leak',
    icon: <Droplets className="w-7 h-7" />,
    title: 'كشف تسريبات المياه',
    subtitle: 'رصد تسريبات شبكات المياه وأنابيب النهر الصناعي',
    color: 'text-cyan-400',
    border: 'border-cyan-500/40',
    steps: [
      { id: 'monitoring', label: 'رصد GMMR',      desc: 'تحليل NDWI/NDVI على طول المسار', ribbonGroup: 'monitoring', action: 'فعّل طبقة التسريبات' },
      { id: 'urban',      label: 'شبكات المدن',    desc: 'رصد التسريبات في المناطق الحضرية', ribbonGroup: 'monitoring', action: 'فعّل تسريبات المدن' },
      { id: 'insar',      label: 'هبوط الأرض',     desc: 'كشف ترطيب التربة بـ InSAR',        ribbonGroup: 'insar',    action: 'ابدأ InSAR تاريخي' },
      { id: 'report',     label: 'التقرير',          desc: 'نقاط التسريب المرشحة مع الأدلة',   ribbonGroup: 'report',   action: 'أنشئ التقرير' },
    ],
  },
  {
    id: 'insar_subsidence',
    icon: <Radio className="w-7 h-7" />,
    title: 'هبوط الأرض (InSAR)',
    subtitle: 'قياس تشوه السطح التاريخي بدقة الملليمتر',
    color: 'text-violet-400',
    border: 'border-violet-500/40',
    steps: [
      { id: 'area',    label: 'حدد المنطقة',    desc: 'اختر منطقة من القائمة أو ارسمها', ribbonGroup: 'insar',  action: 'افتح InSAR التاريخي' },
      { id: 'dates',   label: 'حدد الفترة',     desc: 'السنة والشهر للتحليل التاريخي',   ribbonGroup: 'insar',  action: 'اختر الفترة الزمنية' },
      { id: 'submit',  label: 'أرسل للمعالجة',  desc: 'HyP3 يعالج خلال 2-8 ساعات',      ribbonGroup: 'insar',  action: 'أرسل الوظيفة' },
      { id: 'results', label: 'اقرأ النتائج',   desc: 'خريطة الإزاحة + مناطق الخطر',    ribbonGroup: 'insar',  action: 'عرض النتائج' },
    ],
  },
  {
    id: 'area_overview',
    icon: <Map className="w-7 h-7" />,
    title: 'نظرة عامة على منطقة',
    subtitle: 'تحليل شامل لمنطقة: الموارد، المخاطر، التغييرات',
    color: 'text-emerald-400',
    border: 'border-emerald-500/40',
    steps: [
      { id: 'draw',       label: 'ارسم المنطقة',  desc: 'حدد منطقة الاهتمام',             ribbonGroup: 'draw',          action: 'فعّل الرسم' },
      { id: 'scenes',     label: 'آخر صورة',      desc: 'أحدث صورة Sentinel-2 متاحة',     ribbonGroup: 'scenes',        action: 'ابحث عن صورة' },
      { id: 'detection',  label: 'كشف AI',        desc: 'كشف المباني والطرق والتغييرات',  ribbonGroup: 'detection',     action: 'شغّل الكشف' },
      { id: 'monitoring', label: 'المؤشرات',       desc: 'NDVI + NDWI + حرارة السطح',     ribbonGroup: 'monitoring',    action: 'عرض المؤشرات' },
      { id: 'report',     label: 'التقرير',        desc: 'ملخص شامل بالأرقام والخرائط',   ribbonGroup: 'report',        action: 'أنشئ التقرير' },
    ],
  },
  {
    id: 'custom',
    icon: <span className="text-2xl">⚙️</span>,
    title: 'أدوات متقدمة',
    subtitle: 'وصول مباشر لجميع الأدوات — للمستخدم الخبير',
    color: 'text-slate-400',
    border: 'border-slate-600',
    steps: [],
  },
];

interface Props {
  onSelectTask: (task: TaskMode) => void;
}

export default function TaskLaunchPanel({ onSelectTask }: Props) {
  const [hovered, setHovered] = useState<TaskMode | null>(null);

  return (
    <div className="absolute inset-0 z-40 bg-slate-950/95 backdrop-blur-sm flex flex-col items-center justify-center p-6" dir="rtl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-2">
          <div className="w-8 h-8 bg-violet-600/20 rounded-lg border border-violet-500/40 flex items-center justify-center">
            <span className="text-violet-400 text-sm font-bold">SI</span>
          </div>
          <h1 className="text-xl font-bold text-white">مركز قيادة الاستشعار الفضائي</h1>
        </div>
        <p className="text-slate-400 text-sm">اختر مهمتك للبدء بخطوات موجّهة</p>
      </div>

      {/* Task grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full max-w-3xl">
        {TASKS.map(task => (
          <button
            key={task.id}
            onMouseEnter={() => setHovered(task.id)}
            onMouseLeave={() => setHovered(null)}
            onClick={() => onSelectTask(task.id)}
            className={`group relative flex flex-col items-start gap-3 p-4 rounded-xl border bg-slate-900/80 hover:bg-slate-800/90 transition-all duration-150 text-right ${task.border} ${hovered === task.id ? 'shadow-lg shadow-black/30 scale-[1.02]' : ''}`}
          >
            {/* Icon */}
            <div className={`${task.color} opacity-80 group-hover:opacity-100 transition-opacity`}>
              {task.icon}
            </div>
            {/* Text */}
            <div>
              <p className={`text-sm font-bold ${task.color} group-hover:opacity-100 opacity-90`}>{task.title}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{task.subtitle}</p>
            </div>
            {/* Steps preview */}
            {task.steps.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                {task.steps.slice(0, 4).map((s, i) => (
                  <React.Fragment key={s.id}>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-700 group-hover:bg-slate-600" />
                    {i < Math.min(task.steps.length, 4) - 1 && (
                      <div className="w-3 h-px bg-slate-800" />
                    )}
                  </React.Fragment>
                ))}
                <span className="text-[10px] text-slate-600 mr-1">{task.steps.length} خطوات</span>
              </div>
            )}
            {task.id === 'custom' && (
              <p className="text-[10px] text-slate-600">وصول كامل بدون قيود</p>
            )}
            {/* Arrow */}
            <ChevronLeft className="absolute top-4 left-4 w-4 h-4 text-slate-700 group-hover:text-slate-400 transition-colors" />
          </button>
        ))}
      </div>

      {/* Footer */}
      <p className="mt-6 text-xs text-slate-600">يمكنك تغيير المهمة في أي وقت من الشريط العلوي</p>
    </div>
  );
}

/**
 * TaskGuideBar — شريط الخطوات الموجّهة يظهر أعلى الريبون عند تفعيل مهمة
 */
interface TaskGuideBarProps {
  task: ReturnType<typeof TASKS[number]['steps']>[0] extends TaskStep ? typeof TASKS[number] : never;
  currentStep: number;
  onStepClick: (idx: number, ribbonGroup: string) => void;
  onClearTask: () => void;
}

export function TaskGuideBar({
  taskId,
  currentStep,
  onStepClick,
  onClearTask,
}: {
  taskId: TaskMode;
  currentStep: number;
  onStepClick: (idx: number, ribbonGroup: string) => void;
  onClearTask: () => void;
}) {
  const task = TASKS.find(t => t.id === taskId);
  if (!task || task.steps.length === 0) return null;

  return (
    <div className="w-full flex items-center gap-0 bg-slate-950 border-b border-slate-800 px-3 py-1.5 shrink-0" dir="rtl">
      {/* Task label */}
      <div className={`flex items-center gap-1.5 text-xs font-bold ${task.color} shrink-0 ml-3`}>
        <span className="text-sm">{task.id === 'flood_disaster' ? '🌊' : task.id === 'fire_monitor' ? '🔥' : task.id === 'water_leak' ? '💧' : task.id === 'insar_subsidence' ? '📡' : task.id === 'area_overview' ? '🗺️' : '⚙️'}</span>
        <span className="hidden sm:inline">{task.title}</span>
      </div>

      {/* Steps */}
      <div className="flex items-center gap-1 flex-1 overflow-x-auto hide-scrollbar">
        {task.steps.map((step, idx) => {
          const isDone = idx < currentStep;
          const isActive = idx === currentStep;
          return (
            <React.Fragment key={step.id}>
              {idx > 0 && (
                <div className={`w-6 h-px shrink-0 ${isDone ? 'bg-emerald-600' : 'bg-slate-800'}`} />
              )}
              <button
                onClick={() => onStepClick(idx, step.ribbonGroup)}
                title={step.desc}
                className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] shrink-0 transition-all ${
                  isActive  ? 'bg-violet-600/20 border border-violet-500/50 text-violet-300 font-semibold' :
                  isDone    ? 'text-emerald-400' :
                              'text-slate-600 hover:text-slate-400'
                }`}
              >
                {isDone
                  ? <CheckCircle2 className="w-3 h-3 shrink-0" />
                  : <Circle className={`w-3 h-3 shrink-0 ${isActive ? 'text-violet-400' : 'text-slate-700'}`} />
                }
                <span>{step.label}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Clear task */}
      <button
        onClick={onClearTask}
        title="تغيير المهمة"
        className="mr-2 shrink-0 p-1 text-slate-600 hover:text-slate-400 rounded hover:bg-slate-800"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
