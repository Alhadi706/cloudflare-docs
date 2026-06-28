/**
 * Linear Referencing System (LRS) Core Engine
 * محرك نظام المراجعة الخطية الأساسي
 */

import { LinearAsset, LinearAnchorPoint, LRSTransformResult } from './types';

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
