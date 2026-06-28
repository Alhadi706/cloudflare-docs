import React from 'react';
import {
  X,
  FileText,
  Plus,
  Trash2,
  Loader2,
  Boxes,
  LayoutGrid,
  Package,
} from 'lucide-react';

type DocLike = {
  id: string;
  doc_type: string;
  title: string;
  file_url?: string;
  department?: string;
};

type ChildLike = {
  id: string;
  asset_name: string;
  asset_type: string;
  health_score: number;
  total_cost: number;
};

type ChildrenDataLike = {
  children_by_department: Record<string, ChildLike[]>;
  total_children: number;
  total_cost: number;
  currency: string;
  departments: string[];
};

export function InfoCard({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-700/40 bg-slate-800/40 overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5 bg-slate-800/60 border-b border-slate-700/40">
        {icon}
        <span className="text-sm font-semibold text-slate-100">{title}</span>
      </div>
      <div className="px-3 py-3 space-y-0.5">{children}</div>
    </div>
  );
}

export function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <span className="text-xs text-slate-400 flex-shrink-0">{label}</span>
      <span className={`text-sm text-slate-100 truncate text-left ${mono ? 'font-mono text-sky-300' : ''}`}>
        {value}
      </span>
    </div>
  );
}

export function DocCard({
  doc,
  onDelete,
  docTypeLabels,
}: {
  doc: DocLike;
  onDelete: (id: string) => void;
  docTypeLabels: Record<string, string>;
}) {
  return (
    <div className="flex items-start justify-between p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/40">
      <div className="flex gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center flex-shrink-0 mt-0.5">
          <FileText className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-white font-medium truncate">{doc.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded">
              {docTypeLabels[doc.doc_type] ?? doc.doc_type}
            </span>
            {doc.department && <span className="text-xs text-slate-400">{doc.department}</span>}
          </div>
          {doc.file_url && (
            <a
              href={doc.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-sky-400 hover:underline mt-0.5 block"
            >
              فتح الملف ↗
            </a>
          )}
        </div>
      </div>
      <button
        onClick={() => onDelete(doc.id)}
        className="p-1 rounded text-slate-500 hover:text-red-400 transition-colors flex-shrink-0"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export function SectionHeader({ title, onAdd }: { title: string; onAdd?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
      {onAdd && (
        <button
          onClick={onAdd}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium
                     bg-sky-500/20 border border-sky-500/40 text-sky-300
                     hover:bg-sky-500/30 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة
        </button>
      )}
    </div>
  );
}

export function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-500">
      {icon}
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function AddDialog({
  title,
  onClose,
  onSave,
  saving,
  children,
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute inset-0 bg-slate-900/90 z-10 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700/60 bg-slate-800/80">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <button onClick={onClose} className="p-1.5 rounded text-slate-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {children}
      </div>
      <div className="flex gap-2 px-4 py-3 border-t border-slate-700/60 bg-slate-800/60">
        <button
          onClick={onClose}
          className="flex-1 py-2 rounded-lg text-sm text-slate-400 bg-slate-700/60 hover:bg-slate-700 transition-colors"
        >
          إلغاء
        </button>
        <button
          onClick={onSave}
          disabled={saving}
          className="flex-1 py-2 rounded-lg text-sm font-medium text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
          حفظ
        </button>
      </div>
    </div>
  );
}

export function CompoundChildrenTab({
  data,
  onSelectChild,
  onAdd,
  deptLabels,
}: {
  data: ChildrenDataLike;
  onSelectChild: (id: string) => void;
  onAdd?: () => void;
  deptLabels: Record<string, { label: string; color: string }>;
}) {
  const fmt = (n: number) => n.toLocaleString('ar-LY', { maximumFractionDigits: 0 });

  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg bg-rose-500/10 border border-rose-500/30 p-3 text-center">
          <div className="text-xl font-bold text-rose-300">{data.total_children}</div>
          <div className="text-xs text-slate-400 mt-0.5">أصل داخلي</div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-center">
          <div className="text-base font-bold text-emerald-300 leading-tight">{fmt(data.total_cost)}</div>
          <div className="text-xs text-slate-400 mt-0.5">{data.currency} — إجمالي التكلفة</div>
        </div>
      </div>

      {onAdd && (
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-medium
                     bg-rose-500/15 border border-rose-500/30 text-rose-300
                     hover:bg-rose-500/25 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          إضافة أصل داخل المجمع
        </button>
      )}

      {data.departments.length === 0 ? (
        <EmptyState icon={<Boxes className="w-6 h-6" />} text="لا توجد أصول داخلية بعد" />
      ) : (
        <div className="space-y-4">
          {data.departments.map((dept) => {
            const children = data.children_by_department[dept] ?? [];
            const deptInfo = deptLabels[dept] ?? { label: dept, color: 'text-slate-400 bg-slate-500/20 border-slate-500/30' };
            return (
              <div key={dept}>
                <div className={`flex items-center gap-2 mb-2 px-2 py-1 rounded-md border text-xs font-semibold ${deptInfo.color}`}>
                  <LayoutGrid className="w-3 h-3" />
                  {deptInfo.label}
                  <span className="mr-auto opacity-60">{children.length} أصل</span>
                </div>
                <div className="space-y-2 pr-1 border-r border-slate-700/40">
                  {children.map((child) => (
                    <ChildCard key={child.id} child={child} onSelect={() => onSelectChild(child.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChildCard({ child, onSelect }: { child: ChildLike; onSelect: () => void }) {
  const healthColor =
    child.health_score >= 80 ? 'text-emerald-400' :
    child.health_score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-800/50 border border-slate-700/40 hover:border-rose-500/30 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-7 h-7 rounded-lg bg-rose-500/20 border border-rose-500/30 flex items-center justify-center flex-shrink-0">
          <Package className="w-3.5 h-3.5 text-rose-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{child.asset_name}</p>
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-slate-400">{child.asset_type}</span>
            {child.total_cost > 0 && (
              <span className="text-xs text-emerald-400">{child.total_cost.toLocaleString()} LYD</span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className={`text-xs font-mono font-bold ${healthColor}`}>{child.health_score}%</span>
        <button
          onClick={onSelect}
          className="text-xs px-2.5 py-1 rounded-lg bg-slate-700/60 text-slate-300 hover:bg-sky-500/20 hover:text-sky-300 transition-colors"
        >
          تفاصيل
        </button>
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-slate-400 font-medium">{label}</label>
      {children}
    </div>
  );
}
