/**
 * Linear Referencing System - Type Definitions
 * نظام المراجعة الخطية - تعريفات الأنواع
 */

export interface LinearAsset {
  id: string;
  equipment_code: string;
  name: string;
  
  // Linear Reference (Stationing)
  station: number;           // المسافة على الخط (0+250.5)
  invert_level: number;      // الارتفاع
  
  // Geographic Reference (Future - GPS)
  latitude: number | null;
  longitude: number | null;
  coordinate_source: 'lineal' | 'gps' | 'lrs_interpolated';
  
  // Hierarchy
  parent_asset_id: string | null;
  relation_type: 'main' | 'child';
  
  // Technical Data
  technical: {
    pressure_bar?: number;
    diameter?: string;
    material?: string;
    crown_elevation?: number;
    route_sector?: string;
    [key: string]: any;
  };
  
  // Metadata
  source: 'maintenance_upload' | 'gis_draw' | 'api_manual';
  created_at: string;
  updated_at: string;
  lrs_transformation_applied: boolean;
}

export interface LinearAnchorPoint {
  id: string;
  station: number;
  latitude: number;
  longitude: number;
  notes?: string;
  created_at: string;
}

export interface LRSTransformResult {
  station: number;
  original_latitude: number | null;
  original_longitude: number | null;
  calculated_latitude: number;
  calculated_longitude: number;
  interpolation_method: 'linear' | 'spline';
  confidence_score: number; // 0.0 - 1.0
  anchor_points_used: number;
}

export interface ProfileViewData {
  assets: LinearAsset[];
  minStation: number;
  maxStation: number;
  minElevation: number;
  maxElevation: number;
  routeName?: string;
}
