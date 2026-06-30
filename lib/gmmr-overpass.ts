/**
 * lib/gmmr-overpass.ts
 * يجلب مسار النهر الصناعي الحقيقي من OpenStreetMap عبر Overpass API
 *
 * المنطق:
 *  1. يستعلم عن الأنابيب والقنوات المائية في منطقة غرب ليبيا (bbox)
 *  2. يدمج النتائج في خط واحد مرتب من الجنوب إلى الشمال
 *  3. يبسّط الخط باستخدام Ramer-Douglas-Peucker (ε=0.02°)
 *  4. يخزّن النتيجة في ذاكرة الخادم لمدة 24 ساعة
 *  5. يعود إلى النقاط المضمّنة عند فشل الاستعلام
 */

const OVERPASS_ENDPOINT = 'https://overpass-api.de/api/interpreter';

// ── Cache ─────────────────────────────────────────────────────────────────────
let _cachedWest: [number, number][] | null = null;
let _cacheTimeWest = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

// ── Overpass query for GMMR western branch ────────────────────────────────────
// Bounding box: south=25.0, west=9.5, north=33.5, east=16.0
// Covers Hasawnah → Tripoli corridor in western Libya
const QUERY_WEST = `[out:json][timeout:55];
(
  way["man_made"="pipeline"]["substance"="water"](25.0,9.5,33.5,16.0);
  way["man_made"="pipeline"]["name"~"النهر|نهر|GMMR|Great Man|Artificial|River"](24.0,9.0,34.0,20.0);
  way["waterway"~"pipeline|canal"]["name"~"النهر|نهر|GMMR"](24.0,9.0,34.0,20.0);
  relation["man_made"="pipeline"](25.0,9.5,33.5,16.0);
);
out geom;
`;

// ── Geometry helpers ──────────────────────────────────────────────────────────

function perpDist(
  pt: [number, number],
  a:  [number, number],
  b:  [number, number],
): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const len = Math.hypot(dx, dy);
  if (len < 1e-10) return Math.hypot(pt[0] - a[0], pt[1] - a[1]);
  return Math.abs(dx * (a[1] - pt[1]) - dy * (a[0] - pt[0])) / len;
}

function rdp(pts: [number, number][], eps: number): [number, number][] {
  if (pts.length < 3) return pts;
  let maxD = 0, maxI = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = perpDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; maxI = i; }
  }
  if (maxD > eps) {
    const L = rdp(pts.slice(0, maxI + 1), eps);
    const R = rdp(pts.slice(maxI),        eps);
    return [...L.slice(0, -1), ...R];
  }
  return [pts[0], pts[pts.length - 1]];
}

/** Remove duplicate consecutive points and points within minDeg of the previous */
function dedupe(pts: [number, number][], minDeg = 0.01): [number, number][] {
  const out: [number, number][] = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    if (Math.hypot(pts[i][0] - prev[0], pts[i][1] - prev[1]) >= minDeg) {
      out.push(pts[i]);
    }
  }
  return out;
}

// ── Fallback hardcoded waypoints (Hasawnah → Tripoli, verified approximate) ──
export const GMR_WEST_FALLBACK: [number, number][] = [
  [14.17, 26.90],  // 1. حقول الحساونة الجنوبية — آبار المصدر
  [14.22, 27.25],  // 2. جبل الحساونة — محطة ضخ H-01
  [14.35, 27.65],  // 3. محطة ضخ H-1 (شمال الآبار)
  [14.35, 28.05],  // 4. منطقة وادي الشاطئ
  [14.28, 28.55],  // 5. تقاطع وادي الحياة
  [14.25, 29.05],  // 6. الانحناءة الأولى — اتجاه الشمال
  [14.27, 29.55],  // 7. مفترق طريق سبها–الشويرف
  [14.27, 30.08],  // 8. الشويرف — محطة ضخ رئيسية
  [14.15, 30.50],  // 9. شمال الشويرف — تحول نحو الشمال الغربي
  [14.00, 30.95],  // 10. وادي الفارغ
  [13.92, 31.20],  // 11. جنوب بني وليد
  [13.97, 31.60],  // 12. بني وليد — خزان توزيع
  [13.97, 31.78],  // 13. شمال بني وليد — محطة ضخ
  [13.70, 31.90],  // 14. منعطف الغرب
  [13.52, 31.92],  // 15. غرب وادي الزمزم
  [13.25, 32.05],  // 16. جنوب غريان
  [13.01, 32.17],  // 17. غريان — خزان رئيسي
  [13.08, 32.42],  // 18. الرياينة
  [13.12, 32.55],  // 19. مسلاتة
  [13.15, 32.72],  // 20. العزيزية
  [13.18, 32.90],  // 21. طرابلس جنوب — نقطة التوزيع
];

// ── Main export ───────────────────────────────────────────────────────────────

export interface GMMRRouteResult {
  waypoints:  [number, number][];
  source:     'overpass' | 'fallback';
  way_count?: number;
  point_count?: number;
}

export async function fetchGMMRWestRoute(): Promise<GMMRRouteResult> {
  // Return cache if still fresh
  if (_cachedWest && Date.now() - _cacheTimeWest < CACHE_TTL_MS) {
    return { waypoints: _cachedWest, source: 'overpass' };
  }

  try {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30_000);

    const res = await fetch(OVERPASS_ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    `data=${encodeURIComponent(QUERY_WEST)}`,
      signal:  ctrl.signal,
    });
    clearTimeout(timer);

    if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

    const data = await res.json();
    const ways: { type: string; geometry?: { lat: number; lon: number }[] }[] =
      data.elements ?? [];

    const pipelineWays = ways.filter(
      e => e.type === 'way' && Array.isArray(e.geometry) && e.geometry.length > 1,
    );

    if (pipelineWays.length === 0) {
      console.warn('[GMMR] Overpass: no pipeline ways found, using fallback');
      return { waypoints: GMR_WEST_FALLBACK, source: 'fallback' };
    }

    console.log(`[GMMR] Overpass: ${pipelineWays.length} pipeline way(s) found`);

    // Collect all geometry nodes as [lon, lat]
    const allPts: [number, number][] = pipelineWays.flatMap(
      w => (w.geometry ?? []).map(n => [n.lon, n.lat] as [number, number]),
    );

    // Sort south → north and deduplicate
    allPts.sort((a, b) => a[1] - b[1]);
    const deduped = dedupe(allPts, 0.005);

    // Simplify to ≤ 80 points
    const simplified = rdp(deduped, 0.02);
    if (simplified.length < 5) {
      console.warn('[GMMR] Overpass: simplified route too short, using fallback');
      return { waypoints: GMR_WEST_FALLBACK, source: 'fallback' };
    }

    _cachedWest  = simplified;
    _cacheTimeWest = Date.now();

    return {
      waypoints:   simplified,
      source:      'overpass',
      way_count:   pipelineWays.length,
      point_count: simplified.length,
    };
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    console.warn('[GMMR] Overpass error:', msg.slice(0, 100), '— using fallback');
    return { waypoints: GMR_WEST_FALLBACK, source: 'fallback' };
  }
}

/** Invalidate cache (call after successful Overpass update) */
export function invalidateGMMRCache() {
  _cachedWest    = null;
  _cacheTimeWest = 0;
}
