'use client';

import React, { useState, useEffect } from 'react';
import { ChevronDown, Trash2, Calendar, Database, RefreshCw } from 'lucide-react';

interface ExtractionRecord {
  id: number;
  job_id: string;
  region_key: string;
  scope_label: string;
  layer_count: number;
  run_date: string;
  layers?: Array<{
    id?: number;
    layer_key: string;
    layer_name: string;
    feature_count: number;
    color: string;
    stats?: {
      total_km?: number;
      poles_towers?: number;
      tower_count?: number;
      building_polygons?: number;
      [k: string]: any;
    };
    geojson?: { type: 'FeatureCollection'; features: any[] };
  }>;
}

/** Returns a short stat label for a layer, similar to the reference screenshot */
function layerStatLabel(layer: ExtractionRecord['layers'][number]): string {
  const s = layer.stats;
  if (!s) return `${layer.feature_count} معلم`;
  if (s.total_km !== undefined && s.total_km > 0)
    return `${layer.feature_count} معلم · ${s.total_km} كم`;
  if (s.building_polygons !== undefined && s.building_polygons > 0)
    return `${layer.feature_count} معلم · ${s.building_polygons} مبنى`;
  if (s.tower_count !== undefined)
    return `${layer.feature_count} معلم · ${s.tower_count} برج`;
  if (s.poles_towers !== undefined)
    return `${layer.feature_count} معلم · ${s.poles_towers} عمود`;
  return `${layer.feature_count} معلم`;
}

interface ExtractionCatalogProps {
  tenantId: string;
  principalAssets?: Array<{ id: string; name: string }>;
  onLoadExtraction?: (extraction: ExtractionRecord) => void;
  onSelectLayers?: (layers: Array<{ layer_key: string; layer_name: string }>) => void;
  onPromoteToPrincipal?: (extraction: ExtractionRecord, selectedLayerKeys: string[]) => Promise<void> | void;
  /** Called when user clicks "حفظ كفروع" — auto-creates a parent group from scope_label.
   *  Receives extraction + selected layer keys. No parent ID required. */
  onSaveAsBranches?: (extraction: ExtractionRecord, selectedLayerKeys: string[]) => Promise<void> | void;
  /** Legacy: kept for backwards compat but no longer shown in UI */
  onPromoteToChild?: (
    extraction: ExtractionRecord,
    selectedLayerKeys: string[],
    parentAssetId: string
  ) => Promise<void> | void;
}

export default function ExtractionCatalog({
  tenantId,
  principalAssets = [],
  onLoadExtraction,
  onSelectLayers,
  onPromoteToPrincipal,
  onSaveAsBranches,
  onPromoteToChild,
}: ExtractionCatalogProps) {
  const [extractions, setExtractions] = useState<ExtractionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [selectedLayers, setSelectedLayers] = useState<Record<number, Set<number>>>({});
  const [promotingId, setPromotingId] = useState<number | null>(null);
  const [savingBranchId, setSavingBranchId] = useState<number | null>(null);
  const [regions, setRegions] = useState<string[]>([]);

  // Load available regions
  useEffect(() => {
    loadExtractions();
  }, [tenantId]);

  const loadExtractions = async (regionKey?: string) => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (regionKey) {
        queryParams.append('regionKey', regionKey);
      }

      const response = await fetch(`/api/extraction-catalog/list?${queryParams}`, {
        headers: {
          'X-Tenant-ID': tenantId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load extractions');
      }

      const data = await response.json();
      const extractionsList = data.extractions || [];
      setExtractions(extractionsList);

      // Extract unique regions
      const uniqueRegions = Array.from(
        new Set(extractionsList.map((e: ExtractionRecord) => e.region_key))
      ).sort();
      setRegions(uniqueRegions as string[]);
    } catch (error) {
      console.error('Error loading extractions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRegionChange = (region: string) => {
    setSelectedRegion(region);
    loadExtractions(region);
    setSelectedLayers(new Set());
  };

  const loadExtractionDetails = async (id: number) => {
    const response = await fetch(`/api/extraction-catalog/load?catalogId=${id}`, {
      headers: {
        'X-Tenant-ID': tenantId,
      },
    });
    if (!response.ok) {
      throw new Error('Failed to load extraction details');
    }
    const data = await response.json();
    const extraction = data.extraction as ExtractionRecord;
    setExtractions(prev => prev.map(item => (item.id === id ? extraction : item)));
    return extraction;
  };

  const handleDeleteExtraction = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!confirm('هل تريد حذف هذا التفكيك من المكتبة؟')) {
      return;
    }

    try {
      const response = await fetch(`/api/extraction-catalog/delete?catalogId=${id}`, {
        method: 'DELETE',
        headers: {
          'X-Tenant-ID': tenantId,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to delete extraction');
      }

      setExtractions(extractions.filter(e => e.id !== id));
      alert('تم حذف التفكيك بنجاح');
    } catch (error) {
      console.error('Error deleting extraction:', error);
      alert('فشل حذف التفكيك');
    }
  };

  const handleLoadExtraction = async (extraction: ExtractionRecord) => {
    try {
      const fullExtraction = extraction.layers?.length
        ? extraction
        : await loadExtractionDetails(extraction.id);
      if (onLoadExtraction) {
        onLoadExtraction(fullExtraction);
      }
    } catch (error) {
      console.error('Error loading extraction details:', error);
      alert('فشل تحميل تفاصيل التفكيك');
    }
  };

  const toggleLayerSelection = (extractionId: number, layerId: number) => {
    setSelectedLayers(prev => {
      const cur = new Set(prev[extractionId] || []);
      if (cur.has(layerId)) cur.delete(layerId); else cur.add(layerId);
      return { ...prev, [extractionId]: cur };
    });
  };

  const getSelected = (extractionId: number) => selectedLayers[extractionId] || new Set<number>();

  const handleApplyLayers = (extraction: ExtractionRecord) => {
    if (!extraction.layers) return;
    const sel = getSelected(extraction.id);
    const chosen = extraction.layers.filter((l, idx) => sel.has(l.id ?? idx));
    if (onSelectLayers) {
      onSelectLayers(chosen.map(l => ({ layer_key: l.layer_key, layer_name: l.layer_name })));
    }
  };

  const resolveTargetLayerKeys = (extraction: ExtractionRecord): string[] => {
    const sel = getSelected(extraction.id);
    const selected = (extraction.layers || [])
      .filter((l, idx) => sel.has(l.id ?? idx))
      .map(l => l.layer_key);
    return selected.length > 0 ? selected : (extraction.layers || []).map(l => l.layer_key);
  };

  const handlePromoteExtraction = async (extraction: ExtractionRecord) => {
    if (!onPromoteToPrincipal) return;
    setPromotingId(extraction.id);
    try {
      const full = extraction.layers?.length ? extraction : await loadExtractionDetails(extraction.id);
      await onPromoteToPrincipal(full, resolveTargetLayerKeys(full));
      setSelectedLayers(prev => ({ ...prev, [extraction.id]: new Set() }));
    } catch (error) {
      console.error('Error promoting extraction to principal layers:', error);
      alert('فشل اعتماد التفكيك كطبقة أساسية');
    } finally {
      setPromotingId(null);
    }
  };

  const handleSaveAsBranches = async (extraction: ExtractionRecord) => {
    const handler = onSaveAsBranches ?? (onPromoteToChild
      ? (e: ExtractionRecord, keys: string[]) => onPromoteToChild(e, keys, 'auto')
      : null);
    if (!handler) return;
    setSavingBranchId(extraction.id);
    try {
      const full = extraction.layers?.length ? extraction : await loadExtractionDetails(extraction.id);
      await handler(full, resolveTargetLayerKeys(full));
      setSelectedLayers(prev => ({ ...prev, [extraction.id]: new Set() }));
    } catch (error) {
      console.error('Error saving extraction as branches:', error);
      alert('فشل حفظ الطبقات كفروع');
    } finally {
      setSavingBranchId(null);
    }
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Region Filter */}
      <div className="flex gap-2">
        <select
          value={selectedRegion}
          onChange={e => handleRegionChange(e.target.value)}
          className="flex-1 px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500"
        >
          <option value="">جميع المناطق</option>
          {regions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>
        <button
          onClick={() => loadExtractions(selectedRegion)}
          disabled={loading}
          className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-slate-200 text-sm disabled:opacity-40 hover:bg-slate-600 transition flex items-center gap-1"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Extractions List */}
      <div className="flex flex-col gap-2 flex-1 min-h-0 overflow-y-auto">
        {extractions.length === 0 ? (
          <div className="p-4 text-center text-slate-400 text-sm">
            {loading ? 'جاري التحميل...' : 'لا توجد تفكيكات محفوظة'}
          </div>
        ) : (
          extractions.map(extraction => {
            const sel = getSelected(extraction.id);
            return (
              <div
                key={extraction.id}
                className="border border-slate-600 rounded-lg overflow-hidden"
              >
                {/* Header row */}
                <div
                  onClick={async () => {
                    const nextId = expandedId === extraction.id ? null : extraction.id;
                    setExpandedId(nextId);
                    if (nextId && (!extraction.layers || extraction.layers.length === 0)) {
                      try { await loadExtractionDetails(extraction.id); } catch {}
                    }
                  }}
                  className="flex items-center justify-between p-3 bg-slate-800/50 hover:bg-slate-800 cursor-pointer transition"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <ChevronDown
                      size={16}
                      className={`text-slate-400 transition-transform ${expandedId === extraction.id ? 'rotate-180' : ''}`}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium text-sm truncate">{extraction.scope_label}</div>
                      <div className="flex items-center gap-3 text-xs text-slate-400 mt-0.5">
                        <span className="flex items-center gap-1"><Database size={11} />{extraction.layer_count} طبقة</span>
                        <span className="flex items-center gap-1"><Calendar size={11} />{new Date(extraction.run_date).toLocaleDateString('ar-EG')}</span>
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={e => handleDeleteExtraction(extraction.id, e)}
                    title="حذف التفكيك"
                    className="p-1.5 text-slate-500 hover:text-red-400 transition shrink-0"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Expanded: layer list + action buttons */}
                {expandedId === extraction.id && extraction.layers && (
                  <div className="bg-slate-900/50 border-t border-slate-700 p-3 flex flex-col gap-3">
                    <div className="text-xs text-slate-400">اختر الطبقات للعرض:</div>

                    <div className="flex flex-col gap-1 max-h-52 overflow-y-auto">
                      {extraction.layers.map((layer, idx) => {
                        const key = layer.id ?? idx;
                        return (
                          <label
                            key={`${extraction.id}-${layer.layer_key}-${idx}`}
                            className="flex items-center gap-2 cursor-pointer hover:bg-slate-800/50 px-2 py-1.5 rounded transition"
                          >
                            <input
                              type="checkbox"
                              checked={sel.has(key)}
                              onChange={() => toggleLayerSelection(extraction.id, key)}
                              className="w-4 h-4 rounded border-slate-600 bg-slate-700 cursor-pointer accent-cyan-500"
                            />
                            <span
                              className="w-3 h-3 rounded-sm shrink-0"
                              style={{ backgroundColor: layer.color || '#38bdf8' }}
                            />
                            <span className="flex-1 text-white text-sm truncate">{layer.layer_name}</span>
                            <span className="text-slate-400 text-xs shrink-0">{layerStatLabel(layer)}</span>
                          </label>
                        );
                      })}
                    </div>

                    {/* 3 action buttons in one row */}
                    <div className="flex gap-2 pt-2 border-t border-slate-700">
                      {/* Load All */}
                      <button
                        onClick={() => { void handleLoadExtraction(extraction); }}
                        className="flex-1 px-2 py-2 bg-emerald-600/20 border border-emerald-500/40 rounded text-emerald-200 text-xs hover:bg-emerald-600/30 transition"
                      >
                        تحميل الكل
                      </button>

                      {/* Save as Branches */}
                      {(onSaveAsBranches || onPromoteToChild) && (
                        <button
                          onClick={() => { void handleSaveAsBranches(extraction); }}
                          disabled={savingBranchId === extraction.id}
                          className="flex-1 px-2 py-2 bg-amber-600/20 border border-amber-500/40 rounded text-amber-200 text-xs hover:bg-amber-600/30 transition disabled:opacity-40"
                        >
                          {savingBranchId === extraction.id
                            ? 'جاري الحفظ...'
                            : sel.size > 0
                              ? `حفظ المحدد كفروع (${sel.size})`
                              : 'حفظ الكل كروع'}
                        </button>
                      )}

                      {/* Adopt as Base Layer */}
                      {onPromoteToPrincipal && (
                        <button
                          onClick={() => { void handlePromoteExtraction(extraction); }}
                          disabled={promotingId === extraction.id}
                          className="flex-1 px-2 py-2 bg-cyan-600/20 border border-cyan-500/40 rounded text-cyan-200 text-xs hover:bg-cyan-600/30 transition disabled:opacity-40"
                        >
                          {promotingId === extraction.id
                            ? 'جاري الاعتماد...'
                            : sel.size > 0
                              ? `اعتماد المحدد (${sel.size})`
                              : 'اعتماد الكل كطبقة أساسية'}
                        </button>
                      )}
                    </div>

                    {/* Apply selected to preview */}
                    {sel.size > 0 && (
                      <button
                        onClick={() => handleApplyLayers(extraction)}
                        className="w-full px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 rounded text-blue-200 text-xs hover:bg-blue-600/30 transition"
                      >
                        عرض المحدد على الخريطة ({sel.size})
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
