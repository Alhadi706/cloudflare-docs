'use client';
/**
 * LayerTreePanel — لوحة شجرة الطبقات الاحترافية
 * ==============================================
 * عرض تفاعلي لجميع طبقات المشروع مع إمكانيات:
 * - إظهار/إخفاء الطبقات
 * - إعادة تسمية
 * - تغيير الألوان
 * - حذف
 * - عرض عدد الميزات
 */

import React, { useState } from 'react';
import {
  Eye, EyeOff, Trash2, Edit2, Palette, Plus,
  ChevronDown, ChevronRight, AlertCircle, Loader2,
  MoreVertical, Copy, ArrowUp, ArrowDown, Info
} from 'lucide-react';
import { useLayerStore, type BaseLayer } from '@/store/layerStore';
import { useProjectStore } from '@/store/projectStore';
import { useToast } from '@/components/ToastProvider';
import { workspaceApi } from '@/store/apiService';

interface LayerTreePanelProps {
  projectId?: string;
  onLayerSelected?: (layerId: string) => void;
  canCreateLayer?: boolean;
}

export default function LayerTreePanel({ projectId, onLayerSelected, canCreateLayer = true }: LayerTreePanelProps) {
  const { layers, activeLayerId, activePath, setActiveLayer, toggleLayerVisibility, removeLayer, renameLayer, loadLayers, addLayer, getPathLayers } = useLayerStore();
  const { activeProjectId } = useProjectStore();
  const { showToast } = useToast();

  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(new Set());
  const [renamingLayerId, setRenamingLayerId] = useState<string | null>(null);
  const [newLayerName, setNewLayerName] = useState('');
  const [colorPickingLayerId, setColorPickingLayerId] = useState<string | null>(null);
  const [menuOpenLayerId, setMenuOpenLayerId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const effectiveProjectId = projectId || activeProjectId;
  // Only show layers for the active GIS path
  const pathLayers = getPathLayers();
  const parentLayers = pathLayers.filter(l => !l.parentId);

  // Auto-expand all parent layers with children to show hierarchy immediately
  React.useEffect(() => {
    const parentsWithChildren = new Set<string>();
    parentLayers.forEach(parent => {
      const hasChildren = pathLayers.some(l => l.parentId === parent.id);
      if (hasChildren) {
        parentsWithChildren.add(parent.id);
      }
    });
    setExpandedLayers(parentsWithChildren);
  }, [pathLayers]);

  if (!effectiveProjectId) {
    return (
      <div className="text-center text-xs text-slate-500 p-3">
        اختر مشروعاً أولاً
      </div>
    );
  }

  if (pathLayers.length === 0) {
    const pathLabel = activePath === 'asset' ? 'أصول' : 'مشاريع';
    return (
      <div className="text-center text-xs text-slate-500 p-3 space-y-2">
        <AlertCircle className="w-4 h-4 mx-auto opacity-50" />
        <p>لا توجد طبقات {pathLabel} في هذا المشروع</p>
        {canCreateLayer ? (
          <button
            onClick={async () => {
              if (!effectiveProjectId) return;
              const generatedName = `طبقة جديدة ${new Date().toLocaleTimeString('ar-EG', {
                hour: '2-digit',
                minute: '2-digit'
              })}`;
              try {
                const newId = await addLayer({
                  name: generatedName,
                  projectId: String(effectiveProjectId),
                  layer_type: 'main',
                  layer_category: activePath,
                  description: '',
                  owner_name: 'Engineer',
                  owner_email: '',
                  owner_phone: '',
                });
                if (newId) {
                  setActiveLayer(newId);
                  onLayerSelected?.(newId);
                }
                await loadLayers(String(effectiveProjectId));
                showToast(`تم إنشاء الطبقة "${generatedName}" بنجاح`, 'success');
              } catch (error: any) {
                showToast(`فشل إنشاء الطبقة: ${error?.message || 'خطأ غير معروف'}`, 'error');
              }
            }}
            className="mt-1 inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            إنشاء أول طبقة
          </button>
        ) : (
          <p className="text-[11px] text-amber-400">صلاحية القراءة فقط: تواصل مع مدير المشروع لإنشاء طبقة.</p>
        )}
      </div>
    );
  }

  const handleToggleExpand = (layerId: string) => {
    const newSet = new Set(expandedLayers);
    if (newSet.has(layerId)) {
      newSet.delete(layerId);
    } else {
      newSet.add(layerId);
    }
    setExpandedLayers(newSet);
  };

  const handleRenameLayer = async (layerId: string, oldName: string) => {
    if (!newLayerName.trim() || newLayerName === oldName) {
      setRenamingLayerId(null);
      return;
    }
    const finalName = newLayerName.trim();
    setRenamingLayerId(null);
    setNewLayerName('');
    try {
      await workspaceApi.updateLayer(layerId, { name: finalName });
      renameLayer(layerId, finalName);
      showToast(`✓ تم إعادة التسمية إلى "${finalName}"`, 'success');
    } catch (error: any) {
      showToast(`فشل إعادة التسمية: ${error.message}`, 'error');
    }
  };

  const handleDeleteLayer = async (layerId: string, layerName: string) => {
    if (!confirm(`هل تريد فعلاً حذف الطبقة "${layerName}"؟ سيتم حذف جميع المعالم المرتبطة بها.`)) return;
    try {
      await workspaceApi.deleteLayer(layerId);
      removeLayer(layerId);
      showToast(`✓ تم حذف الطبقة "${layerName}"`, 'success');
    } catch (error: any) {
      // If 404, the layer may already be deleted — remove locally anyway
      if (error.message?.includes('404')) {
        removeLayer(layerId);
        showToast(`✓ تم حذف الطبقة "${layerName}"`, 'success');
      } else {
        showToast(`فشل حذف الطبقة: ${error.message}`, 'error');
      }
    }
  };

  const handleCreateLayer = async () => {
    if (!effectiveProjectId || isCreating) return;
    setIsCreating(true);
    const generatedName = `طبقة ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const newId = await addLayer({
        name: generatedName,
        projectId: String(effectiveProjectId),
        layer_type: 'main',
        layer_category: activePath,
        description: '',
        owner_name: 'Engineer',
        owner_email: '',
        owner_phone: '',
      });
      if (newId) {
        setActiveLayer(newId);
        onLayerSelected?.(newId);
        // Start renaming immediately
        setRenamingLayerId(newId);
        setNewLayerName(generatedName);
      }
      showToast(`✓ تم إنشاء الطبقة — اكتب الاسم المطلوب`, 'success');
    } catch (error: any) {
      showToast(`فشل إنشاء الطبقة: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleCreateChildLayer = async (parentLayerId: string) => {
    if (!effectiveProjectId || isCreating) return;
    setIsCreating(true);
    const generatedName = `بنت - ${new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}`;
    try {
      const newId = await addLayer({
        name: generatedName,
        projectId: String(effectiveProjectId),
        parentId: parentLayerId,
        layer_type: 'child',
        layer_category: activePath,
        description: '',
        owner_name: 'Engineer',
        owner_email: '',
        owner_phone: '',
      });
      if (newId) {
        setActiveLayer(newId);
        onLayerSelected?.(newId);
        setRenamingLayerId(newId);
        setNewLayerName(generatedName);
        setMenuOpenLayerId(null);
        // Auto-expand parent
        const newExpandedSet = new Set(expandedLayers);
        newExpandedSet.add(parentLayerId);
        setExpandedLayers(newExpandedSet);
      }
      showToast(`✓ تم إنشاء الطبقة البنت — اكتب الاسم المطلوب`, 'success');
    } catch (error: any) {
      showToast(`فشل إنشاء الطبقة: ${error?.message || 'خطأ غير معروف'}`, 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleSelectLayer = (layerId: string) => {
    setActiveLayer(layerId);
    onLayerSelected?.(layerId);
  };

  const renderLayer = (layer: BaseLayer, depth = 0) => {
    const isActive = activeLayerId === layer.id;
    const children = pathLayers.filter(l => l.parentId === layer.id);
    const hasChildren = children.length > 0;
    const isExpanded = expandedLayers.has(layer.id);
    const isRenaming = renamingLayerId === layer.id;
    const isColorPicking = colorPickingLayerId === layer.id;
    const isChild = depth > 0;

    const colorClasses: Record<string, string> = {
      'bg-blue-500': 'bg-blue-500',
      'bg-cyan-500': 'bg-cyan-500',
      'bg-sky-500': 'bg-sky-500',
      'bg-emerald-500': 'bg-emerald-500',
      'bg-yellow-500': 'bg-yellow-500',
      'bg-purple-500': 'bg-purple-500',
      'bg-pink-500': 'bg-pink-500',
      'bg-red-500': 'bg-red-500',
      'bg-orange-500': 'bg-orange-500',
      'bg-teal-500': 'bg-teal-500',
    };

    return (
      <div key={layer.id}>
        {/* Layer Row */}
        <div
          onClick={() => handleSelectLayer(layer.id)}
          className={`flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg transition-all cursor-pointer ${
            isChild ? 'mr-4 bg-slate-900/40 border-r-2 border-cyan-500/30' : ''
          } ${
            isActive
              ? 'bg-cyan-500/20 border border-cyan-500/40'
              : 'hover:bg-slate-700/50'
          }`}
          dir="rtl"
        >
          {/* Expand Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (hasChildren) handleToggleExpand(layer.id);
            }}
            className={`p-0.5 rounded text-slate-400 hover:text-white transition ${!hasChildren ? 'opacity-0' : ''}`}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          {/* Visibility Toggle */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleLayerVisibility(layer.id);
            }}
            className="p-0.5 rounded text-slate-400 hover:text-white transition"
            title={layer.visible ? 'إخفاء الطبقة' : 'إظهار الطبقة'}
          >
            {layer.visible ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 opacity-30" />
            )}
          </button>

          {/* Color Indicator */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setColorPickingLayerId(colorPickingLayerId === layer.id ? null : layer.id);
            }}
            className={`w-3 h-3 rounded-full border border-slate-600 hover:border-slate-400 transition ${layer.color || 'bg-blue-500'}`}
            title="تغيير لون الطبقة"
          />

          {/* Layer Name or Rename Input */}
          {isRenaming ? (
            <input
              type="text"
              value={newLayerName}
              onChange={(e) => setNewLayerName(e.target.value)}
              onBlur={() => handleRenameLayer(layer.id, layer.name)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameLayer(layer.id, layer.name);
                if (e.key === 'Escape') setRenamingLayerId(null);
              }}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-xs px-1 py-0.5 rounded bg-slate-800 border border-cyan-500 text-white outline-none"
            />
          ) : (
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-xs font-medium text-slate-200 truncate">{layer.name}</p>
                {/* Parent indicator badge */}
                {hasChildren && (
                  <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-cyan-500/15 text-cyan-300 border border-cyan-500/40 font-bold leading-none">
                    أب
                  </span>
                )}
                {/* Category badge */}
                {layer.layer_category === 'project' ? (
                  <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25 font-bold leading-none">
                    مشروع
                  </span>
                ) : (
                  <span className="shrink-0 text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold leading-none">
                    أصل
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">{layer.featureCount} معالم</p>
            </div>
          )}}

          {/* Menu Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpenLayerId(menuOpenLayerId === layer.id ? null : layer.id);
            }}
            className="p-0.5 rounded text-slate-400 hover:text-white transition"
            title="خيارات الطبقة"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Color Picker */}
        {isColorPicking && (
          <div className="px-3 py-2 grid grid-cols-5 gap-1 bg-slate-800/50 rounded-lg mx-2 my-1">
            {Object.entries(colorClasses).map(([key, className]) => (
              <button
                key={key}
                className={`w-5 h-5 rounded-full border-2 border-slate-600 hover:border-white transition ${className}`}
                title={key}
                onClick={async () => {
                  try {
                    await workspaceApi.updateLayer(layer.id, { color: key });
                    // Update local state
                    useLayerStore.setState(s => ({
                      layers: s.layers.map(l => l.id === layer.id ? { ...l, color: key } : l)
                    }));
                  } catch {
                    // Update locally even if API fails
                    useLayerStore.setState(s => ({
                      layers: s.layers.map(l => l.id === layer.id ? { ...l, color: key } : l)
                    }));
                  }
                  setColorPickingLayerId(null);
                }}
              />
            ))}
          </div>
        )}

        {/* Context Menu */}
        {menuOpenLayerId === layer.id && (
          <div className="px-2 py-1 bg-slate-800/80 rounded-lg mx-2 my-1 border border-slate-700 space-y-0.5">
            <button
              onClick={() => {
                setRenamingLayerId(layer.id);
                setNewLayerName(layer.name);
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition text-right"
            >
              <Edit2 className="w-3 h-3" />
              إعادة تسمية
            </button>

            <button
              onClick={() => {
                // TODO: Duplicate layer
                showToast('هذه الميزة قريباً', 'info');
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition text-right"
            >
              <Copy className="w-3 h-3" />
              نسخ الطبقة
            </button>

            <button
              onClick={() => {
                // TODO: Move layer up
                showToast('إعادة الترتيب قريباً', 'info');
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition text-right"
            >
              <ArrowUp className="w-3 h-3" />
              نقل لأعلى
            </button>

            <button
              onClick={() => {
                // TODO: Move layer down
                showToast('إعادة الترتيب قريباً', 'info');
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition text-right"
            >
              <ArrowDown className="w-3 h-3" />
              نقل لأسفل
            </button>

            <button
              onClick={() => {
                // TODO: Show layer properties
                showToast('خصائص الطبقة قريباً', 'info');
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-slate-700 text-slate-300 transition text-right"
            >
              <Info className="w-3 h-3" />
              معلومات الطبقة
            </button>

            {canCreateLayer && (
              <button
                onClick={() => {
                  handleCreateChildLayer(layer.id);
                }}
                className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-blue-900/30 text-blue-400 transition text-right"
              >
                <Plus className="w-3 h-3" />
                إضافة طبقة بنت
              </button>
            )}

            <div className="border-t border-slate-700 my-1" />

            <button
              onClick={() => {
                handleDeleteLayer(layer.id, layer.name);
                setMenuOpenLayerId(null);
              }}
              className="w-full flex items-center gap-2 text-xs px-2 py-1 rounded hover:bg-red-900/30 text-red-400 transition text-right"
            >
              <Trash2 className="w-3 h-3" />
              حذف الطبقة
            </button>
          </div>
        )}

        {/* Children Layers */}
        {hasChildren && isExpanded && (
          <div className="space-y-1 mt-1">
            {children.map((child) => renderLayer(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {/* Header: title + create button */}
      {canCreateLayer && (
        <div className="flex items-center justify-between px-1 mb-1">
          <span className="text-xs text-slate-500">الطبقات ({pathLayers.length})</span>
          <button
            onClick={handleCreateLayer}
            disabled={isCreating}
            className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded border border-cyan-500/50 text-cyan-300 hover:bg-cyan-500/10 transition disabled:opacity-50"
            title="إنشاء طبقة جديدة"
          >
            {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            طبقة جديدة
          </button>
        </div>
      )}
      {/* Layer list */}
      <div className="overflow-y-auto max-h-64 pr-1 space-y-0.5">
        {parentLayers.map((layer) => renderLayer(layer))}
      </div>
    </div>
  );
}
