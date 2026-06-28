'use client';

import React from 'react';

type SharingSettingsPanelProps = {
  isOpen?: boolean;
  onClose?: () => void;
};

export default function SharingSettingsPanel({ isOpen = false, onClose }: SharingSettingsPanelProps) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-xl rounded-2xl border border-slate-700 bg-slate-900 p-5 text-slate-200">
        <h3 className="text-lg font-semibold">إعدادات المشاركة</h3>
        <p className="mt-2 text-sm text-slate-400">تم تحميل واجهة توافقية لأن ملف الإعدادات التاريخي غير متوفر ضمن النسخ القديمة.</p>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-lg border border-slate-600 px-3 py-2 text-sm hover:bg-slate-800">إغلاق</button>
        </div>
      </div>
    </div>
  );
}
