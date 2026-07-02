/**
 * Linear Referencing System (LRS) Core Engine
 * محرك نظام المراجعة الخطية الأساسي
 */

import { LinearAsset, LinearAnchorPoint, LRSTransformResult } from './types';

// ── Haversine distance between two GPS points (meters) ────────────────────────
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6_371_000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Extract anchor points from a GeoJSON LineString at regular intervals.
 * استخراج نقاط مرجعية من خط GeoJSON على مسافات منتظمة.
 *
 * @param lineCoords  Array of [lon, lat] from a GeoJSON LineString
 * @param intervalMeters  Sample every N meters (default 500m)
 */
export function extractAnchorsFromPolyline(
  lineCoords: [number, number][],
  intervalMeters = 500,
): LinearAnchorPoint[] {
  if (lineCoords.length < 2) return [];

  const anchors: LinearAnchorPoint[] = [];
  let cumulativeMeters = 0;
  let nextSampleAt = 0;
  let idx = 0;

  // Always include the start point
  anchors.push({
    id: `auto-0`,
    station: 0,
    latitude: lineCoords[0][1],
    longitude: lineCoords[0][0],
    notes: 'بداية الخط',
    created_at: new Date().toISOString(),
  });

  for (let i = 1; i < lineCoords.length; i++) {
    const [lon1, lat1] = lineCoords[i - 1];
    const [lon2, lat2] = lineCoords[i];
    const segLen = haversineMeters(lat1, lon1, lat2, lon2);

    let segStart = 0;
    while (cumulativeMeters + (segLen - segStart) >= nextSampleAt + intervalMeters) {
      const distInSeg = nextSampleAt + intervalMeters - cumulativeMeters - segStart;
      const ratio = distInSeg / segLen;
      const lat = lat1 + (lat2 - lat1) * ratio;
      const lon = lon1 + (lon2 - lon1) * ratio;
      const station = nextSampleAt + intervalMeters;
      idx++;
      anchors.push({
        id: `auto-${idx}`,
        station,
        latitude: parseFloat(lat.toFixed(8)),
        longitude: parseFloat(lon.toFixed(8)),
        notes: `km ${(station / 1000).toFixed(2)}`,
        created_at: new Date().toISOString(),
      });
      nextSampleAt += intervalMeters;
      segStart += distInSeg;
    }

    cumulativeMeters += segLen;
  }

  // Always include the end point
  const totalLen = cumulativeMeters;
  const last = lineCoords[lineCoords.length - 1];
  anchors.push({
    id: `auto-end`,
    station: parseFloat(totalLen.toFixed(1)),
    latitude: last[1],
    longitude: last[0],
    notes: 'نهاية الخط',
    created_at: new Date().toISOString(),
  });

  return anchors;
}

/**
 * Convert an array of delta distances (distance_from_previous) to cumulative stations.
 * تحويل مسافات متتالية (المسافة من السابق) إلى مسافات تراكمية.
 *
 * Input:  [0, 600, 800, 1200, ...]  (delta meters from previous asset)
 * Output: [0, 600, 1400, 2600, ...]  (meters from start)
 */
export function deltasToStations(deltas: number[]): number[] {
  const stations: number[] = [];
  let cumulative = 0;
  for (const d of deltas) {
    cumulative += Math.max(0, d); // guard negative deltas
    stations.push(parseFloat(cumulative.toFixed(2)));
  }
  return stations;
}

/**
 * Parse a CSV row for linear assets.
 * Expected columns (flexible order, case-insensitive):
 *   equipment_code / code / id
 *   name / asset_name / equipment_name
 *   type / asset_type / equipment_type
 *   distance_from_prev / distance_prev / delta / dist_prev (meters)
 *   station / cumulative_distance / km_from_start  (if delta not available)
 *   invert_level / elevation / level (optional, default 0)
 *   notes / description (optional)
 */
export function parseLinearAssetCSV(
  csvText: string,
): { rows: Partial<LinearAsset & { distance_from_prev: number }>[], warnings: string[] } {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { rows: [], warnings: ['الملف فارغ أو لا يحتوي رأس'] };

  const warnings: string[] = [];
  const rawHeaders = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  const colMap = {
    code:   findCol(rawHeaders, ['equipment_code','code','id','معرف','رمز']),
    name:   findCol(rawHeaders, ['name','asset_name','equipment_name','اسم']),
    type:   findCol(rawHeaders, ['type','asset_type','equipment_type','نوع']),
    delta:  findCol(rawHeaders, ['distance_from_prev','distance_prev','delta','dist_prev','مسافة_سابق','المسافة']),
    station:findCol(rawHeaders, ['station','cumulative_distance','km_from_start','محطة']),
    level:  findCol(rawHeaders, ['invert_level','elevation','level','ارتفاع']),
    notes:  findCol(rawHeaders, ['notes','description','ملاحظات']),
  };

  if (colMap.code === -1) warnings.push('عمود equipment_code/code/id غير موجود — سيتم توليده تلقائياً');
  if (colMap.name === -1) warnings.push('عمود name غير موجود');
  if (colMap.delta === -1 && colMap.station === -1) warnings.push('لا يوجد عمود distance_from_prev أو station — سيُفترض التسلسل المتساوي');

  const rows: Partial<LinearAsset & { distance_from_prev: number }>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
    if (cells.every(c => !c)) continue; // skip empty lines

    const row: Partial<LinearAsset & { distance_from_prev: number }> = {
      equipment_code: get(cells, colMap.code) || `EQ-${String(i).padStart(5, '0')}`,
      name: get(cells, colMap.name) || `أصل ${i}`,
      invert_level: parseFloat(get(cells, colMap.level) || '0') || 0,
      station: colMap.station !== -1 ? (parseFloat(get(cells, colMap.station) || '0') || 0) : 0,
      distance_from_prev: colMap.delta !== -1 ? (parseFloat(get(cells, colMap.delta) || '0') || 0) : 0,
      technical: { asset_type: get(cells, colMap.type) || 'unknown', notes: get(cells, colMap.notes) || '' },
      coordinate_source: 'lineal',
      relation_type: 'main',
      source: 'maintenance_upload',
      latitude: null,
      longitude: null,
      lrs_transformation_applied: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    rows.push(row);
  }

  return { rows, warnings };
}

function findCol(headers: string[], candidates: string[]): number {
  for (const c of candidates) {
    const idx = headers.findIndex(h => h.includes(c.replace(/[^a-z0-9]/g, '_')));
    if (idx !== -1) return idx;
  }
  return -1;
}

function get(cells: string[], idx: number): string {
  return idx !== -1 ? (cells[idx] || '') : '';
}

/**
 * Full pipeline: CSV text + polyline coords → georeferenced LinearAssets
 * الخط الكامل: CSV + إحداثيات الخط الجغرافي → أصول مع موقع GPS
 */
export function batchPlaceAssetsOnPolyline(
  csvText: string,
  lineCoords: [number, number][],
  anchorIntervalMeters = 500,
): {
  assets: (LinearAsset & { lrs_result?: LRSTransformResult })[],
  anchors: LinearAnchorPoint[],
  stats: { total: number; placed: number; failed: number; warnings: string[] },
} {
  const { rows, warnings } = parseLinearAssetCSV(csvText);

  // Build cumulative stations from distance_from_prev
  const deltas = rows.map(r => r.distance_from_prev ?? 0);
  const cumStations = deltasToStations(deltas);
  rows.forEach((r, i) => { r.station = cumStations[i]; });

  // Extract anchor points from polyline
  const anchors = extractAnchorsFromPolyline(lineCoords, anchorIntervalMeters);

  // Assign IDs and cast to full LinearAsset
  const assets: LinearAsset[] = rows.map((r, i) => ({
    id: `lrs-${Date.now()}-${i}`,
    equipment_code: r.equipment_code || `EQ-${i}`,
    name: r.name || `أصل ${i}`,
    station: r.station ?? 0,
    invert_level: r.invert_level ?? 0,
    latitude: null,
    longitude: null,
    coordinate_source: 'lineal' as const,
    parent_asset_id: null,
    relation_type: 'main' as const,
    technical: r.technical || {},
    source: 'maintenance_upload' as const,
    created_at: r.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
    lrs_transformation_applied: false,
  }));

  // Transform using LRS engine
  const transformed = transformAssets(assets, anchors);
  const placed = transformed.filter(a => a.latitude !== null).length;

  return {
    assets: transformed,
    anchors,
    stats: {
      total: assets.length,
      placed,
      failed: assets.length - placed,
      warnings,
    },
  };
}



/**
 * Calculate geographic coordinates from linear reference using anchor points
 * استخدام نقاط مرجعية GPS لحساب الإحداثيات الجغرافية من المحطة الخطية
 */
export function linearToGeographic(
  station: number,
  anchorPoints: LinearAnchorPoint[]
): { latitude: number; longitude: number; confidence: number } | null {
  if (anchorPoints.length === 0) return null;
  
  // Sort anchor points by station
  const sorted = [...anchorPoints].sort((a, b) => a.station - b.station);
  
  // Edge case: station before first anchor
  if (station < sorted[0].station) {
    return null; // Cannot extrapolate backwards
  }
  
  // Edge case: station after last anchor
  if (station > sorted[sorted.length - 1].station) {
    return null; // Cannot extrapolate forward
  }
  
  // Find the two anchor points that bracket this station
  for (let i = 0; i < sorted.length - 1; i++) {
    const anchor1 = sorted[i];
    const anchor2 = sorted[i + 1];
    
    if (station >= anchor1.station && station <= anchor2.station) {
      // Linear interpolation
      const ratio =
        (station - anchor1.station) / (anchor2.station - anchor1.station);
      
      const latitude =
        anchor1.latitude + (anchor2.latitude - anchor1.latitude) * ratio;
      const longitude =
        anchor1.longitude + (anchor2.longitude - anchor1.longitude) * ratio;
      
      // Confidence decreases with distance from nearest anchor
      const distToNearest = Math.min(
        Math.abs(station - anchor1.station),
        Math.abs(station - anchor2.station)
      );
      const maxDist = Math.abs(anchor2.station - anchor1.station);
      const confidence = 1 - distToNearest / maxDist * 0.2; // 0.8 - 1.0
      
      return {
        latitude: parseFloat(latitude.toFixed(8)),
        longitude: parseFloat(longitude.toFixed(8)),
        confidence: parseFloat(confidence.toFixed(2)),
      };
    }
  }
  
  return null;
}

/**
 * Transform all assets using anchor points
 * تحويل جميع الأصول باستخدام النقاط المرجعية
 */
export function transformAssets(
  assets: LinearAsset[],
  anchorPoints: LinearAnchorPoint[]
): (LinearAsset & { lrs_result?: LRSTransformResult })[] {
  return assets.map((asset) => {
    const result = linearToGeographic(asset.station, anchorPoints);
    
    if (!result) {
      return asset; // No transformation possible
    }
    
    const lrs_result: LRSTransformResult = {
      station: asset.station,
      original_latitude: asset.latitude,
      original_longitude: asset.longitude,
      calculated_latitude: result.latitude,
      calculated_longitude: result.longitude,
      interpolation_method: 'linear',
      confidence_score: result.confidence,
      anchor_points_used: anchorPoints.length,
    };
    
    return {
      ...asset,
      latitude: result.latitude,
      longitude: result.longitude,
      coordinate_source: 'lrs_interpolated',
      lrs_transformation_applied: true,
      lrs_result,
    };
  });
}

/**
 * Calculate profile view extent
 * حساب حدود عرض البروفايل
 */
export function calculateProfileExtent(assets: LinearAsset[]) {
  if (assets.length === 0) {
    return {
      minStation: 0,
      maxStation: 100,
      minElevation: 0,
      maxElevation: 50,
    };
  }
  
  const stations = assets.map((a) => a.station);
  const elevations = assets.map((a) => a.invert_level);
  
  const minStation = Math.min(...stations);
  const maxStation = Math.max(...stations);
  const minElevation = Math.min(...elevations);
  const maxElevation = Math.max(...elevations);
  
  // Add padding
  const stationPadding = (maxStation - minStation) * 0.1 || 10;
  const elevationPadding = (maxElevation - minElevation) * 0.1 || 5;
  
  return {
    minStation: minStation - stationPadding,
    maxStation: maxStation + stationPadding,
    minElevation: minElevation - elevationPadding,
    maxElevation: maxElevation + elevationPadding,
  };
}

/**
 * Format station for display (e.g., "0+250.5" format)
 * تنسيق المحطة للعرض
 */
export function formatStation(station: number): string {
  const abs = Math.abs(station);
  const major = Math.floor(abs / 1000);
  const minor = abs % 1000;
  const sign = station < 0 ? '-' : '';
  return `${sign}${major}+${minor.toFixed(1)}`;
}

/**
 * Parse station from string (e.g., "0+250.5")
 * تحليل المحطة من نص
 */
export function parseStation(stationStr: string): number | null {
  try {
    const regex = /^(-?)(\d+)\+(\d+(?:\.\d+)?)$/;
    const match = stationStr.match(regex);
    if (!match) return null;
    
    const sign = match[1] === '-' ? -1 : 1;
    const major = parseInt(match[2], 10);
    const minor = parseFloat(match[3]);
    
    return sign * (major * 1000 + minor);
  } catch {
    return null;
  }
}

/**
 * Validate asset data before storage
 * التحقق من صحة بيانات الأصل قبل التخزين
 */
export function validateAsset(asset: Partial<LinearAsset>): string[] {
  const errors: string[] = [];
  
  if (!asset.equipment_code) errors.push('معرّف المعدة مطلوب');
  if (!asset.name) errors.push('الاسم مطلوب');
  if (asset.station === undefined || asset.station === null) {
    errors.push('المحطة مطلوبة');
  }
  if (asset.invert_level === undefined || asset.invert_level === null) {
    errors.push('الارتفاع مطلوب');
  }
  if (asset.relation_type && !['main', 'child'].includes(asset.relation_type)) {
    errors.push('نوع العلاقة غير صحيح');
  }
  
  return errors;
}
