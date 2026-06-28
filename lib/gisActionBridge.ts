/**
 * gisActionBridge.ts
 * ────────────────────────────────────────────────────────────────────────────
 * Converts GIS / satellite analysis results into operational context signals.
 *
 * Design principles:
 *  - This is a BRIDGE, not a new alert system
 *  - Only converts results that carry severity / risk / actionable insight
 *  - Never emits more than 1 alert per result (no duplication)
 *  - Callers: GIS pages, satellite intelligence center, context broker clients
 *
 * Usage (from any GIS component):
 *   import { bridgeGISResult } from '@/lib/gisActionBridge';
 *   // After receiving analysis result:
 *   bridgeGISResult(result, addAlert, setSelectedLocation);
 *
 * Or use the hook wrapper:
 *   const { bridgeResult } = useGISActionBridge();
 *   bridgeResult(result);
 */
import type { LiveAlert } from '@/store/operationalContext';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GISAnalysisResult {
  /** Optional: for location-aware bridging */
  lat?: number;
  lon?: number;
  area_name?: string;

  /** Risk / severity output from spatial analysis */
  risk_level?: 'low' | 'medium' | 'high' | 'critical';
  severity?: 'low' | 'medium' | 'high' | 'critical';
  risk_score?: number; // 0–100
  confidence?: number; // 0–1

  /** Human-readable summary of the result */
  summary?: string;
  label?: string;
  insight?: string;

  /** Source system */
  source?: 'satellite' | 'corrosion' | 'flood' | 'vegetation' | 'infrastructure' | string;

  /** Arbitrary additional payload — not consumed here */
  [key: string]: unknown;
}

// ── Severity mapping ───────────────────────────────────────────────────────────

function resolveAlertType(result: GISAnalysisResult): LiveAlert['type'] | null {
  const level = result.risk_level ?? result.severity;
  const score = result.risk_score ?? 0;

  if (level === 'critical' || score >= 80) return 'error';
  if (level === 'high' || score >= 60) return 'warning';
  if (level === 'medium' || score >= 35) return 'info';
  // low / no risk — no alert needed
  return null;
}

function buildAlertMessage(result: GISAnalysisResult): string {
  const location = result.area_name ?? (
    result.lat != null && result.lon != null
      ? `(${result.lat.toFixed(4)}, ${result.lon.toFixed(4)})`
      : 'منطقة غير محددة'
  );

  const body = result.summary ?? result.insight ?? result.label ?? 'تحليل مكاني';
  return `${body} — ${location}`;
}

// ── Core bridge function ───────────────────────────────────────────────────────

/**
 * Convert a GIS analysis result into:
 *  - an alert in operationalContext (if risk threshold met)
 *  - a location update in operationalContext (if coordinates present)
 *
 * @param result  The analysis result object
 * @param addAlert  operationalContext.addAlert
 * @param setLocation  operationalContext.setSelectedLocation (optional)
 */
export function bridgeGISResult(
  result: GISAnalysisResult,
  addAlert: (alert: Omit<LiveAlert, 'id' | 'timestamp'>) => void,
  setLocation?: (loc: { lat: number; lon: number; name?: string; source: 'gis_click' }) => void
): void {
  // 1. Location update (always, if coordinates present)
  if (result.lat != null && result.lon != null && setLocation) {
    setLocation({
      lat: result.lat,
      lon: result.lon,
      name: result.area_name,
      source: 'gis_click',
    });
  }

  // 2. Alert (only if severity threshold met)
  const alertType = resolveAlertType(result);
  if (!alertType) return;

  const message = buildAlertMessage(result);
  addAlert({
    type: alertType,
    message,
    source: 'system',
    action_url: '/dashboard/gis-sovereignty/engineering-workspace',
  });
}

// ── Hook wrapper ───────────────────────────────────────────────────────────────
// Import this in GIS components to avoid prop-drilling.
// (defined here to keep lib self-contained; no React import needed for the pure fn above)

import { useOperationalContext } from '@/store/operationalContext';

export function useGISActionBridge() {
  const { addAlert, setSelectedLocation } = useOperationalContext();

  return {
    bridgeResult: (result: GISAnalysisResult) =>
      bridgeGISResult(result, addAlert, setSelectedLocation),
  };
}
