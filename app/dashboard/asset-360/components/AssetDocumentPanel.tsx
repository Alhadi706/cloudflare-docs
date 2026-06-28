import React from 'react';
import { FileText, Image as ImageIcon, Paperclip } from 'lucide-react';

function docTypeLabel(type?: string): string {
  const t = String(type || '').toLowerCase();
  if (!t) return 'document';
  if (t === 'photo') return 'photo';
  return t;
}

export default function AssetDocumentPanel({
  documents,
}: {
  documents: {
    records: any[];
    photos_and_attachments: any[];
    counters: { total: number; photos: number; attachments: number };
  };
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-indigo-700" />
        <h3 className="text-base font-semibold text-slate-900">Documents</h3>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
        <Metric label="Total" value={documents.counters.total} />
        <Metric label="Photos" value={documents.counters.photos} icon={<ImageIcon className="h-3.5 w-3.5 text-indigo-700" />} />
        <Metric label="Attachments" value={documents.counters.attachments} icon={<Paperclip className="h-3.5 w-3.5 text-indigo-700" />} />
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Document Records</h4>
        <DocList items={documents.records} emptyText="No document records" />
      </div>

      <div className="mt-4">
        <h4 className="text-sm font-semibold text-slate-800">Photos & Attachments</h4>
        <DocList items={documents.photos_and_attachments} emptyText="No photos or attachments" />
      </div>
    </section>
  );
}

function Metric({ label, value, icon }: { label: string; value: number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-2">
      <div className="flex items-center justify-center gap-1 text-slate-500">{icon}<span>{label}</span></div>
      <div className="mt-1 text-sm font-bold text-slate-900">{value}</div>
    </div>
  );
}

function DocList({ items, emptyText }: { items: any[]; emptyText: string }) {
  if (!items.length) {
    return <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{emptyText}</p>;
  }

  return (
    <div className="mt-2 max-h-52 space-y-2 overflow-auto pr-1">
      {items.slice(0, 20).map((doc) => (
        <div key={String(doc.id)} className="rounded-lg border border-slate-200 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold text-slate-900">{doc.title || doc.id}</p>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">{docTypeLabel(doc.doc_type)}</span>
          </div>
          {doc.file_url ? (
            <a href={doc.file_url} target="_blank" rel="noreferrer" className="mt-1 block truncate text-xs text-indigo-700 underline">
              {doc.file_url}
            </a>
          ) : (
            <p className="mt-1 text-xs text-slate-500">No file URL</p>
          )}
        </div>
      ))}
    </div>
  );
}
