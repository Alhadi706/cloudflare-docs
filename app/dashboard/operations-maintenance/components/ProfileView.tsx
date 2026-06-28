'use client';

/**
 * Profile View Component - Linear Reference Visualization
 * عرض البروفايل - تصور النظام الخطي مع Recharts
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Area,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Maximize2, Minimize2, MoveHorizontal, Ruler, ZoomIn, ZoomOut } from 'lucide-react';
import { LinearAsset } from '@/lib/linear-referencing/types';
import { calculateProfileExtent, formatStation } from '@/lib/linear-referencing/engine';

interface ProfileViewProps {
  assets: LinearAsset[];
  routeName?: string;
  onAssetClick?: (asset: LinearAsset) => void;
  selectedAssetId?: string;
}

interface ProfilePoint {
  station: number;
  stationFormatted: string;
  elevation: number;
  assetId: string;
  equipmentCode: string;
  name: string;
  relationshipType: 'main' | 'child';
  ema20?: number;
  ema50?: number;
  bbUpper?: number;
  bbLower?: number;
}

export function ProfileView({
  assets,
  routeName = 'مسار النهر الصناعي',
  onAssetClick,
  selectedAssetId,
}: ProfileViewProps) {
  const [hoveredAsset, setHoveredAsset] = useState<string | null>(null);
  const [showEma20, setShowEma20] = useState(true);
  const [showEma50, setShowEma50] = useState(true);
  const [showBands, setShowBands] = useState(false);
  const [showPoints, setShowPoints] = useState(false);
  const [windowSize, setWindowSize] = useState(350);
  const [windowStart, setWindowStart] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [stationCursor, setStationCursor] = useState(0);
  const [pickMode, setPickMode] = useState<'none' | 'A' | 'B'>('none');
  const [measureAId, setMeasureAId] = useState<string | null>(null);
  const [measureBId, setMeasureBId] = useState<string | null>(null);
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartInteractiveRef = useRef<HTMLDivElement | null>(null);
  const panSessionRef = useRef<{ active: boolean; startX: number; startWindowStart: number }>({
    active: false,
    startX: 0,
    startWindowStart: 0,
  });

  const calculateEma = (values: number[], period: number): (number | undefined)[] => {
    const result: (number | undefined)[] = new Array(values.length).fill(undefined);
    if (values.length < period) return result;
    const multiplier = 2 / (period + 1);
    let prevEma = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
    result[period - 1] = prevEma;
    for (let index = period; index < values.length; index++) {
      const ema = (values[index] - prevEma) * multiplier + prevEma;
      result[index] = ema;
      prevEma = ema;
    }
    return result;
  };

  const calculateBands = (values: number[], period: number, sigma: number): Array<{ upper?: number; lower?: number }> => {
    const result = new Array(values.length).fill(null).map(() => ({ upper: undefined, lower: undefined }));
    if (values.length < period) return result;
    for (let index = period - 1; index < values.length; index++) {
      const window = values.slice(index - period + 1, index + 1);
      const mean = window.reduce((sum, value) => sum + value, 0) / period;
      const variance = window.reduce((sum, value) => sum + (value - mean) ** 2, 0) / period;
      const stdDev = Math.sqrt(variance);
      result[index] = {
        upper: mean + sigma * stdDev,
        lower: mean - sigma * stdDev,
      };
    }
    return result;
  };

  const profileData = useMemo<ProfilePoint[]>(() => {
    const base = [...assets]
      .sort((left, right) => left.station - right.station)
      .map((asset) => ({
        station: asset.station,
        stationFormatted: formatStation(asset.station),
        elevation: asset.invert_level,
        assetId: asset.id,
        equipmentCode: asset.equipment_code,
        name: asset.name,
        relationshipType: asset.relation_type,
      }));

    const elevations = base.map((point) => point.elevation);
    const ema20 = calculateEma(elevations, 20);
    const ema50 = calculateEma(elevations, 50);
    const bands = calculateBands(elevations, 20, 2);

    return base.map((point, index) => ({
      ...point,
      ema20: ema20[index],
      ema50: ema50[index],
      bbUpper: bands[index].upper,
      bbLower: bands[index].lower,
    }));
  }, [assets]);

  const extent = useMemo(() => calculateProfileExtent(assets), [assets]);
  const mainAssets = profileData.filter((point) => point.relationshipType === 'main');
  const childAssets = profileData.filter((point) => point.relationshipType === 'child');

  useEffect(() => {
    const suggestedWindow = Math.max(80, Math.min(350, profileData.length));
    setWindowSize(suggestedWindow);
    setWindowStart(0);
  }, [profileData.length]);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const maxStart = Math.max(0, profileData.length - windowSize);
  const safeStart = Math.min(windowStart, maxStart);
  const visibleData = profileData.slice(safeStart, safeStart + windowSize);

  useEffect(() => {
    if (visibleData.length === 0) return;
    const minVisible = visibleData[0].station;
    const maxVisible = visibleData[visibleData.length - 1].station;
    if (stationCursor < minVisible || stationCursor > maxVisible) {
      setStationCursor(minVisible);
    }
  }, [visibleData, stationCursor]);

  const visibleMainAssets = visibleData.filter((point) => point.relationshipType === 'main');
  const visibleChildAssets = visibleData.filter((point) => point.relationshipType === 'child');

  const cursorPoint = useMemo(() => {
    if (visibleData.length === 0) return null;
    let nearest = visibleData[0];
    let minDistance = Math.abs(visibleData[0].station - stationCursor);
    for (const point of visibleData) {
      const distance = Math.abs(point.station - stationCursor);
      if (distance < minDistance) {
        nearest = point;
        minDistance = distance;
      }
    }
    return nearest;
  }, [visibleData, stationCursor]);

  const measureA = useMemo(
    () => profileData.find((point) => point.assetId === measureAId) || null,
    [profileData, measureAId]
  );
  const measureB = useMemo(
    () => profileData.find((point) => point.assetId === measureBId) || null,
    [profileData, measureBId]
  );

  const measureStats = useMemo(() => {
    if (!measureA || !measureB) return null;
    const distance = Math.abs(measureB.station - measureA.station);
    const deltaElevation = measureB.elevation - measureA.elevation;
    const slopePercent = distance > 0 ? (deltaElevation / distance) * 100 : 0;
    return { distance, deltaElevation, slopePercent };
  }, [measureA, measureB]);

  const handleMapSelect = (assetId: string) => {
    const point = profileData.find((item) => item.assetId === assetId);
    if (!point) return;

    if (pickMode === 'A') {
      setMeasureAId(assetId);
      setPickMode('none');
    } else if (pickMode === 'B') {
      setMeasureBId(assetId);
      setPickMode('none');
    }

    setStationCursor(point.station);
    const asset = assets.find((item) => item.id === assetId);
    if (asset && onAssetClick) onAssetClick(asset);
  };

  const toggleFullscreen = async () => {
    const container = chartShellRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      await container.requestFullscreen();
      return;
    }

    if (document.fullscreenElement) {
      await document.exitFullscreen();
    }
  };

  const handleWheelZoom = (event: React.WheelEvent<HTMLDivElement>) => {
    if (profileData.length <= 2) return;
    event.preventDefault();

    const rect = chartInteractiveRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const pointerRatio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const anchorIndex = Math.round(safeStart + pointerRatio * Math.max(0, windowSize - 1));

    const zoomIn = event.deltaY < 0;
    const nextSize = zoomIn
      ? Math.max(12, Math.floor(windowSize * 0.82))
      : Math.min(profileData.length, Math.ceil(windowSize * 1.22));

    if (nextSize === windowSize) return;

    const proposedStart = Math.round(anchorIndex - pointerRatio * nextSize);
    const maxProposedStart = Math.max(0, profileData.length - nextSize);
    const clampedStart = Math.max(0, Math.min(proposedStart, maxProposedStart));

    setWindowSize(nextSize);
    setWindowStart(clampedStart);
  };

  const handlePanStart = (event: React.MouseEvent<HTMLDivElement>) => {
    panSessionRef.current = {
      active: true,
      startX: event.clientX,
      startWindowStart: safeStart,
    };
  };

  const handlePanMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const pan = panSessionRef.current;
    if (!pan.active) return;

    const rect = chartInteractiveRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0) return;

    const deltaX = event.clientX - pan.startX;
    const ratio = deltaX / rect.width;
    const shiftPoints = Math.round(ratio * windowSize);
    const maxAllowedStart = Math.max(0, profileData.length - windowSize);
    const nextStart = Math.max(0, Math.min(pan.startWindowStart - shiftPoints, maxAllowedStart));
    setWindowStart(nextStart);
  };

  const handlePanEnd = () => {
    panSessionRef.current.active = false;
  };

  if (assets.length === 0) {
    return (
      <div className="flex h-96 items-center justify-center rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800">
        <div className="text-center">
          <div className="mb-2 text-gray-400">📊 لا توجد بيانات للعرض</div>
          <p className="text-sm text-gray-500">قم برفع ملف CSV أو Excel لبدء</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-blue-700 bg-gradient-to-r from-blue-900 to-indigo-900 p-4">
        <h2 className="mb-1 text-xl font-bold text-white">{routeName}</h2>
        <p className="text-sm text-blue-200">عرض خطي: المحطات ({profileData.length}) ÷ الارتفاع</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setShowEma20((current) => !current)}
            className={`rounded-md px-3 py-1 text-xs font-semibold border ${
              showEma20 ? 'border-cyan-400/60 text-cyan-200 bg-cyan-900/30' : 'border-slate-600 text-slate-300 bg-slate-900/50'
            }`}
          >
            EMA 20
          </button>
          <button
            onClick={() => setShowEma50((current) => !current)}
            className={`rounded-md px-3 py-1 text-xs font-semibold border ${
              showEma50 ? 'border-fuchsia-400/60 text-fuchsia-200 bg-fuchsia-900/30' : 'border-slate-600 text-slate-300 bg-slate-900/50'
            }`}
          >
            EMA 50
          </button>
          <button
            onClick={() => setShowBands((current) => !current)}
            className={`rounded-md px-3 py-1 text-xs font-semibold border ${
              showBands ? 'border-amber-400/60 text-amber-200 bg-amber-900/30' : 'border-slate-600 text-slate-300 bg-slate-900/50'
            }`}
          >
            Bollinger Bands
          </button>
          <button
            onClick={() => setShowPoints((current) => !current)}
            className={`rounded-md px-3 py-1 text-xs font-semibold border ${
              showPoints ? 'border-emerald-400/60 text-emerald-200 bg-emerald-900/30' : 'border-slate-600 text-slate-300 bg-slate-900/50'
            }`}
          >
            نقاط الأصول
          </button>
          <button
            onClick={toggleFullscreen}
            className="rounded-md px-3 py-1 text-xs font-semibold border border-slate-500 text-slate-200 bg-slate-900/60 flex items-center gap-1"
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            {isFullscreen ? 'إغلاق التكبير' : 'تكبير التشارت'}
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-indigo-700/30 bg-slate-900/60 p-3 flex flex-col md:flex-row gap-4 items-center">
        <div className="flex-1 flex flex-col w-full">
          <div className="text-xs text-indigo-200 mb-1 flex items-center justify-between">
            <span className="flex items-center gap-1"><MoveHorizontal className="w-3 h-3" /> مؤشر المحطة (Station Cursor)</span>
            <span>
              {cursorPoint
                ? `${cursorPoint.name} | ${formatStation(cursorPoint.station)} | إرتفاع ${(cursorPoint.elevation || 0).toFixed(2)}م`
                : 'لا توجد نقطة'}
            </span>
          </div>
          <input
            type="range"
            min={visibleData.length ? visibleData[0].station : 0}
            max={visibleData.length ? visibleData[visibleData.length - 1].station : 1}
            step={1}
            value={stationCursor}
            onChange={(event) => setStationCursor(Number(event.target.value))}
            className="w-full h-1.5 bg-indigo-950 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => setStationCursor((current) => Math.max(visibleData[0]?.station || 0, current - 1000))}
            className="rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors"
          >
            -1km
          </button>
          <button
            onClick={() => setStationCursor((current) => Math.min(visibleData[visibleData.length - 1]?.station || current, current + 1000))}
            className="rounded-md border border-slate-600 bg-slate-800 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-100 transition-colors"
          >
            +1km
          </button>
        </div>
      </div>

      <div ref={chartShellRef} className={`rounded-lg border border-gray-700 bg-gray-900 p-4 ${isFullscreen ? 'h-screen' : ''}`}>
        <div className="mb-2 text-[11px] text-slate-400 flex items-center gap-3">
          <span className="flex items-center gap-1"><ZoomIn className="w-3 h-3" /> تكبير بالعجلة فوق التشارت</span>
          <span className="flex items-center gap-1"><MoveHorizontal className="w-3 h-3" /> سحب بالماوس يمين/يسار للتتبع</span>
        </div>
        <div
          ref={chartInteractiveRef}
          onWheel={handleWheelZoom}
          onMouseDown={handlePanStart}
          onMouseMove={handlePanMove}
          onMouseUp={handlePanEnd}
          onMouseLeave={handlePanEnd}
          className="touch-none cursor-grab active:cursor-grabbing"
        >
        <ResponsiveContainer width="100%" height={isFullscreen ? 900 : 680}>
          <ComposedChart data={visibleData} margin={{ top: 20, right: 20, bottom: 60, left: 80 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
            <XAxis
              type="number"
              dataKey="station"
              name="المحطة (Station)"
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              label={{
                value: 'المسافة على الخط (م)',
                position: 'insideBottom',
                offset: -10,
                fill: '#9CA3AF',
              }}
            />
            <YAxis
              type="number"
              dataKey="elevation"
              name="الارتفاع (Elevation)"
              stroke="#6B7280"
              tick={{ fill: '#9CA3AF', fontSize: 12 }}
              domain={[extent.minElevation, extent.maxElevation]}
              label={{
                value: 'الارتفاع (م)',
                angle: -90,
                position: 'insideLeft',
                fill: '#9CA3AF',
              }}
            />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#60A5FA' }}
              contentStyle={{
                backgroundColor: '#1F2937',
                border: '1px solid #4B5563',
                borderRadius: '8px',
                color: '#fff',
              }}
              labelFormatter={(value) => `المحطة: ${formatStation(Number(value))} م`}
              formatter={(value: number, name) => {
                if (!Number.isFinite(value)) return ['-', name];
                return [Number(value).toFixed(3), name];
              }}
            />
            <Legend verticalAlign="top" height={36} wrapperStyle={{ paddingBottom: '20px' }} />

            {cursorPoint && (
              <ReferenceLine
                x={cursorPoint.station}
                stroke="#60A5FA"
                strokeWidth={1}
                strokeDasharray="4 4"
                label={{ value: 'Cursor', position: 'top', fill: '#93C5FD', fontSize: 11 }}
              />
            )}
            {measureA && (
              <ReferenceLine
                x={measureA.station}
                stroke="#22C55E"
                strokeWidth={1}
                strokeDasharray="2 2"
                label={{ value: 'A', position: 'top', fill: '#86EFAC', fontSize: 11 }}
              />
            )}
            {measureB && (
              <ReferenceLine
                x={measureB.station}
                stroke="#EF4444"
                strokeWidth={1}
                strokeDasharray="2 2"
                label={{ value: 'B', position: 'top', fill: '#FCA5A5', fontSize: 11 }}
              />
            )}

            {showBands && (
              <>
                <Area
                  type="monotone"
                  dataKey="bbUpper"
                  stroke="#F59E0B"
                  fill="#F59E0B"
                  fillOpacity={0.06}
                  dot={false}
                  isAnimationActive={false}
                  name="Bollinger Upper"
                />
                <Area
                  type="monotone"
                  dataKey="bbLower"
                  stroke="#F59E0B"
                  fill="#0F172A"
                  fillOpacity={1}
                  dot={false}
                  isAnimationActive={false}
                  name="Bollinger Lower"
                />
              </>
            )}

            <Line
              type="monotone"
              dataKey="elevation"
              name="منحنى البروفايل"
              stroke="#F5C242"
              strokeWidth={1.35}
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
            {showEma20 && (
              <Line
                type="monotone"
                dataKey="ema20"
                name="EMA 20"
                stroke="#22D3EE"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {showEma50 && (
              <Line
                type="monotone"
                dataKey="ema50"
                name="EMA 50"
                stroke="#E879F9"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}
            {showPoints && (
              <Scatter
                name="أصول أساسية"
                data={visibleMainAssets}
                fill="#F59E0B"
                shape="circle"
                onClick={(point: ProfilePoint) => {
                  const asset = assets.find((item) => item.id === point.assetId);
                  if (asset && onAssetClick) onAssetClick(asset);
                }}
                onMouseEnter={(point: ProfilePoint) => setHoveredAsset(point.assetId)}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                {visibleMainAssets.map((point) => (
                  <Cell
                    key={point.assetId}
                    fill={
                      selectedAssetId === point.assetId
                        ? '#EF4444'
                        : hoveredAsset === point.assetId
                          ? '#FBBF24'
                          : '#F59E0B'
                    }
                    r={3}
                    opacity={selectedAssetId && selectedAssetId !== point.assetId ? 0.3 : 1}
                  />
                ))}
              </Scatter>
            )}
            {showPoints && visibleChildAssets.length > 0 && (
              <Scatter
                name="أصول فرعية"
                data={visibleChildAssets}
                fill="#10B981"
                shape="diamond"
                onClick={(point: ProfilePoint) => {
                  const asset = assets.find((item) => item.id === point.assetId);
                  if (asset && onAssetClick) onAssetClick(asset);
                }}
                onMouseEnter={(point: ProfilePoint) => setHoveredAsset(point.assetId)}
                onMouseLeave={() => setHoveredAsset(null)}
              >
                {visibleChildAssets.map((point) => (
                  <Cell
                    key={point.assetId}
                    fill={
                      selectedAssetId === point.assetId
                        ? '#EF4444'
                        : hoveredAsset === point.assetId
                          ? '#34D399'
                          : '#10B981'
                    }
                    r={3}
                    opacity={selectedAssetId && selectedAssetId !== point.assetId ? 0.3 : 1}
                  />
                ))}
              </Scatter>
            )}
          </ComposedChart>
        </ResponsiveContainer>
        </div>
      </div>

      <LinearRouteMap
        points={profileData}
        selectedAssetId={selectedAssetId}
        measureAId={measureAId || undefined}
        measureBId={measureBId || undefined}
        pickMode={pickMode}
        onSelect={handleMapSelect}
        windowStart={safeStart}
        windowSize={windowSize}
        onWindowChange={(newStart) => setWindowStart(newStart)}
      />

      <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-emerald-200 text-sm font-semibold">
            <Ruler className="w-4 h-4" />
            قياس مقطعي هندسي (A/B)
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setPickMode('A')}
              className={`rounded-md px-3 py-1 text-xs font-semibold border ${pickMode === 'A' ? 'border-green-400 bg-green-900/40 text-green-100' : 'border-slate-600 bg-slate-900 text-slate-200'}`}
            >
              اختر نقطة A
            </button>
            <button
              onClick={() => setPickMode('B')}
              className={`rounded-md px-3 py-1 text-xs font-semibold border ${pickMode === 'B' ? 'border-red-400 bg-red-900/40 text-red-100' : 'border-slate-600 bg-slate-900 text-slate-200'}`}
            >
              اختر نقطة B
            </button>
            <button
              onClick={() => {
                setMeasureAId(null);
                setMeasureBId(null);
                setPickMode('none');
              }}
              className="rounded-md px-3 py-1 text-xs font-semibold border border-slate-600 bg-slate-900 text-slate-200"
            >
              مسح القياس
            </button>
          </div>
        </div>

        <div className="mt-3 grid md:grid-cols-5 gap-2 text-xs">
          <div className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-slate-200">
            A: {measureA ? `${measureA.name} (${formatStation(measureA.station)})` : 'غير محدد'}
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-slate-200">
            B: {measureB ? `${measureB.name} (${formatStation(measureB.station)})` : 'غير محدد'}
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-slate-200">
            المسافة: {measureStats ? `${measureStats.distance.toFixed(2)} م` : '-'}
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-slate-200">
            Δ المنسوب: {measureStats ? `${measureStats.deltaElevation.toFixed(3)} م` : '-'}
          </div>
          <div className="rounded-md border border-slate-700 bg-slate-900/70 p-2 text-slate-200">
            الانحدار: {measureStats ? `${measureStats.slopePercent.toFixed(4)} %` : '-'}
          </div>
        </div>
        <p className="mt-2 text-xs text-emerald-100/80">لاختيار نقاط القياس: اضغط "اختر A" أو "اختر B" ثم انقر نقطة على الخريطة الخطية.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="إجمالي الأصول" value={assets.length.toString()} icon="📦" />
        <StatCard label="أصول أساسية" value={mainAssets.length.toString()} icon="⭐" />
        <StatCard label="أصول فرعية" value={childAssets.length.toString()} icon="🔗" />
        <StatCard label="طول المسار" value={`${(extent.maxStation - extent.minStation).toFixed(1)} م`} icon="📏" />
      </div>
    </div>
  );
}

interface LinearRouteMapProps {
  points: ProfilePoint[];
  selectedAssetId?: string;
  measureAId?: string;
  measureBId?: string;
  pickMode: 'none' | 'A' | 'B';
  onSelect?: (assetId: string) => void;
  // Window context:
  windowStart: number;
  windowSize: number;
  onWindowChange: (newStart: number) => void;
}

function LinearRouteMap({
  points,
  selectedAssetId,
  measureAId,
  measureBId,
  pickMode,
  onSelect,
  windowStart,
  windowSize,
  onWindowChange,
}: LinearRouteMapProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // ── Zoom / Pan ────────────────────────────────────────────────────────────
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [vb, setVb] = useState({ x: 0, y: -20, w: 1200, h: 420 });
  const vbRef = useRef({ x: 0, y: -20, w: 1200, h: 420 });
  vbRef.current = vb; // always fresh (no effect needed)
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const cv = vbRef.current;
      const svgX = cv.x + ((e.clientX - rect.left) / rect.width) * cv.w;
      const svgY = cv.y + ((e.clientY - rect.top) / rect.height) * cv.h;
      const factor = e.deltaY < 0 ? 0.75 : 1.33;
      const newW = Math.min(2800, Math.max(60, cv.w * factor));
      const newH = newW * (420 / 1200);
      const newX = svgX - (svgX - cv.x) * (newW / cv.w);
      const newY = svgY - (svgY - cv.y) * (newH / cv.h);
      const newVb = {
        x: Math.max(-100, Math.min(1100, newX)),
        y: Math.max(-100, Math.min(300, newY)),
        w: newW,
        h: newH,
      };
      vbRef.current = newVb;
      setVb(newVb);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  // ─────────────────────────────────────────────────────────────────────────

  const minStation = points.length ? points[0].station : 0;
  const maxStation = points.length ? points[points.length - 1].station : 1;
  const span = Math.max(1, maxStation - minStation);

  // SVG internal dimensions
  const SW = 1200;
  const SH = 380;
  const LP = 50;
  const RP = 50;
  const PIPE_CY = 190;
  const PIPE_H = 30;
  const PIPE_TOP = PIPE_CY - PIPE_H / 2;
  const PIPE_BOT = PIPE_CY + PIPE_H / 2;
  const PIPE_W = SW - LP - RP;

  // Viewport window overlay
  const vpStart = points[Math.min(windowStart, Math.max(0, points.length - 1))];
  const vpEnd = points[Math.min(windowStart + windowSize - 1, Math.max(0, points.length - 1))];
  const vpX1 = vpStart ? LP + ((vpStart.station - minStation) / span) * PIPE_W : LP;
  const vpX2 = vpEnd ? LP + ((vpEnd.station - minStation) / span) * PIPE_W : LP + PIPE_W;
  const vpW = Math.max(6, vpX2 - vpX1);

  const toX = (station: number) => LP + ((station - minStation) / span) * PIPE_W;

  const classifyCode = (code: string): 'valve' | 'pump' | 'tank' | 'default' => {
    const c = code.toUpperCase();
    if (c.includes('SAV') || c.includes('/V') || c.includes('BV') || c.includes('GV') || c.includes('CV') || c.includes('PRV') || c.includes('ARV')) return 'valve';
    if (c.includes('P/S') || c.includes('PS/') || c.includes('PMP') || c.includes('PUMP')) return 'pump';
    if (c.includes('TANK') || c.includes('RES') || c.includes('ST/') || c.includes('SUMP')) return 'tank';
    return 'default';
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (didDrag.current) { didDrag.current = false; return; }
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = vb.x + ((e.clientX - rect.left) / rect.width) * vb.w;
    const station = minStation + ((svgX - LP) / PIPE_W) * span;
    let nearestIdx = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const d = Math.abs(points[i].station - station);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    }
    const half = Math.floor(windowSize / 2);
    const newStart = Math.max(0, Math.min(nearestIdx - half, Math.max(0, points.length - windowSize)));
    onWindowChange(newStart);
  };

  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    if (pickMode !== 'none') return;
    isDragging.current = true;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = 'grabbing';
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const cv = vbRef.current;
    const dx = ((e.clientX - lastMouse.current.x) / rect.width) * cv.w;
    const dy = ((e.clientY - lastMouse.current.y) / rect.height) * cv.h;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    if (Math.abs(dx) > 0.3 || Math.abs(dy) > 0.3) didDrag.current = true;
    setVb(prev => ({
      x: Math.max(-100, Math.min(1100, prev.x - dx)),
      y: Math.max(-50, Math.min(200, prev.y - dy)),
      w: prev.w,
      h: prev.h,
    }));
  };

  const handleMouseUp = (e: React.MouseEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = pickMode !== 'none' ? 'crosshair' : 'grab';
  };

  const handleMouseLeave = (e: React.MouseEvent<SVGSVGElement>) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = pickMode !== 'none' ? 'crosshair' : 'grab';
  };

  // Pipe flange positions (decorative joints)
  const FLANGE_COUNT = 20;
  const flanges = Array.from({ length: FLANGE_COUNT }, (_, i) =>
    LP + (PIPE_W * i) / FLANGE_COUNT
  );

  // Station tick marks
  const TICK_N = 10;
  const ticks = Array.from({ length: TICK_N + 1 }, (_, i) => minStation + (span * i) / TICK_N);

  return (
    <div className="rounded-xl border border-blue-900/50 bg-slate-950/80 p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-sm font-bold text-blue-200">مخطط مسار الأنبوب الخطي</h3>
          <p className="text-[10px] text-slate-400 mt-0.5">
            عجلة الماوس للتكبير · اسحب للتنقل · انقر لتحريك النافذة
          </p>
        </div>
        <div className="flex items-center gap-1">
          {pickMode !== 'none' && (
            <span className="rounded-md bg-amber-900/30 border border-amber-600/40 px-2 py-1 text-[10px] text-amber-300 font-semibold">
              انقر لاختيار نقطة {pickMode}
            </span>
          )}
          <button
            onClick={() => setVb(v => { const f = 0.65; const cx = v.x + v.w / 2, cy = v.y + v.h / 2; const nw = Math.max(60, v.w * f), nh = nw * (420 / 1200); return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }; })}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title="تكبير"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVb(v => { const f = 1.5; const cx = v.x + v.w / 2, cy = v.y + v.h / 2; const nw = Math.min(2800, v.w * f), nh = nw * (420 / 1200); return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh }; })}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title="تصغير"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setVb({ x: 0, y: -20, w: 1200, h: 420 })}
            className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-white transition-colors"
            title="إعادة العرض الكامل"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        width="100%"
        height="400"
        style={{ display: 'block', cursor: pickMode !== 'none' ? 'crosshair' : 'grab', userSelect: 'none' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleSvgClick}
      >
        <defs>
          {/* 3D pipe body gradient — top-to-bottom gives cylinder illusion */}
          <linearGradient id="lg3dPipe" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#93C5FD" stopOpacity={0.55} />
            <stop offset="18%"  stopColor="#3B82F6" stopOpacity={0.95} />
            <stop offset="52%"  stopColor="#1D4ED8" stopOpacity={1} />
            <stop offset="84%"  stopColor="#1E3A5F" stopOpacity={1} />
            <stop offset="100%" stopColor="#0C1224" stopOpacity={1} />
          </linearGradient>
          {/* Pipe highlight (top shine strip) */}
          <linearGradient id="lg3dShine" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="white" stopOpacity={0.28} />
            <stop offset="100%" stopColor="white" stopOpacity={0} />
          </linearGradient>
          {/* Glow filter for selected assets */}
          <filter id="fGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Dark background */}
        <rect width={SW} height={SH} fill="#020617" />

        {/* Station tick lines */}
        {ticks.map((s, i) => {
          const tx = toX(s);
          return (
            <g key={`tk-${i}`}>
              <line x1={tx} y1={PIPE_BOT + 4} x2={tx} y2={SH - 18} stroke="#1E293B" strokeWidth="1" strokeDasharray="2 6" />
              <text x={tx} y={SH - 4} textAnchor="middle" fill="#475569" fontSize="10">{Math.round(s / 1000)}k م</text>
            </g>
          );
        })}

        {/* Viewport window highlight */}
        <rect x={vpX1} y={10} width={vpW} height={SH - 20} rx="5"
          fill="#38BDF8" fillOpacity={0.06}
        />
        <rect x={vpX1} y={10} width={vpW} height={SH - 20} rx="5"
          fill="none" stroke="#38BDF8" strokeWidth="1.5" strokeOpacity={0.5} strokeDasharray="5 4"
        />
        <text x={vpX1 + vpW / 2} y={20} textAnchor="middle" fill="#38BDF8" fontSize="8.5" fillOpacity={0.75}>
          نافذة التشارت
        </text>

        {/* === 3D PIPE TUBE === */}
        {/* Drop shadow */}
        <rect x={LP + 3} y={PIPE_TOP + 5} width={PIPE_W} height={PIPE_H} rx="5"
          fill="#000" fillOpacity={0.35}
        />
        {/* Main pipe body */}
        <rect x={LP} y={PIPE_TOP} width={PIPE_W} height={PIPE_H} rx="5"
          fill="url(#lg3dPipe)"
        />
        {/* Shine strip (top ~30%) */}
        <rect x={LP + 3} y={PIPE_TOP + 2} width={PIPE_W - 6} height={Math.round(PIPE_H * 0.32)} rx="4"
          fill="url(#lg3dShine)"
        />
        {/* Bottom edge darkening */}
        <rect x={LP} y={PIPE_BOT - 5} width={PIPE_W} height={5} rx="0 0 5 5"
          fill="#000" fillOpacity={0.28}
        />
        {/* Left end cap */}
        <ellipse cx={LP} cy={PIPE_CY} rx={5} ry={PIPE_H / 2}
          fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1"
        />
        {/* Right end cap */}
        <ellipse cx={LP + PIPE_W} cy={PIPE_CY} rx={5} ry={PIPE_H / 2}
          fill="#1E3A5F" stroke="#3B82F6" strokeWidth="1"
        />

        {/* Pipe flanges / joints (decorative) */}
        {flanges.map((fx, i) => (
          <g key={`fl-${i}`}>
            <rect x={fx - 1.5} y={PIPE_TOP - 4} width={3} height={PIPE_H + 8} fill="#1E3A5F" rx="1" />
            <rect x={fx - 3} y={PIPE_TOP - 4}   width={6} height={5} fill="#2563EB" rx="1" opacity={0.6} />
            <rect x={fx - 3} y={PIPE_BOT - 1}   width={6} height={5} fill="#2563EB" rx="1" opacity={0.6} />
          </g>
        ))}

        {/* === ASSET SYMBOLS === */}
        {points.map((point, idx) => {
          const ax = toX(point.station);
          const aType = classifyCode(point.equipmentCode);
          const isSelected = selectedAssetId === point.assetId;
          const isHovered = hoveredId === point.assetId;
          const isA = measureAId === point.assetId;
          const isB = measureBId === point.assetId;
          const isActive = isSelected || isHovered || isA || isB;

          // Color by state and type
          const color = isA ? '#22C55E' : isB ? '#EF4444' : isSelected ? '#38BDF8' : isHovered ? '#FCD34D' :
            aType === 'valve' ? '#60A5FA' :
            aType === 'pump'  ? '#A78BFA' :
            aType === 'tank'  ? '#34D399' :
            point.relationshipType === 'main' ? '#64748B' : '#475569';

          // Alternate above/below to reduce crowding
          const above = idx % 2 === 0;
          const connY1 = above ? PIPE_TOP : PIPE_BOT;
          // Vertical reach of the symbol from the pipe surface
          const reach = aType === 'valve' ? 28 : aType === 'pump' ? 22 : aType === 'tank' ? 26 : 20;
          const symCY = above ? PIPE_TOP - reach / 2 : PIPE_BOT + reach / 2;
          const labelY = above ? PIPE_TOP - reach - 20 : PIPE_BOT + reach + 20;

          // Clamp label x to stay within SVG
          const clampLX = Math.max(LP + 46, Math.min(ax, LP + PIPE_W - 46));

          return (
            <g
              key={point.assetId}
              style={{ cursor: 'pointer' }}
              onMouseEnter={(e) => { e.stopPropagation(); setHoveredId(point.assetId); }}
              onMouseLeave={() => setHoveredId(null)}
              onClick={(e) => { e.stopPropagation(); onSelect?.(point.assetId); }}
            >
              {/* Connector line from symbol to pipe surface */}
              <line
                x1={ax} y1={connY1}
                x2={ax} y2={symCY}
                stroke={color}
                strokeWidth={isActive ? 1.8 : 0.9}
                strokeOpacity={isActive ? 0.9 : 0.35}
                strokeDasharray={isActive ? 'none' : '2 3'}
              />

              {/* === VALVE symbol: triangle + actuator circle === */}
              {aType === 'valve' && (
                <g filter={isSelected ? 'url(#fGlow)' : undefined}>
                  {/* Valve body: triangle pointing toward pipe */}
                  <polygon
                    points={above
                      ? `${ax},${PIPE_TOP - 4}  ${ax - 7},${PIPE_TOP - 18}  ${ax + 7},${PIPE_TOP - 18}`
                      : `${ax},${PIPE_BOT + 4}  ${ax - 7},${PIPE_BOT + 18}  ${ax + 7},${PIPE_BOT + 18}`}
                    fill={isActive ? color + '22' : '#0D1B3E'}
                    stroke={color}
                    strokeWidth={isActive ? 1.5 : 0.8}
                    strokeLinejoin="round"
                  />
                  {/* Actuator circle on top */}
                  <circle
                    cx={ax}
                    cy={above ? PIPE_TOP - 24 : PIPE_BOT + 24}
                    r={isActive ? 5 : 3.5}
                    fill={isActive ? color + '33' : '#0D1B3E'}
                    stroke={color}
                    strokeWidth={isActive ? 1.5 : 0.8}
                  />
                  {/* Valve stem */}
                  <line
                    x1={ax} y1={above ? PIPE_TOP - 18 : PIPE_BOT + 18}
                    x2={ax} y2={above ? PIPE_TOP - 20 : PIPE_BOT + 20}
                    stroke={color} strokeWidth="1" strokeOpacity={0.6}
                  />
                </g>
              )}

              {/* === PUMP STATION symbol: circle with P === */}
              {aType === 'pump' && (
                <g filter={isSelected ? 'url(#fGlow)' : undefined}>
                  <circle
                    cx={ax}
                    cy={above ? PIPE_TOP - 16 : PIPE_BOT + 16}
                    r={isActive ? 10 : 8}
                    fill={isActive ? '#4F46E533' : '#18104A'}
                    stroke={color}
                    strokeWidth={isActive ? 1.5 : 1}
                  />
                  <text
                    x={ax}
                    y={(above ? PIPE_TOP - 16 : PIPE_BOT + 16) + 3}
                    textAnchor="middle"
                    fill={color}
                    fontSize="8"
                    fontWeight="bold"
                  >P</text>
                </g>
              )}

              {/* === TANK / RESERVOIR symbol: rectangle with T === */}
              {aType === 'tank' && (
                <g filter={isSelected ? 'url(#fGlow)' : undefined}>
                  <rect
                    x={ax - 8}
                    y={above ? PIPE_TOP - 26 : PIPE_BOT + 6}
                    width={16}
                    height={20}
                    rx="2"
                    fill={isActive ? '#05521433' : '#071E10'}
                    stroke={color}
                    strokeWidth={isActive ? 1.5 : 1}
                  />
                  <text
                    x={ax}
                    y={(above ? PIPE_TOP - 26 : PIPE_BOT + 6) + 13}
                    textAnchor="middle"
                    fill={color}
                    fontSize="7"
                    fontWeight="bold"
                  >T</text>
                </g>
              )}

              {/* === DEFAULT: diamond (main) or small circle (child) === */}
              {aType === 'default' && (
                <g filter={isSelected ? 'url(#fGlow)' : undefined}>
                  {point.relationshipType === 'main' ? (
                    <polygon
                      points={above
                        ? `${ax},${PIPE_TOP - 4}  ${ax - 5},${PIPE_TOP - 12}  ${ax},${PIPE_TOP - 20}  ${ax + 5},${PIPE_TOP - 12}`
                        : `${ax},${PIPE_BOT + 4}  ${ax - 5},${PIPE_BOT + 12}  ${ax},${PIPE_BOT + 20}  ${ax + 5},${PIPE_BOT + 12}`}
                      fill={isActive ? color + '22' : '#0F172A'}
                      stroke={color}
                      strokeWidth={isActive ? 1.5 : 0.6}
                      strokeLinejoin="round"
                    />
                  ) : (
                    <circle
                      cx={ax}
                      cy={above ? PIPE_TOP - 10 : PIPE_BOT + 10}
                      r={isActive ? 4 : 2.5}
                      fill={isActive ? color + '22' : '#0F172A'}
                      stroke={color}
                      strokeWidth={isActive ? 1.5 : 0.6}
                    />
                  )}
                </g>
              )}

              {/* Glow halo on pipe surface for selected */}
              {isSelected && (
                <circle cx={ax} cy={PIPE_CY} r={22}
                  fill={color} fillOpacity={0.1}
                />
              )}

              {/* Label box (shown on hover / select / A / B) */}
              {isActive && (
                <g>
                  <rect
                    x={clampLX - 46}
                    y={above ? labelY - 16 : labelY + 2}
                    width={92} height={30} rx="5"
                    fill="#0C1224" fillOpacity={0.97}
                    stroke={color} strokeWidth="1.2"
                  />
                  <text
                    x={clampLX}
                    y={above ? labelY - 3 : labelY + 15}
                    textAnchor="middle"
                    fill={color}
                    fontSize="8.5"
                    fontWeight="bold"
                  >{point.equipmentCode}</text>
                  <text
                    x={clampLX}
                    y={above ? labelY + 9 : labelY + 27}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="7.5"
                  >{(point.station / 1000).toFixed(2)} km · {point.elevation.toFixed(1)} m</text>
                </g>
              )}

              {/* A / B measurement markers */}
              {isA && (
                <text x={ax} y={above ? labelY - 22 : labelY + 44}
                  textAnchor="middle" fill="#22C55E" fontSize="13" fontWeight="bold">A</text>
              )}
              {isB && (
                <text x={ax} y={above ? labelY - 22 : labelY + 44}
                  textAnchor="middle" fill="#EF4444" fontSize="13" fontWeight="bold">B</text>
              )}

              {/* Native browser tooltip */}
              <title>{`${point.name} | ${point.equipmentCode} | ${formatStation(point.station)} | ارتفاع: ${point.elevation.toFixed(2)} م`}</title>
            </g>
          );
        })}

        {/* Start / end station labels */}
        <text x={LP + 6} y={PIPE_TOP - 6} fill="#475569" fontSize="9.5" textAnchor="start">
          {formatStation(minStation)}
        </text>
        <text x={LP + PIPE_W - 6} y={PIPE_TOP - 6} fill="#475569" fontSize="9.5" textAnchor="end">
          {formatStation(maxStation)}
        </text>
      </svg>

      {/* Legend */}
      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-1 text-[10px] text-slate-400">
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <polygon points="7,9 1,2 13,2" fill="none" stroke="#60A5FA" strokeWidth="1.5" strokeLinejoin="round" />
            <circle cx="7" cy="12" r="2.5" fill="none" stroke="#60A5FA" strokeWidth="1.2" />
          </svg>
          صمام
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 14 14">
            <circle cx="7" cy="7" r="5.5" fill="none" stroke="#A78BFA" strokeWidth="1.5" />
            <text x="7" y="10.5" textAnchor="middle" fill="#A78BFA" fontSize="7" fontWeight="bold">P</text>
          </svg>
          محطة ضخ
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="14" viewBox="0 0 10 14">
            <rect x="1" y="1" width="8" height="12" rx="1.5" fill="none" stroke="#34D399" strokeWidth="1.5" />
          </svg>
          خزان
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <polygon points="6,0 12,6 6,12 0,6" fill="none" stroke="#64748B" strokeWidth="1.2" />
          </svg>
          أصل رئيسي
        </span>
        <span className="flex items-center gap-1.5 ms-auto text-blue-400/70">
          المستطيل الأزرق = نافذة التشارت الحالية
        </span>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: string;
}) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-gray-800 to-gray-900 p-3">
      <div className="flex items-center justify-between">
        <div className="text-2xl">{icon}</div>
        <div className="text-right">
          <p className="text-xs text-gray-400">{label}</p>
          <p className="text-lg font-bold text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}
