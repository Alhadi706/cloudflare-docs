'use client';

/**
 * ImportButton — زر الاستيراد العالمي
 * =====================================
 * PHASE GLOBAL-IMPORT-SYSTEM
 *
 * استخدام من أي صفحة:
 *   <ImportButton moduleKey="departments" onSuccess={fetchDepartments} />
 *
 * يقرأ تلقائياً من IMPORT_MODULES[moduleKey]:
 *   - buttonLabel (النص)
 *   - requiresProject / requiresSite (هل يظهر خطوة السياق)
 */

import React, { useState } from 'react';
import { Upload } from 'lucide-react';
import ContextualImportModal from './ContextualImportModal';
import { IMPORT_MODULES } from '@/lib/importModuleRegistry';

interface ImportButtonProps {
  /** مفتاح الوحدة من IMPORT_MODULES */
  moduleKey: string;
  /** callback بعد نجاح الاستيراد — عادةً re-fetch البيانات */
  onSuccess?: () => void;
  /** custom label — يتجاوز buttonLabel من Registry */
  label?: string;
  /** Tailwind class إضافية للزر */
  className?: string;
  tenantId?: string;
}

export default function ImportButton({
  moduleKey,
  onSuccess,
  label,
  className = '',
  tenantId,
}: ImportButtonProps) {
  const [showModal, setShowModal] = useState(false);
  const config = IMPORT_MODULES[moduleKey];

  if (!config) {
    // وحدة غير معرّفة → لا يظهر شيء (لا error في production)
    if (process.env.NODE_ENV === 'development') {
      console.warn(`ImportButton: moduleKey "${moduleKey}" not found in IMPORT_MODULES`);
    }
    return null;
  }

  const buttonLabel = label ?? config.buttonLabel;

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className={`flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors ${className}`}
      >
        <Upload className="w-4 h-4" />
        {buttonLabel}
      </button>

      {showModal && (
        <ContextualImportModal
          moduleKey={moduleKey}
          tenantId={tenantId}
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            setShowModal(false);
            onSuccess?.();
          }}
        />
      )}
    </>
  );
}
