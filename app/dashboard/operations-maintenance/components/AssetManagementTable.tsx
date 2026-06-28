'use client';

/**
 * Asset Management Table Component
 * جدول إدارة الأصول
 */

import React, { useState } from 'react';
import { Trash2, Eye } from 'lucide-react';
import { LinearAsset } from '@/lib/linear-referencing/types';
import { formatStation } from '@/lib/linear-referencing/engine';

type SortField = 'station' | 'risk' | 'margin' | 'pressure';
type SortDirection = 'asc' | 'desc';

interface AssetManagementTableProps {
  assets: LinearAsset[];
  onAssetClick?: (asset: LinearAsset) => void;
  onDeleteClick?: (assetId: string) => Promise<void>;
  onClassifyAsset?: (assetId: string, relationType: 'main' | 'child') => void;
  selectedAssetId?: string;
  isDeleting?: boolean;
}

export function AssetManagementTable({
  assets,
  onAssetClick,
  onDeleteClick,
  onClassifyAsset,
  selectedAssetId,
  isDeleting = false,
}: AssetManagementTableProps) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('station');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const getHydraulicPressure = (asset: LinearAsset) =>
    asset.technical?.hydraulic_pressure_bar ?? asset.technical?.pressure_bar ?? 0;

  const getPipeGrade = (asset: LinearAsset) =>
    asset.technical?.pipe_bar_grade_bar ?? asset.technical?.pressure_bar ?? 8.0;

  const getMargin = (asset: LinearAsset) => getPipeGrade(asset) - getHydraulicPressure(asset);

  const getRiskRank = (asset: LinearAsset) => {
    const margin = getMargin(asset);
    if (margin <= 0) return 3;
    if (margin <= 0.75) return 2;
    return 1;
  };

  const sortedAssets = [...assets].sort((a, b) => {
    const direction = sortDirection === 'asc' ? 1 : -1;

    if (sortField === 'risk') {
      return (getRiskRank(a) - getRiskRank(b)) * direction;
    }

    if (sortField === 'margin') {
      return (getMargin(a) - getMargin(b)) * direction;
    }

    if (sortField === 'pressure') {
      return (getHydraulicPressure(a) - getHydraulicPressure(b)) * direction;
    }

    return (a.station - b.station) * direction;
  });

  if (assets.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg border border-gray-700 p-8 text-center">
        <p className="text-gray-400">لا توجد أصول مسجلة حالياً</p>
        <p className="text-sm text-gray-500 mt-1">قم برفع ملف CSV أو Excel</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-700 bg-gray-900/70 p-3">
        <label className="text-sm text-gray-300">
          ترتيب حسب
          <select
            value={sortField}
            onChange={(event) => setSortField(event.target.value as SortField)}
            className="ml-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            <option value="station">المحطة</option>
            <option value="risk">الخطر</option>
            <option value="margin">الهامش</option>
            <option value="pressure">الضغط</option>
          </select>
        </label>

        <label className="text-sm text-gray-300">
          الاتجاه
          <select
            value={sortDirection}
            onChange={(event) => setSortDirection(event.target.value as SortDirection)}
            className="ml-2 rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-slate-100"
          >
            <option value="asc">تصاعدي</option>
            <option value="desc">تنازلي</option>
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-700">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700">
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">
                معرّف
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-300">
                الاسم
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                المحطة (م)
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                الارتفاع (م)
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                النوع
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                تصنيف هندسي
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                المصدر
              </th>
              <th className="px-4 py-3 text-center text-sm font-semibold text-gray-300">
                الإجراءات
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedAssets.map((asset) => (
              <React.Fragment key={asset.id}>
                <tr
                  className={`transition-colors ${
                    selectedAssetId === asset.id
                      ? 'bg-blue-900/30 border-l-4 border-blue-500'
                      : 'bg-gray-900/50 hover:bg-gray-900'
                  }`}
                >
                  <td className="px-4 py-3 text-sm font-mono text-blue-400">
                    {asset.equipment_code}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-300">
                    <button
                      onClick={() => setExpandedRow(expandedRow === asset.id ? null : asset.id)}
                      className="font-semibold hover:text-white transition-colors"
                    >
                      {asset.name}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-300">
                    {formatStation(asset.station)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-300">
                    {asset.invert_level.toFixed(2)}
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        asset.relation_type === 'main'
                          ? 'bg-amber-900/50 text-amber-300'
                          : 'bg-green-900/50 text-green-300'
                      }`}
                    >
                      {asset.relation_type === 'main' ? '⭐ أساسي' : '🔗 فرعي'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    <select
                      value={asset.relation_type}
                      onChange={(event) => onClassifyAsset?.(asset.id, event.target.value as 'main' | 'child')}
                      className="rounded-md border border-slate-600 bg-slate-800 px-2 py-1 text-xs text-slate-100"
                    >
                      <option value="main">أساسي</option>
                      <option value="child">فرعي</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-gray-400">
                    {asset.source === 'maintenance_upload' ? '📤 رفع' : '🎨 رسم'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => onAssetClick?.(asset)}
                        className="p-1 hover:bg-blue-600 rounded transition-colors"
                        title="عرض التفاصيل"
                      >
                        <Eye className="w-4 h-4 text-blue-400" />
                      </button>
                      <button
                        onClick={() => onDeleteClick?.(asset.id)}
                        disabled={isDeleting}
                        className="p-1 hover:bg-red-600 rounded transition-colors disabled:opacity-50"
                        title="حذف"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>

                {/* Expanded Row - Technical Details */}
                {expandedRow === asset.id && (
                  <tr className="bg-gray-800/50 border-l-4 border-indigo-500">
                    <td colSpan={8} className="px-4 py-4">
                      <div className="space-y-3">
                        <h4 className="font-semibold text-indigo-300">
                          📋 البيانات الفنية
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                          {/* Parent Asset */}
                          {asset.parent_asset_id && (
                            <TechnicalField
                              label="الأصل الرئيسي"
                              value={asset.parent_asset_id}
                            />
                          )}

                          {/* Technical Attributes */}
                          {asset.technical?.pressure_bar !== undefined && (
                            <TechnicalField
                              label="الضغط"
                              value={`${asset.technical.pressure_bar} bar`}
                            />
                          )}

                          {asset.technical?.hydraulic_pressure_bar !== undefined && (
                            <TechnicalField
                              label="الضغط الهيدروليكي"
                              value={`${asset.technical.hydraulic_pressure_bar} bar`}
                            />
                          )}

                          {asset.technical?.pipe_bar_grade_bar !== undefined && (
                            <TechnicalField
                              label="Pipe Bar Grade"
                              value={`${asset.technical.pipe_bar_grade_bar} bar`}
                            />
                          )}

                          {asset.technical?.hydraulic_pressure_bar !== undefined && asset.technical?.pipe_bar_grade_bar !== undefined && (
                            <TechnicalField
                              label="الهامش الآمن"
                              value={`${(asset.technical.pipe_bar_grade_bar - asset.technical.hydraulic_pressure_bar).toFixed(2)} bar`}
                            />
                          )}

                          {asset.technical?.diameter && (
                            <TechnicalField
                              label="القطر"
                              value={asset.technical.diameter}
                            />
                          )}

                          {asset.technical?.material && (
                            <TechnicalField
                              label="المادة"
                              value={asset.technical.material}
                            />
                          )}

                          {asset.technical?.crown_elevation !== undefined && (
                            <TechnicalField
                              label="ارتفاع التاج"
                              value={`${asset.technical.crown_elevation.toFixed(2)} م`}
                            />
                          )}

                          {asset.technical?.route_sector && (
                            <TechnicalField
                              label="قطاع المسار"
                              value={asset.technical.route_sector}
                            />
                          )}

                          {asset.technical?.maintenance_note && (
                            <TechnicalField
                              label="ملاحظة الصيانة"
                              value={asset.technical.maintenance_note}
                            />
                          )}

                          {asset.technical?.cathodic_status && (
                            <TechnicalField
                              label="الحماية الكاثودية"
                              value={asset.technical.cathodic_status}
                            />
                          )}
                        </div>

                        {/* Geographic Info */}
                        {(asset.latitude || asset.longitude) && (
                          <div className="mt-4 pt-3 border-t border-gray-700">
                            <h5 className="font-semibold text-gray-300 text-sm mb-2">
                              🌍 الإحداثيات
                            </h5>
                            <div className="grid grid-cols-2 gap-2">
                              <div className="text-xs">
                                <span className="text-gray-400">خط العرض:</span>
                                <span className="text-gray-200 ml-2 font-mono">
                                  {asset.latitude?.toFixed(6)}
                                </span>
                              </div>
                              <div className="text-xs">
                                <span className="text-gray-400">خط الطول:</span>
                                <span className="text-gray-200 ml-2 font-mono">
                                  {asset.longitude?.toFixed(6)}
                                </span>
                              </div>
                              <div className="text-xs col-span-2">
                                <span className="text-gray-400">المصدر:</span>
                                <span className="text-gray-200 ml-2">
                                  {asset.coordinate_source === 'lineal'
                                    ? '📍 خطي'
                                    : asset.coordinate_source === 'gps'
                                      ? '🛰️ GPS'
                                      : '🔄 LRS'}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {/* Summary */}
      <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700">
        <p className="text-sm text-gray-300">
          📊 إجمالي الأصول: <span className="font-semibold">{assets.length}</span> |
          ⭐ أساسية: <span className="font-semibold">{assets.filter(a => a.relation_type === 'main').length}</span> |
          🔗 فرعية: <span className="font-semibold">{assets.filter(a => a.relation_type === 'child').length}</span>
        </p>
      </div>
    </div>
  );
}

function TechnicalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-900/50 rounded px-2 py-2 border border-gray-700">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm font-semibold text-gray-200">{value}</p>
    </div>
  );
}
