'use client';

import React, { useState } from 'react';
import { X, Info } from 'lucide-react';
import { useWorkspaceStore } from '@/store/workspaceStore';

export default function RightPanel() {
  const [isOpen, setIsOpen] = useState(false);

  const selectedFeatureId = useWorkspaceStore((state) => state.selectedFeatureId);
  const features = useWorkspaceStore((state) => state.features);
  const updateFeatureProperties = useWorkspaceStore((state) => state.updateFeatureProperties);

  const selectedFeature = features.find(f => f.id === selectedFeatureId);

  if (!isOpen) {
    return null; // Don't show button - UnifiedAIAssistant will handle AI interactions
  }

  const handlePropertyChange = (field: string, value: string | number) => {
    if (!selectedFeature) return;
    updateFeatureProperties(selectedFeature.id, { [field]: value });
  };

  return (
    <div className="w-96 bg-gray-900 border-r border-gray-800 flex flex-col h-full shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 px-4 py-4">
        <div className="flex items-center gap-2">
          <Info className="w-5 h-5 text-indigo-400" />
          <span className="font-semibold text-sm text-white">خصائص الأصل المكاني</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Properties Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {!selectedFeature ? (
            <div className="text-center text-gray-500 mt-10">
              <Info className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>قم بتحديد أصل مكاني من الخريطة لعرض وإدارة خصائصه.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="font-semibold text-lg text-white mb-4">بيانات الأصل المكاني</h3>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">المعرف (ID)</label>
                    <input type="text" readOnly value={selectedFeature.id} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-400 cursor-not-allowed" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">اسم الأصل</label>
                    <input type="text" value={selectedFeature.properties.asset_name || ''} onChange={(e) => handlePropertyChange('asset_name', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">نوع الأصل</label>
                    <select value={selectedFeature.properties.asset_type || ''} onChange={(e) => handlePropertyChange('asset_type', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                      <option value="Pipeline">Pipeline (أنبوب)</option>
                      <option value="Pump Station">Pump Station (محطة ضخ)</option>
                      <option value="Valve">Valve (صمام)</option>
                      <option value="Sensor">Sensor (حساس)</option>
                      <option value="Reservoir">Reservoir (خزان)</option>
                      <option value="Electrical Node">Electrical Node (نقطة كهربائية)</option>
                      <option value="Communication Node">Communication Node (نقطة اتصال)</option>
                      <option value="Well">Well (بئر)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">الحالة التشغيلية</label>
                    <select value={selectedFeature.properties.status || 'Active'} onChange={(e) => handlePropertyChange('status', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                      <option value="Maintenance">Maintenance</option>
                      <option value="Planned">Planned</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">نقاط الصحة</label>
                    <input type="number" min="0" max="100" value={selectedFeature.properties.health_score || 100} onChange={(e) => handlePropertyChange('health_score', parseInt(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">تاريخ التركيب</label>
                    <input type="date" value={selectedFeature.properties.installation_date || ''} onChange={(e) => handlePropertyChange('installation_date', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">القسم المالك</label>
                    <input type="text" value={selectedFeature.properties.department_owner || ''} onChange={(e) => handlePropertyChange('department_owner', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">الحالة التشغيلية</label>
                    <select value={selectedFeature.properties.status || 'Active'} onChange={(e) => handlePropertyChange('status', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white">
                      <option value="Active">نشط (Active)</option>
                      <option value="Inactive">غير نشط (Inactive)</option>
                      <option value="Maintenance">صيانة (Maintenance)</option>
                      <option value="Planned">مخطط (Planned)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">مؤشر الصحة (Health Score)</label>
                    <input type="number" min="0" max="100" value={selectedFeature.properties.health_score || 0} onChange={(e) => handlePropertyChange('health_score', parseInt(e.target.value))} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">تاريخ التركيب</label>
                    <input type="date" value={selectedFeature.properties.installation_date || ''} onChange={(e) => handlePropertyChange('installation_date', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">الجهة المالكة (Department Owner)</label>
                    <input type="text" value={selectedFeature.properties.department_owner || ''} onChange={(e) => handlePropertyChange('department_owner', e.target.value)} className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-white" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
    </div>
  );
}
