'use client';
/**
 * MapCenterCanvas — محرك الخريطة المركزي الموحد
 * ═══════════════════════════════════════════════════════════════
 * OpenLayers engine متصل بـ gisEngine store.
 * يرسم: حدود المشاريع، أصول (clustered)، أوامر عمل، موظفون.
 * لا بيانات وهمية — كل الكيانات قادمة من gisEngine store فقط.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Edit2, MapPin } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useGisEngine, BASEMAPS, type GisWorkspace, type DrawingMode, type MapEmployee, type MapWarehouse } from '@/store/gisEngine';
import { setSharedOlMap } from '@/store/gisEngine';
import type { MapCorridor } from '@/store/gisEngine';
import { usePreviewGeoJsonBridge } from './hooks/usePreviewGeoJsonBridge';

// Re-export types so existing consumers don't break
export type GisMode = GisWorkspace;
export type BasemapKey = 'satellite' | 'terrain' | 'light' | 'dark' | 'road';

// Priority colours for work orders
const WO_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high:     '#f97316',
  medium:   '#eab308',
  low:      '#22c55e',
};

const ICON_ZOOM_THRESHOLD = 14;

const WS_CENTER: Record<GisWorkspace, [number, number]> = {
  satellite:   [13.19, 32.89],
  engineering: [13.19, 32.89],
  maintenance: [13.19, 32.89],
  executive:   [17.00, 26.00],
  spatial:     [17.00, 26.00],
  monitor:     [13.19, 32.89],
};
const WS_ZOOM: Record<GisWorkspace, number> = {
  satellite:   12,
  engineering: 12,
  maintenance: 12,
  executive:   5,
  spatial:     7,
  monitor:     10,
};

function getTenantHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  const tenantId = localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
  return tenantId ? { 'X-Tenant-ID': tenantId } : {};
}

function resolveDepartmentFromPath(pathname: string): string {
  const parts = pathname.split('/').filter(Boolean);
  const adminGatewayIdx = parts.indexOf('admin-gateway');
  if (adminGatewayIdx >= 0 && parts[adminGatewayIdx + 1]) {
    return parts[adminGatewayIdx + 1];
  }
  const departmentsIdx = parts.indexOf('departments');
  if (departmentsIdx >= 0 && parts[departmentsIdx + 1]) {
    return parts[departmentsIdx + 1];
  }
  return 'engineering';
}

function parseGeometry(g: any): any | null {
  if (!g) return null;
  if (typeof g === 'string') { try { return JSON.parse(g); } catch { return null; } }
  return g;
}

function pointInRing(point: [number, number], ring: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > point[1]) !== (yj > point[1]))
      && (point[0] < ((xj - xi) * (point[1] - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
}

function buildRingSpatialIndex(ring: [number, number][], binCount = 64): any | null {
  if (!Array.isArray(ring) || ring.length < 4) return null;

  const minX = Math.min(...ring.map((p) => p[0]));
  const minY = Math.min(...ring.map((p) => p[1]));
  const maxX = Math.max(...ring.map((p) => p[0]));
  const maxY = Math.max(...ring.map((p) => p[1]));
  const ySpan = Math.max(maxY - minY, 1e-12);

  const edges: Array<{ xi: number; yi: number; xj: number; yj: number; minY: number; maxY: number }> = [];
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[i + 1];
    edges.push({ xi, yi, xj, yj, minY: Math.min(yi, yj), maxY: Math.max(yi, yj) });
  }

  const bins: number[][] = Array.from({ length: binCount }, () => []);
  edges.forEach((e, idx) => {
    const startBin = Math.max(0, Math.min(binCount - 1, Math.floor(((e.minY - minY) / ySpan) * binCount)));
    const endBin = Math.max(0, Math.min(binCount - 1, Math.floor(((e.maxY - minY) / ySpan) * binCount)));
    for (let b = startBin; b <= endBin; b += 1) bins[b].push(idx);
  });

  return { minX, minY, maxX, maxY, ySpan, binCount, edges, bins };
}

function pointInRingIndexed(point: [number, number], idx: any): boolean {
  if (!idx) return false;
  const [x, y] = point;
  if (x < idx.minX || x > idx.maxX || y < idx.minY || y > idx.maxY) return false;

  const bin = Math.max(0, Math.min(idx.binCount - 1, Math.floor(((y - idx.minY) / idx.ySpan) * idx.binCount)));
  const candidates: number[] = idx.bins[bin] ?? [];
  let inside = false;

  for (const edgeIdx of candidates) {
    const e = idx.edges[edgeIdx];
    if (y < e.minY || y >= e.maxY) continue;
    const xAtY = e.xi + ((y - e.yi) * (e.xj - e.xi)) / ((e.yj - e.yi) || 1e-12);
    if (x < xAtY) inside = !inside;
  }
  return inside;
}

function pointInPolygonWithHoles(point: [number, number], polygon: [number, number][][]): boolean {
  if (!polygon.length) return false;
  if (!pointInRing(point, polygon[0] as [number, number][])) return false;
  for (let i = 1; i < polygon.length; i += 1) {
    if (pointInRing(point, polygon[i] as [number, number][])) return false;
  }
  return true;
}

function pointInPolygonWithIndexedHoles(point: [number, number], polygonIndex: any): boolean {
  if (!polygonIndex?.shell) return false;
  if (!pointInRingIndexed(point, polygonIndex.shell)) return false;
  const holes: any[] = polygonIndex.holes ?? [];
  for (const h of holes) {
    if (pointInRingIndexed(point, h)) return false;
  }
  return true;
}

function buildAoiSpatialIndex(geometry: any): any | null {
  if (!geometry) return null;
  if (geometry.type === 'Polygon') {
    const rings = geometry.coordinates as [number, number][][];
    if (!Array.isArray(rings) || !rings.length) return null;
    return {
      type: 'Polygon',
      polygons: [{
        shell: buildRingSpatialIndex(rings[0] as [number, number][]),
        holes: rings.slice(1).map((r) => buildRingSpatialIndex(r as [number, number][])).filter(Boolean),
      }],
    };
  }
  if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as [number, number][][][];
    return {
      type: 'MultiPolygon',
      polygons: (polys ?? []).map((poly) => ({
        shell: buildRingSpatialIndex((poly?.[0] ?? []) as [number, number][]),
        holes: (poly ?? []).slice(1).map((r) => buildRingSpatialIndex(r as [number, number][])).filter(Boolean),
      })),
    };
  }
  return null;
}

function pointInAoiGeometry(point: [number, number], geometry: any): boolean {
  if (!geometry) return true;
  // Fast bbox pre-rejection — avoids polygon ray-cast for points clearly outside AOI
  if (geometry._bbox) {
    const [minX, minY, maxX, maxY] = geometry._bbox as [number, number, number, number];
    if (point[0] < minX || point[0] > maxX || point[1] < minY || point[1] > maxY) return false;
  }
  if (geometry._spatialIndex?.polygons?.length) {
    return geometry._spatialIndex.polygons.some((poly: any) => pointInPolygonWithIndexedHoles(point, poly));
  }
  if (geometry.type === 'Polygon') {
    return pointInPolygonWithHoles(point, geometry.coordinates as [number, number][][]);
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as [number, number][][][])
      .some((poly) => pointInPolygonWithHoles(point, poly));
  }
  return true;
}

function featureInsideAoi(geometry: any, aoiGeometry: any): boolean {
  if (!aoiGeometry || !geometry) return true;
  if (geometry.type === 'Point') {
    return pointInAoiGeometry([geometry.coordinates[0], geometry.coordinates[1]], aoiGeometry);
  }
  if (geometry.type === 'LineString') {
    return (geometry.coordinates as [number, number][])
      .some((c) => pointInAoiGeometry([c[0], c[1]], aoiGeometry));
  }
  if (geometry.type === 'Polygon') {
    const firstRing = (geometry.coordinates?.[0] ?? []) as [number, number][];
    return firstRing.some((c) => pointInAoiGeometry([c[0], c[1]], aoiGeometry));
  }
  if (geometry.type === 'MultiPolygon') {
    return (geometry.coordinates as [number, number][][][])
      .some((poly) => {
        const firstRing = (poly[0] ?? []) as [number, number][];
        return firstRing.some((c) => pointInAoiGeometry([c[0], c[1]], aoiGeometry));
      });
  }
  return true;
}

function orthogonalizePolygonCoordinates(coords: number[][][]): number[][][] {
  if (!Array.isArray(coords) || !coords.length) return coords;
  const ring = coords[0];
  if (!Array.isArray(ring) || ring.length < 4) return coords;

  const out: [number, number][] = ring.map((p: any) => [Number(p[0]), Number(p[1])]);
  for (let i = 1; i < out.length - 1; i += 1) {
    const prev = out[i - 1];
    const curr = out[i];
    const next = out[i + 1];
    const dx = Math.abs(next[0] - prev[0]);
    const dy = Math.abs(next[1] - prev[1]);
    if (dx >= dy) {
      curr[1] = prev[1];
    } else {
      curr[0] = prev[0];
    }
  }

  // Force ring closure after orthogonal correction.
  out[out.length - 1] = [out[0][0], out[0][1]];
  const fixed = [out as number[][]];
  if (coords.length > 1) fixed.push(...coords.slice(1));
  return fixed;
}

// ── SCADA 3D/animated canvas drawing helpers ────────────────────────────────
function drawScadaPipe(ctx: CanvasRenderingContext2D, pixels: [number, number][], t: number) {
  if (pixels.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // Outer shadow
  ctx.beginPath();
  ctx.moveTo(pixels[0][0], pixels[0][1]);
  for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i][0], pixels[i][1]);
  ctx.strokeStyle = '#082f49';
  ctx.lineWidth = 11;
  ctx.stroke();
  // Pipe body
  ctx.beginPath();
  ctx.moveTo(pixels[0][0], pixels[0][1]);
  for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i][0], pixels[i][1]);
  ctx.strokeStyle = '#0369a1';
  ctx.lineWidth = 8;
  ctx.stroke();
  // Bright center line
  ctx.beginPath();
  ctx.moveTo(pixels[0][0], pixels[0][1]);
  for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i][0], pixels[i][1]);
  ctx.strokeStyle = '#7dd3fc';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Animated flow dashes
  const dashLen = 18, gapLen = 10, speed = 55;
  const offset = (t * speed) % (dashLen + gapLen);
  ctx.beginPath();
  ctx.moveTo(pixels[0][0], pixels[0][1]);
  for (let i = 1; i < pixels.length; i++) ctx.lineTo(pixels[i][0], pixels[i][1]);
  ctx.strokeStyle = 'rgba(186,230,253,0.85)';
  ctx.lineWidth = 3;
  ctx.setLineDash([dashLen, gapLen]);
  ctx.lineDashOffset = -offset;
  ctx.stroke();
  ctx.setLineDash([]);
  // Flow arrows at segment midpoints
  for (let i = 0; i < pixels.length - 1; i++) {
    const [x1, y1] = pixels[i];
    const [x2, y2] = pixels[i + 1];
    if (Math.hypot(x2 - x1, y2 - y1) < 40) continue;
    const mx = x1 + (x2 - x1) * 0.5, my = y1 + (y2 - y1) * 0.5;
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.save();
    ctx.translate(mx, my);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fillStyle = '#bae6fd';
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawScadaTank(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, t: number, halfW = 22) {
  ctx.save();
  // Hard cap: never larger than base size at zoom-14
  const w = Math.min(44, Math.max(14, halfW));
  const h = w * 1.5;   // front face height
  const d = w * 0.45;  // isometric depth offset (top face)
  const topOff = d * 0.5; // vertical component of depth
  // Corners of front face
  const fx = x - w, fy = y - h / 2;
  const fw = w * 2, fh = h;
  // Water level
  const lvl = 0.60 + Math.sin(t * 0.35) * 0.018;
  const waterY = fy + fh * (1 - lvl);

  // Drop shadow
  ctx.beginPath();
  ctx.ellipse(x + d * 0.4, fy + fh + topOff + 4, w * 0.85, Math.max(3, w * 0.18), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();

  // ── Right side face (dark) ──
  ctx.beginPath();
  ctx.moveTo(fx + fw, fy);
  ctx.lineTo(fx + fw + d, fy - topOff);
  ctx.lineTo(fx + fw + d, fy - topOff + fh);
  ctx.lineTo(fx + fw, fy + fh);
  ctx.closePath();
  ctx.fillStyle = '#1e3a5f'; ctx.fill();
  ctx.strokeStyle = '#1e40af'; ctx.lineWidth = 0.8; ctx.stroke();

  // ── Front face body ──
  const frontGrad = ctx.createLinearGradient(fx, 0, fx + fw, 0);
  frontGrad.addColorStop(0, '#1e3a5f'); frontGrad.addColorStop(0.4, '#2563eb'); frontGrad.addColorStop(1, '#1e3a5f');
  ctx.fillStyle = frontGrad; ctx.fillRect(fx, fy, fw, fh);

  // ── Water fill on front face ──
  const waterGrad = ctx.createLinearGradient(0, waterY, 0, fy + fh);
  waterGrad.addColorStop(0, 'rgba(14,165,233,0.82)'); waterGrad.addColorStop(1, 'rgba(7,89,133,0.6)');
  ctx.fillStyle = waterGrad; ctx.fillRect(fx, waterY, fw, fy + fh - waterY);

  // ── Water on right side face (proportional) ──
  ctx.beginPath();
  ctx.moveTo(fx + fw, waterY);
  ctx.lineTo(fx + fw + d, waterY - topOff);
  ctx.lineTo(fx + fw + d, fy - topOff + fh);
  ctx.lineTo(fx + fw, fy + fh);
  ctx.closePath();
  ctx.fillStyle = 'rgba(7,89,133,0.55)'; ctx.fill();

  // ── Front face border ──
  ctx.strokeStyle = '#3b82f6'; ctx.lineWidth = 1.2; ctx.strokeRect(fx, fy, fw, fh);

  // ── Top face ──
  ctx.beginPath();
  ctx.moveTo(fx, fy);
  ctx.lineTo(fx + d, fy - topOff);
  ctx.lineTo(fx + fw + d, fy - topOff);
  ctx.lineTo(fx + fw, fy);
  ctx.closePath();
  const topGrad = ctx.createLinearGradient(fx, fy - topOff, fx + fw, fy);
  topGrad.addColorStop(0, '#3b82f6'); topGrad.addColorStop(1, '#1d4ed8');
  ctx.fillStyle = topGrad; ctx.fill();
  ctx.strokeStyle = '#60a5fa'; ctx.lineWidth = 0.8; ctx.stroke();

  // Top shine
  ctx.beginPath();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(fx + fw * 0.1, fy - topOff * 0.35, fw * 0.35, topOff * 0.55);

  // Water surface shimmer line on front
  const shimmerAlpha = 0.5 + Math.sin(t * 1.8) * 0.2;
  ctx.strokeStyle = `rgba(125,211,252,${shimmerAlpha})`;
  ctx.lineWidth = Math.max(1, w * 0.08);
  ctx.beginPath(); ctx.moveTo(fx + 2, waterY); ctx.lineTo(fx + fw - 2, waterY); ctx.stroke();

  // ── Level indicator bar (right side) ──
  const barX = fx + fw + d + 3;
  const barW = Math.max(3, w * 0.17);
  ctx.fillStyle = '#1f2937'; ctx.fillRect(barX, fy, barW, fh);
  const barCol = lvl > 0.5 ? '#22c55e' : lvl > 0.25 ? '#f59e0b' : '#ef4444';
  ctx.fillStyle = barCol; ctx.fillRect(barX, fy + fh * (1 - lvl), barW, fh * lvl);

  // ── Pipe stub at bottom ──
  const stubW = Math.max(4, w * 0.22);
  ctx.fillStyle = '#374151'; ctx.fillRect(x - stubW / 2, fy + fh, stubW, Math.max(5, w * 0.32));

  // ── Label ──
  const fontSize = Math.max(9, Math.min(13, w * 0.5));
  ctx.font = `bold ${fontSize}px Cairo,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#082f49';
  ctx.strokeText(name || 'خزان', x, fy - topOff - 5);
  ctx.fillStyle = '#bae6fd'; ctx.fillText(name || 'خزان', x, fy - topOff - 5);
  ctx.restore();
}

function drawScadaPump(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, t: number, r = 16) {
  ctx.save();
  r = Math.min(18, Math.max(6, r)); // hard cap
  const rot = (t * Math.PI * 1.4) % (Math.PI * 2);
  // Shadow
  ctx.beginPath();
  ctx.ellipse(x + 2, y + r + 5, r * 0.75, Math.max(2, r * 0.25), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fill();
  // Outer ring
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a'; ctx.fill();
  ctx.strokeStyle = '#22c55e'; ctx.lineWidth = Math.max(1.5, r * 0.14); ctx.stroke();
  // Housing
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#14532d'; ctx.fill();
  // Rotating impeller
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.rotate((i * Math.PI) / 2);
    ctx.beginPath();
    ctx.moveTo(-r * 0.2, -r * 0.12);
    ctx.lineTo(-r * 0.25, -(r - 3));
    ctx.lineTo(r * 0.25, -(r - 3));
    ctx.lineTo(r * 0.2, -r * 0.12);
    ctx.closePath();
    ctx.fillStyle = `rgba(74,222,128,${0.95 - i * 0.12})`;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
  // Center hub
  ctx.beginPath();
  ctx.arc(x, y, Math.max(3, r * 0.3), 0, Math.PI * 2);
  ctx.fillStyle = '#d1fae5'; ctx.fill();
  // Pulsing ring
  const pulse = 0.5 + Math.sin(t * 5) * 0.35;
  ctx.beginPath();
  ctx.arc(x, y, r + 3, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(34,197,94,${pulse})`;
  ctx.lineWidth = 1.5; ctx.stroke();
  // Label
  const fontSize = Math.max(9, Math.min(12, r * 0.7));
  ctx.font = `bold ${fontSize}px Cairo,sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = '#052e16';
  ctx.strokeText(name || 'مضخة', x, y + r + Math.max(12, r * 0.9));
  ctx.fillStyle = '#86efac'; ctx.fillText(name || 'مضخة', x, y + r + Math.max(12, r * 0.9));
  ctx.restore();
}

function drawScadaValve(ctx: CanvasRenderingContext2D, x: number, y: number, name: string, openPct: number, r = 14) {
  ctx.save();
  r = Math.min(14, Math.max(5, r)); // hard cap
  const color = openPct > 60 ? '#22c55e' : openPct > 30 ? '#f59e0b' : '#ef4444';
  // Shadow
  ctx.beginPath();
  ctx.ellipse(x + 2, y + r + 5, r * 0.7, Math.max(2, r * 0.25), 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fill();
  // Body
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = '#1f2937'; ctx.fill();
  ctx.strokeStyle = color; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.stroke();
  // Pipe stubs
  ctx.strokeStyle = '#374151'; ctx.lineWidth = Math.max(3, r * 0.35); ctx.lineCap = 'butt';
  ctx.beginPath();
  ctx.moveTo(x - r - r * 0.5, y); ctx.lineTo(x - r + 1, y);
  ctx.moveTo(x + r - 1, y); ctx.lineTo(x + r + r * 0.5, y);
  ctx.stroke();
  // Actuator stem
  ctx.strokeStyle = '#6b7280'; ctx.lineWidth = Math.max(1.5, r * 0.18); ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y - r); ctx.lineTo(x, y - r - r * 0.6);
  ctx.moveTo(x - r * 0.36, y - r - r * 0.6); ctx.lineTo(x + r * 0.36, y - r - r * 0.6);
  ctx.stroke();
  // Butterfly disc (rotated based on open%)
  const discAngle = ((100 - openPct) / 100) * (Math.PI * 0.45);
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(discAngle);
  ctx.beginPath();
  ctx.ellipse(0, 0, r - 3, Math.max(2, r * 0.28), 0, 0, Math.PI * 2);
  ctx.fillStyle = color; ctx.globalAlpha = 0.88; ctx.fill();
  ctx.restore();
  // Percentage badge
  ctx.globalAlpha = 1;
  const badgeFontSize = Math.max(7, r * 0.55);
  ctx.font = `bold ${badgeFontSize}px monospace`;
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(`${openPct}%`, x, y + r + Math.max(10, r * 0.9));
  // Label
  const labelFontSize = Math.max(9, Math.min(11, r * 0.72));
  ctx.font = `bold ${labelFontSize}px Cairo,sans-serif`;
  ctx.lineWidth = 3; ctx.strokeStyle = '#0f172a';
  ctx.strokeText(name || 'صمام', x, y - r - r * 0.9 - 2);
  ctx.fillStyle = '#fca5a5'; ctx.fillText(name || 'صمام', x, y - r - r * 0.9 - 2);
  ctx.restore();
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MapCenterCanvas({ hideControls = false }: { hideControls?: boolean }) {
  const pathname = usePathname();
  const mapRef    = useRef<HTMLDivElement>(null);
  const mapObjRef = useRef<any>(null);
  const layersRef = useRef<Record<string, any>>({});
  const svyFocusRef = useRef<{ lat: number; lon: number; chainage: number | null; expiresAt: number } | null>(null);
  const svyPulseTickRef = useRef(0);
  const svyPulseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scadaAnimFrameRef = useRef<number>(0);

  const [ready,      setReady]      = useState(false);
  const [initErr,    setInitErr]    = useState<string | null>(null);
  const [zoom,       setZoom]       = useState(0);
  const [coords,     setCoords]     = useState<{ lon: number; lat: number } | null>(null);
  const [tileStatus, setTileStatus] = useState<'loading' | 'ok' | 'fallback' | 'error'>('loading');
  const [activeBm,   setActiveBm]   = useState<BasemapKey>('satellite');
  const [siteList, setSiteList] = useState<{ employees: MapEmployee[]; warehouses: MapWarehouse[] } | null>(null);
  const [canViewCorrosionOverlay, setCanViewCorrosionOverlay] = useState(false);
  const bmSwapIdRef                 = useRef(0);

  usePreviewGeoJsonBridge(layersRef, mapObjRef, ready);

  const workspace    = useGisEngine(s => s.workspace);
  const basemap      = useGisEngine(s => s.basemap);
  const layerVis     = useGisEngine(s => s.layerVisibility);
  const layerOpacity = useGisEngine(s => s.layerOpacity);
  const viewCenter   = useGisEngine(s => s.center);
  const viewZoom     = useGisEngine(s => s.zoom);
  const projects     = useGisEngine(s => s.projects);
  const selectedEntityType = useGisEngine(s => s.selectedEntityType);
  const selectedEntityId   = useGisEngine(s => s.selectedEntityId);
  const assets       = useGisEngine(s => s.assets);
  const workOrders   = useGisEngine(s => s.workOrders);
  const employees    = useGisEngine(s => s.employees);
  const warehouses   = useGisEngine(s => s.warehouses);
  const entityRenderMode = useGisEngine(s => s.entityRenderMode);
  const toggleEntityRenderMode = useGisEngine(s => s.toggleEntityRenderMode);
  const timeFilter   = useGisEngine(s => s.timeFilter);
  const setCenter    = useGisEngine(s => s.setCenter);
  const setZoomStore = useGisEngine(s => s.setZoom);
  const selectEntity = useGisEngine(s => s.selectEntity);
  const refreshAll   = useGisEngine(s => s.refreshAll);
  const drawingMode  = useGisEngine(s => s.drawingMode);
  const setDrawingMode = useGisEngine(s => s.setDrawingMode);
  const addDrawnFeature = useGisEngine(s => s.addDrawnFeature);
  const aoi = useGisEngine(s => s.aoi);
  const setAoi = useGisEngine(s => s.setAoi);
  const clearAoi = useGisEngine(s => s.clearAoi);
  const corridors    = useGisEngine(s => s.corridors);
  const loadCorridors = useGisEngine(s => s.loadCorridors);
  const svyCpOverlay  = useGisEngine(s => s.svyCpOverlay);
  const routeDepartment = useMemo(() => resolveDepartmentFromPath(pathname ?? ''), [pathname]);

  useEffect(() => {
    let cancelled = false;
    async function checkCorrosionOverlayVisibility() {
      if (routeDepartment === 'corrosion') {
        if (!cancelled) setCanViewCorrosionOverlay(true);
        return;
      }
      try {
        const res = await fetch('/api/v1/corrosion/sharing/visibility', {
          headers: {
            'Content-Type': 'application/json',
            'x-department': routeDepartment,
          },
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          setCanViewCorrosionOverlay(Boolean(data?.has_corrosion_access));
        }
      } catch {
        if (!cancelled) setCanViewCorrosionOverlay(false);
      }
    }
    checkCorrosionOverlayVisibility();
    return () => {
      cancelled = true;
    };
  }, [routeDepartment]);

  // Memoize AOI geometry with pre-computed _bbox for fast spatial pre-rejection.
  // Only recomputed when aoi reference changes — avoids redundant filter work.
  const aoiGeomWithBbox = useMemo(() => {
    if (!aoi?.geometry) return null;
    const geom = aoi.bbox ? { ...aoi.geometry, _bbox: aoi.bbox } : { ...aoi.geometry };
    const spatialIndex = buildAoiSpatialIndex(geom);
    return spatialIndex ? { ...geom, _spatialIndex: spatialIndex } : geom;
  }, [aoi]);

  const pendingLocationCallback = useGisEngine(s => s.pendingLocationCallback);
  const cancelLocationPick      = useGisEngine(s => s.cancelLocationPick);

  // Ref so singleclick handler always reads latest callback without re-init
  const pendingCbRef = useRef<((lon: number, lat: number) => void) | null>(null);
  useEffect(() => { pendingCbRef.current = pendingLocationCallback; }, [pendingLocationCallback]);
  const drawingModeRef = useRef<DrawingMode>('idle');
  useEffect(() => { drawingModeRef.current = drawingMode; }, [drawingMode]);
  const scadaGeoToolRef = useRef<string>('idle');

  useEffect(() => {
    const onTool = (e: Event) => {
      const ev = e as CustomEvent<{ tool?: string }>;
      scadaGeoToolRef.current = String(ev.detail?.tool || 'idle');
    };
    window.addEventListener('engineering:scada-geo-tool', onTool as EventListener);
    return () => window.removeEventListener('engineering:scada-geo-tool', onTool as EventListener);
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.style.cursor = drawingMode === 'pick-location' ? 'crosshair' : '';
  }, [drawingMode]);

  // ── Init OL once ─────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    const initWatchdog = setTimeout(() => {
      if (!cancelled && !mapObjRef.current) {
        setInitErr('تعذر تهيئة الخريطة في الوقت المتوقع. حدّث الصفحة أو أعد المحاولة.');
      }
    }, 15000);
    async function init() { console.log('DEBUG MAP init START');
      try {
        console.log('DEBUG MAP IMPORTS'); const mapMod = await import('ol/Map');
        const viewMod = await import('ol/View');
        const tileLayerMod = await import('ol/layer/Tile');
        const vectorLayerMod = await import('ol/layer/Vector');
        const heatmapLayerMod = await import('ol/layer/Heatmap');
        const xyzMod = await import('ol/source/XYZ');
        const vectorSourceMod = await import('ol/source/Vector');
        const projMod = await import('ol/proj');
        const styleMod = await import('ol/style');
        const clusterMod = await import('ol/source/Cluster');

        const OlMap: any = mapMod.default;
        const View: any = (viewMod as any).default ?? (viewMod as any).View;
        const TileLayer: any = tileLayerMod.default;
        const VectorLayer: any = vectorLayerMod.default;
        const HeatmapLayer: any = heatmapLayerMod.default;
        const XYZ: any = xyzMod.default;
        const VectorSource: any = vectorSourceMod.default;
        const Cluster: any = clusterMod.default;
        const { fromLonLat, toLonLat } = projMod;
        const { Style, Fill, Stroke, Circle: CircleStyle, Text } = styleMod as any;
        const GeoJSONWriter: any = (await import('ol/format/GeoJSON')).default;
        console.log('DEBUG MAP INSTANCE'); const geojsonWriter = new GeoJSONWriter();
        if (cancelled || !mapRef.current) return;

        const bm = BASEMAPS[basemap] ?? BASEMAPS.satellite;
        const baseLayer = new TileLayer({ source: new XYZ({ url: bm.url, attributions: [bm.attr], maxZoom: 19 }), zIndex: 0 });
        layersRef.current['base'] = baseLayer;

        const projectSource = new VectorSource();
        const projectLayer = new VectorLayer({
          source: projectSource,
          style: (f) => {
            const gt = f.getGeometry()?.getType();
            if (gt === 'Polygon' || gt === 'MultiPolygon') {
              return new Style({ fill: new Fill({ color: 'rgba(59,130,246,0.12)' }), stroke: new Stroke({ color: '#3b82f6', width: 2 }) });
            }
            const zoom = mapObjRef.current?.getView().getZoom() ?? 10;
            const showLabel = zoom >= 13;
            const dotRadius = zoom >= 13 ? 10 : zoom >= 11 ? 7 : 5;
            const name: string = f.get('name') ?? '';
            const label = showLabel ? (name.length > 16 ? name.slice(0, 16) + '…' : name) : '';
            return new Style({
              image: new CircleStyle({ radius: dotRadius, fill: new Fill({ color: '#3b82f6' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
              text: showLabel ? new Text({
                text: label,
                offsetY: -18,
                fill: new Fill({ color: '#fff' }),
                stroke: new Stroke({ color: '#0f172a', width: 3 }),
                font: 'bold 11px Cairo,sans-serif',
                backgroundFill: new Fill({ color: 'rgba(15,23,42,0.75)' }),
                padding: [2, 5, 2, 5],
              }) : undefined,
            });
          },
          zIndex: 10,
        });
        layersRef.current['projects'] = projectLayer;

        const assetSource = new VectorSource();
        const clusterSource = new Cluster({ source: assetSource, distance: 30 });
        const assetLayer = new VectorLayer({
          source: clusterSource,
          style: (f) => {
            const feats = f.get('features') as any[];
            const size = feats?.length ?? 1;
            if (size > 1) return new Style({
              image: new CircleStyle({ radius: 14 + Math.log2(size) * 2, fill: new Fill({ color: '#10b981' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
              text: new Text({ text: String(size), fill: new Fill({ color: '#fff' }), font: 'bold 12px sans-serif' }),
            });
            const hs  = feats?.[0]?.get('health_score') ?? 100;
            const col = hs < 40 ? '#ef4444' : hs < 70 ? '#f59e0b' : '#10b981';
            return new Style({ image: new CircleStyle({ radius: 8, fill: new Fill({ color: col }), stroke: new Stroke({ color: '#fff', width: 2 }) }) });
          },
          zIndex: 20,
        });
        layersRef.current['assets'] = assetLayer;

        const woSource = new VectorSource();
        const woLayer = new VectorLayer({
          source: woSource,
          style: (f) => {
            const col = WO_COLORS[f.get('priority') ?? 'medium'] ?? '#6366f1';
            return new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color: col }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) });
          },
          zIndex: 30,
        });
        layersRef.current['work_orders'] = woLayer;

        const empSource = new VectorSource();
        const empCluster = new Cluster({ source: empSource, distance: 52 });
        const empLayer = new VectorLayer({
          source: empCluster,
          style: (f) => {
            const feats = (f.get('features') as any[]) ?? [];
            const size = feats.length || 1;
            const currentZoom = mapObjRef.current?.getView?.()?.getZoom?.() ?? 0;
            if (size === 1 && currentZoom < ICON_ZOOM_THRESHOLD) return null;
            if (size > 1) {
              return new Style({
                image: new CircleStyle({ radius: 13 + Math.log2(size) * 2, fill: new Fill({ color: 'rgba(139,92,246,0.88)' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
                text: new Text({ text: String(size), fill: new Fill({ color: '#fff' }), font: 'bold 12px sans-serif' }),
              });
            }
            return new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#8b5cf6' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) });
          },
          zIndex: 25,
        });
        layersRef.current['employees'] = empLayer;

        const whSource = new VectorSource();
        const whCluster = new Cluster({ source: whSource, distance: 56 });
        const whLayer = new VectorLayer({
          source: whCluster,
          style: (f) => {
            const feats = (f.get('features') as any[]) ?? [];
            const size = feats.length || 1;
            const currentZoom = mapObjRef.current?.getView?.()?.getZoom?.() ?? 0;
            if (size === 1 && currentZoom < ICON_ZOOM_THRESHOLD) return null;
            if (size > 1) {
              return new Style({
                image: new CircleStyle({ radius: 14 + Math.log2(size) * 2, fill: new Fill({ color: 'rgba(34,211,238,0.88)' }), stroke: new Stroke({ color: '#fff', width: 2 }) }),
                text: new Text({ text: String(size), fill: new Fill({ color: '#042f2e' }), font: 'bold 12px sans-serif' }),
              });
            }
            return new Style({ image: new CircleStyle({ radius: 7, fill: new Fill({ color: '#22d3ee' }), stroke: new Stroke({ color: '#fff', width: 1.5 }) }) });
          },
          zIndex: 26,
        });
        layersRef.current['warehouses'] = whLayer;

        const densitySource = new VectorSource();

        // ── Corridors layer (orange LineString + buffer fill) ────────────────
        const corridorSource = new VectorSource();
        const corridorLayer = new VectorLayer({
          source: corridorSource,
          style: (f) => {
            const geomType = f.getGeometry()?.getType();
            if (geomType === 'Polygon') {
              return new Style({
                fill: new Fill({ color: 'rgba(249,115,22,0.08)' }),
                stroke: new Stroke({ color: 'rgba(249,115,22,0.4)', width: 1 }),
              });
            }
            return new Style({
              stroke: new Stroke({ color: '#f97316', width: 3.5, lineDash: undefined }),
              text: new Text({
                text: f.get('name') ?? '',
                offsetY: -12,
                fill: new Fill({ color: '#f97316' }),
                stroke: new Stroke({ color: '#0f172a', width: 3 }),
                font: 'bold 11px sans-serif',
              }),
            });
          },
          zIndex: 40,
        });
        layersRef.current['corridors'] = corridorLayer;

        // ── SVY CP Survey overlay (from corrosion module) ──────────────────
        const svyCpSource = new VectorSource();
        const svyCpLayer = new VectorLayer({
          source: svyCpSource,
          style: (f) => {
            const status = f.get('protection_status') as string;
            const color = status === 'PROTECTED' ? '#22c55e'
              : status === 'MARGINAL' ? '#f59e0b'
              : '#ef4444';

            const focus = svyFocusRef.current;
            const lat = Number(f.get('gps_lat'));
            const lon = Number(f.get('gps_lon'));
            const chainage = Number(f.get('chainage_m'));
            const hasFocus = !!focus && Date.now() <= focus.expiresAt;
            const matchByCoord = hasFocus && Number.isFinite(lat) && Number.isFinite(lon)
              && Math.abs(lat - focus.lat) < 0.00008
              && Math.abs(lon - focus.lon) < 0.00008;
            const matchByChainage = hasFocus && focus.chainage !== null && Number.isFinite(chainage)
              && Math.abs(chainage - focus.chainage) <= 2;
            const focused = matchByCoord || matchByChainage;
            const pulseOn = focused ? (svyPulseTickRef.current % 2 === 0) : false;

            return new Style({
              image: new CircleStyle({
                radius: focused ? (pulseOn ? 10 : 7) : 5,
                fill: new Fill({ color }),
                stroke: new Stroke({ color: focused ? '#f8fafc' : '#0f172a', width: focused ? 2.5 : 1 }),
              }),
            });
          },
          zIndex: 60,
        });
        layersRef.current['svy_cp_overlay'] = svyCpLayer;

        const densityHeatmapLayer = new HeatmapLayer({
          source: densitySource,
          radius: 20,
          blur: 32,
          weight: (f: any) => Number(f.get('weight') ?? 1),
          zIndex: 22,
        });
        layersRef.current['density_heatmap'] = densityHeatmapLayer;

        const densityCluster = new Cluster({ source: densitySource, distance: 70 });
        const densityChartLayer = new VectorLayer({
          source: densityCluster,
          style: (f) => {
            const feats = (f.get('features') as any[]) ?? [];
            const size = feats.length || 1;
            if (size <= 1) return null;
            const radius = Math.min(34, 11 + Math.log2(size) * 4);
            return new Style({
              image: new CircleStyle({ radius, fill: new Fill({ color: 'rgba(251,146,60,0.35)' }), stroke: new Stroke({ color: 'rgba(251,146,60,0.95)', width: 2.5 }) }),
              text: new Text({ text: String(size), fill: new Fill({ color: '#ffedd5' }), font: 'bold 13px sans-serif' }),
            });
          },
          zIndex: 27,
        });
        layersRef.current['density_chart'] = densityChartLayer;

        const aoiSource = new VectorSource();
        const aoiFocusLayer = new VectorLayer({
          source: aoiSource,
          style: new Style({
            stroke: new Stroke({ color: '#22d3ee', width: 2.5 }),
            fill: new Fill({ color: 'rgba(34, 211, 238, 0.15)' }),
          }),
          zIndex: 90,
        });
        layersRef.current['aoi_focus'] = aoiFocusLayer;

        const aoiMaskSource = new VectorSource();
        const aoiMaskLayer = new VectorLayer({
          source: aoiMaskSource,
          style: new Style({
            fill: new Fill({ color: 'rgba(2, 6, 23, 0.46)' }),
            stroke: new Stroke({ color: 'rgba(125, 211, 252, 0.35)', width: 1 }),
          }),
          zIndex: 85,
        });
        layersRef.current['aoi_mask'] = aoiMaskLayer;

        const c = WS_CENTER[workspace] ?? [13.19, 32.89];
        const z = WS_ZOOM[workspace]   ?? 11;
        
        // ── Principal assets layer (cyan polygon / emerald path) ─────────
        const principalSource = new VectorSource();
        const principalLayer = new VectorLayer({
          source: principalSource,
          style: (f) => {
            const geomType = f.getGeometry()?.getType();
            const zoom = mapObjRef.current?.getView().getZoom() ?? 10;
            const showLabel = zoom >= 9.5;
            const name: string = f.get('name') ?? '';
            const label = showLabel ? (name.length > 18 ? name.slice(0, 18) + '…' : name) : '';
            if (geomType === 'LineString' || geomType === 'MultiLineString') {
              return new Style({
                stroke: new Stroke({ color: '#10b981', width: 3 }),
                text: showLabel ? new Text({
                  text: label, font: 'bold 14px Cairo,sans-serif',
                  fill: new Fill({ color: '#10b981' }),
                  stroke: new Stroke({ color: '#0f172a', width: 3 }),
                  backgroundFill: new Fill({ color: 'rgba(15,23,42,0.8)' }),
                  padding: [3, 6, 3, 6],
                }) : undefined,
              });
            }
            return new Style({
              fill: new Fill({ color: 'rgba(6,182,212,0.10)' }),
              stroke: new Stroke({ color: '#06b6d4', width: 2.5 }),
              text: showLabel ? new Text({
                text: label, font: 'bold 14px Cairo,sans-serif',
                fill: new Fill({ color: '#06b6d4' }),
                stroke: new Stroke({ color: '#0f172a', width: 3 }),
                backgroundFill: new Fill({ color: 'rgba(15,23,42,0.8)' }),
                padding: [3, 6, 3, 6],
              }) : undefined,
            });
          },
          zIndex: 8,
        });
        layersRef.current['principal_assets'] = principalLayer;

        // ── Child assets layer (colored by asset_type) ──────────────────
        const CHILD_ASSET_COLORS: Record<string, string> = {
          storage:   '#f97316', building:  '#3b82f6', valve:     '#ef4444',
          pump:      '#06b6d4', generator: '#f59e0b', tank:      '#8b5cf6',
          station:   '#10b981', junction:  '#64748b', sensor:    '#22d3ee',
          equipment: '#a855f7', office:    '#84cc16', other:     '#6b7280',
        };
        const CHILD_DEPT_LABELS: Record<string, string> = {
          engineering: 'الهندسة', services: 'الخدمات', electricity: 'الكهرباء',
          maintenance: 'الصيانة', communications: 'الاتصالات', hr: 'الموارد البشرية',
          facilities: 'المرافق', technical: 'التقني',
        };

        const childAssetSource = new VectorSource();
        const childAssetLayer = new VectorLayer({
          source: childAssetSource,
          style: (f) => {
            const t = f.get('asset_type') ?? 'other';
            const col = CHILD_ASSET_COLORS[t] ?? '#6b7280';
            const geomType = f.getGeometry()?.getType();
            const zoom = mapObjRef.current?.getView().getZoom() ?? 10;
            const showLabel = zoom >= 10;
            const nameRaw: string = f.get('name') ?? '';
            const deptLabel = CHILD_DEPT_LABELS[f.get('owner_department') ?? ''] ?? '';
            const labelText = showLabel
              ? (nameRaw.length > 14 ? nameRaw.slice(0, 14) + '…' : nameRaw)
              : '';
            if (geomType === 'Polygon' || geomType === 'MultiPolygon') {
              return new Style({
                fill: new Fill({ color: col + '28' }),
                stroke: new Stroke({ color: col, width: 2.5 }),
                text: showLabel ? new Text({
                  text: labelText + (deptLabel ? '\n' + deptLabel : ''),
                  font: 'bold 12px Cairo,sans-serif',
                  fill: new Fill({ color: col }),
                  stroke: new Stroke({ color: '#0f172a', width: 3 }),
                  backgroundFill: new Fill({ color: 'rgba(15,23,42,0.75)' }),
                  padding: [3, 5, 3, 5],
                }) : undefined,
              });
            }
            if (geomType === 'LineString' || geomType === 'MultiLineString') {
              return new Style({
                stroke: new Stroke({ color: col, width: 3, lineDash: [8, 4] }),
                text: showLabel ? new Text({
                  text: labelText,
                  font: 'bold 12px Cairo,sans-serif',
                  fill: new Fill({ color: col }),
                  stroke: new Stroke({ color: '#0f172a', width: 3 }),
                  backgroundFill: new Fill({ color: 'rgba(15,23,42,0.75)' }),
                  padding: [3, 5, 3, 5],
                }) : undefined,
              });
            }
            const dotR = zoom >= 14 ? 9 : zoom >= 12 ? 7 : 6;
            return new Style({
              image: new CircleStyle({
                radius: dotR,
                fill: new Fill({ color: col }),
                stroke: new Stroke({ color: '#fff', width: 2 }),
              }),
              text: showLabel ? new Text({
                text: labelText + (deptLabel ? '\n' + deptLabel : ''),
                offsetY: -(dotR + 10),
                font: 'bold 12px Cairo,sans-serif',
                fill: new Fill({ color: col }),
                stroke: new Stroke({ color: '#0f172a', width: 3 }),
                backgroundFill: new Fill({ color: 'rgba(15,23,42,0.82)' }),
                padding: [3, 5, 3, 5],
              }) : undefined,
            });
          },
          zIndex: 35,
        });
        layersRef.current['child_assets'] = childAssetLayer;

        // ── Geo-SCADA layer (draw directly on geographic map) ──────────────
        const scadaGeoSource = new VectorSource();
        const scadaGeoLayer = new VectorLayer({
          source: scadaGeoSource,
          // Rendering handled entirely by postrender (3D/animated visuals)
          style: () => new Style({}),
          zIndex: 96,
        });
        layersRef.current['scada_geo'] = scadaGeoLayer;
        layersRef.current['scada_geo_source'] = scadaGeoSource;

        try {
          const raw = window.localStorage.getItem('engineering_scada_geo_features_v1');
          if (raw) {
            const parsed = JSON.parse(raw);
            const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
            const fmt = new GeoJSONFmt();
            const feats = fmt.readFeatures(parsed, {
              featureProjection: 'EPSG:3857',
              dataProjection: 'EPSG:4326',
            });
            if (Array.isArray(feats) && feats.length) scadaGeoSource.addFeatures(feats);
          }
        } catch {
          // Ignore malformed local draft data.
        }

        // ── Geo-SCADA animated postrender ──────────────────────────────────────
        scadaGeoLayer.on('postrender', (evt: any) => {
          const ctx: CanvasRenderingContext2D | null = evt.context ?? null;
          if (!ctx) return;
          const map = mapObjRef.current;
          if (!map) return;
          const t = Date.now() / 1000;
          const pixelRatio = (evt.frameState?.pixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1) ?? 1) as number;
          // Inverse zoom scale: larger symbols when zoomed out, smaller when zoomed in
          const zoom = map.getView().getZoom() ?? 14;
          // Never grow beyond base size — only shrink when zoomed in past z14
          const zoomScale = Math.min(1.0, Math.max(0.4, Math.pow(2, (14 - zoom) * 0.26)));
          // Pump and valve are always smaller than tank
          const tankBase = 44, pumpBase = 18, valveBase = 14;
          ctx.save();
          // Reset transform to CSS-pixel space scaled by pixelRatio — fixes position drift
          ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          for (const feature of scadaGeoSource.getFeatures()) {
            const kind = String(feature.get('scada_kind') || '');
            const name = String(feature.get('name_ar') || feature.get('name') || '');
            const geom = feature.getGeometry();
            if (!geom) continue;
            const gtype = geom.getType();
            if (gtype === 'LineString') {
              const coords = (geom as any).getCoordinates() as number[][];
              const pixels = coords
                .map((c: number[]) => map.getPixelFromCoordinate(c))
                .filter(Boolean) as [number, number][];
              if (pixels.length >= 2) drawScadaPipe(ctx, pixels, t);
            } else if (gtype === 'Point') {
              const coord = (geom as any).getCoordinates() as number[];
              const px = map.getPixelFromCoordinate(coord);
              if (!px) continue;
              const [cx, cy] = px;
              const openPct = Number(feature.get('open_pct') ?? 65);
              // All use same zoomScale so proportions are preserved
              if (kind === 'tank') drawScadaTank(ctx, cx, cy, name, t, Math.round(tankBase * zoomScale));
              else if (kind === 'pump') drawScadaPump(ctx, cx, cy, name, t, Math.round(pumpBase * zoomScale));
              else if (kind === 'valve') drawScadaValve(ctx, cx, cy, name, openPct, Math.round(valveBase * zoomScale));
            } else if (gtype === 'Polygon' && kind === 'tank') {
              // Tank drawn as polygon: use actual geographic footprint on screen
              const extent = (geom as any).getExtent() as [number, number, number, number];
              const pxTL = map.getPixelFromCoordinate([extent[0], extent[3]]);
              const pxBR = map.getPixelFromCoordinate([extent[2], extent[1]]);
              if (!pxTL || !pxBR) continue;
              const cx = (pxTL[0] + pxBR[0]) / 2;
              const cy = (pxTL[1] + pxBR[1]) / 2;
              const geoW = Math.abs(pxBR[0] - pxTL[0]);
              const geoH = Math.abs(pxBR[1] - pxTL[1]);
              // Polygon tank: use actual screen footprint — no upper cap so drawn size is respected
              const minHalf = 14;
              const halfW = Math.max(Math.max(geoW, geoH) / 2, minHalf);
              drawScadaTank(ctx, cx, cy, name, t, halfW);
            }
          }
          ctx.restore();
        });
        // Kick off continuous repaint for animations
        const tickSCADA = () => {
          if (!cancelled && mapObjRef.current) scadaGeoLayer.changed();
          if (!cancelled) scadaAnimFrameRef.current = requestAnimationFrame(tickSCADA);
        };
        scadaAnimFrameRef.current = requestAnimationFrame(tickSCADA);

        const mapLayers = workspace === 'satellite'
          // Keep core asset registry visible in satellite mode across all screens.
          ? [baseLayer, principalLayer, childAssetLayer, scadaGeoLayer, svyCpLayer, aoiMaskLayer, aoiFocusLayer]
          : [baseLayer, principalLayer, projectLayer, assetLayer, childAssetLayer, densityHeatmapLayer, woLayer, empLayer, whLayer, densityChartLayer, corridorLayer, scadaGeoLayer, svyCpLayer, aoiMaskLayer, aoiFocusLayer];
        
        const map = new OlMap({
          target: mapRef.current!,
          layers: mapLayers,
          view: new View({ center: fromLonLat(c), zoom: z, minZoom: 2, maxZoom: 20 }),
          controls: [],
        });
        console.log('DEBUG MAP DONE'); mapObjRef.current = map;
        setSharedOlMap(map);

        // Re-render project labels when zoom level crosses the label threshold
        map.getView().on('change:resolution', () => {
          projectLayer.getSource()?.changed();
          layersRef.current['principal_assets']?.getSource?.()?.changed?.();
          layersRef.current['child_assets']?.getSource?.()?.changed?.();
        });

        // Guard against zero-sized target during first paint and future layout changes.
        requestAnimationFrame(() => map.updateSize());
        if (typeof ResizeObserver !== 'undefined' && mapRef.current) {
          const ro = new ResizeObserver(() => map.updateSize());
          ro.observe(mapRef.current);
          layersRef.current['mapResizeObserver'] = ro;
        }

        // Drawing layer — cyan features on top
        const { default: VectorLayerDraw } = await import('ol/layer/Vector');
        const drawSource = new VectorSource();
        const drawLayer = new VectorLayerDraw({
          source: drawSource,
          style: new (await import('ol/style')).Style({
            stroke: new (await import('ol/style')).Stroke({ color: '#06b6d4', width: 2.5 }),
            fill:   new (await import('ol/style')).Fill({ color: 'rgba(6,182,212,0.10)' }),
            image:  new (await import('ol/style')).Circle({ radius: 6, fill: new (await import('ol/style')).Fill({ color: '#06b6d4' }), stroke: new (await import('ol/style')).Stroke({ color: '#fff', width: 2 }) }),
          }),
          zIndex: 100,
        });
        map.addLayer(drawLayer);
        layersRef.current['draw'] = drawLayer;
        layersRef.current['drawSource'] = drawSource;

        // Hover twin preview for magnetic trace over river pipelines/canals.
        const traceTwinSource = new VectorSource();
        const traceTwinLayer = new VectorLayerDraw({
          source: traceTwinSource,
          style: new (await import('ol/style')).Style({
            stroke: new (await import('ol/style')).Stroke({ color: '#22d3ee', width: 4, lineDash: [8, 6] }),
          }),
          zIndex: 115,
        });
        map.addLayer(traceTwinLayer);
        layersRef.current['trace_twin'] = traceTwinLayer;
        layersRef.current['trace_twin_source'] = traceTwinSource;

        map.on('moveend', () => {
          const v = map.getView();
          const z2 = Math.round(v.getZoom() ?? 0);
          const [lon, lat] = toLonLat(v.getCenter()!);
          setZoom(z2); setZoomStore(z2); setCenter([lon, lat]);
        });
        map.on('pointermove', (e: any) => {
          const [lon, lat] = toLonLat(e.coordinate);
          setCoords({ lon: +lon.toFixed(5), lat: +lat.toFixed(5) });
          window.dispatchEvent(new CustomEvent('gis:cursor-coords', { detail: { lon: +lon.toFixed(5), lat: +lat.toFixed(5) } }));

          const twinSource = layersRef.current['trace_twin_source'];
          if (!twinSource) return;
          twinSource.clear();
          if (drawingModeRef.current !== 'trace') return;

          let hoveredRiver: any = null;
          map.forEachFeatureAtPixel(
            e.pixel,
            (f: any, layer: any) => {
              if (hoveredRiver) return;
              const infraType = layer?.get?.('_infraType');
              if (infraType !== 'river') return;
              hoveredRiver = f.get?.('features')?.[0] ?? f;
            },
            { hitTolerance: 6 },
          );
          if (hoveredRiver) twinSource.addFeature(hoveredRiver.clone());
        });
        map.on('singleclick', (e: any) => {
          // Pick mode: deliver coordinates to waiting form, or keep as live coordinate pick.
          if (drawingModeRef.current === 'pick-location') {
            const [lon, lat] = toLonLat(e.coordinate);
            const pickedLon = +lon.toFixed(6);
            const pickedLat = +lat.toFixed(6);
            if (pendingCbRef.current) {
              pendingCbRef.current(pickedLon, pickedLat);
              cancelLocationPick();
            } else {
              setCoords({ lon: +pickedLon.toFixed(5), lat: +pickedLat.toFixed(5) });
            }
            return;
          }
          let hit = false;
          map.forEachFeatureAtPixel(e.pixel, (f: any, layer: any) => {
            if (hit) return;
            const infraType = layer?.get?.('_infraType');
            if (infraType === 'river' || infraType === 'power') {
              const feat = f.get?.('features')?.[0] ?? f;
              const geometry = geojsonWriter.writeFeatureObject(feat, {
                featureProjection: 'EPSG:3857',
                dataProjection: 'EPSG:4326',
              })?.geometry;
              if (geometry) {
                const rawName = String(feat.get?.('name') ?? '').trim();
                const sourceId = String(feat.getId?.() ?? feat.get?.('osm_id') ?? feat.get?.('_osm_id') ?? '');
                window.dispatchEvent(new CustomEvent('admin-gateway:open-engineering-core'));
                window.dispatchEvent(new CustomEvent('engineering:adopt-feature', {
                  detail: {
                    name: rawName || (infraType === 'river' ? 'مسار نهر محلي' : 'خط نقل طاقة محلي'),
                    geometry,
                    geometry_type: 'line',
                    asset_type: infraType === 'river' ? 'pipeline' : 'power_line',
                    category: infraType === 'river' ? 'مشروع النهر' : 'electrical',
                    source: 'gis_core',
                    source_ref: `${infraType}:${sourceId}`,
                    properties: {
                      layer: feat.get?.('layer') ?? infraType,
                      source_table: feat.get?.('source_table') ?? null,
                      power: feat.get?.('power') ?? null,
                      waterway: feat.get?.('waterway') ?? null,
                      man_made: feat.get?.('man_made') ?? null,
                      adopted_from_map: true,
                    },
                  },
                }));
                hit = true;
                return;
              }
            }
            const feats = f.get('features') as any[];
            if (feats?.length) {
              const emps: MapEmployee[] = [];
              const whs: MapWarehouse[] = [];
              for (const cf of feats) {
                const t = cf.get('entity_type');
                if (t === 'employee') {
                  emps.push({
                    id: cf.get('entity_id'),
                    name: cf.get('name') ?? 'موظف',
                    department: cf.get('department') ?? 'غير محدد',
                    latitude: cf.get('latitude') ?? null,
                    longitude: cf.get('longitude') ?? null,
                    location_status: 'located',
                    active: true,
                  });
                }
                if (t === 'warehouse') {
                  whs.push({
                    id: cf.get('entity_id'),
                    name: cf.get('name') ?? 'مخزن',
                    city: cf.get('city') ?? null,
                    latitude: cf.get('latitude') ?? null,
                    longitude: cf.get('longitude') ?? null,
                    capacity: cf.get('capacity') ?? null,
                    status: cf.get('status') ?? 'active',
                  });
                }
              }
              if (emps.length || whs.length) {
                setSiteList({ employees: emps, warehouses: whs });
                hit = true;
                return;
              }
            }

            const feat = feats?.[0] ?? f;
            const etype = feat.get('entity_type');
            const eid   = feat.get('entity_id');
            if (etype && eid != null) { selectEntity(etype, eid); hit = true; }
          });
          if (!hit) {
            selectEntity(null, null);
            setSiteList(null);
          }
        });

        setReady(true);
      } catch (err: any) { setInitErr(err.message ?? 'خطأ في تهيئة الخريطة'); }
    }
    init();
    return () => {
      cancelled = true;
      cancelAnimationFrame(scadaAnimFrameRef.current);
      clearTimeout(initWatchdog);
      setSharedOlMap(null);
      const ro = layersRef.current['mapResizeObserver'];
      if (ro && typeof ro.disconnect === 'function') ro.disconnect();
      mapObjRef.current?.setTarget(undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Drawing interactions (engineering mode) ──────────────────────
  useEffect(() => {
    if (!mapObjRef.current) return;
    const map = mapObjRef.current;
    const drawSource = layersRef.current['drawSource'];
    const scadaGeoSource = layersRef.current['scada_geo_source'];
    if (!drawSource) return;

    (async () => {
      const { Draw, Modify, Select, Snap } = await import('ol/interaction');
      const VectorSourceAny: any = (await import('ol/source/Vector')).default;

      const persistScadaGeo = () => {
        if (!scadaGeoSource) return;
        try {
          const GeoJSONFmt: any = require('ol/format/GeoJSON').default;
          const fmt = new GeoJSONFmt();
          const fc = fmt.writeFeaturesObject(scadaGeoSource.getFeatures(), {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326',
          });
          window.localStorage.setItem('engineering_scada_geo_features_v1', JSON.stringify(fc));
        } catch {
          // Keep drawing even if persistence fails.
        }
      };

      // Remove existing draw/modify/select interactions
      const toRemove = map.getInteractions().getArray().filter(
        (i: any) => i instanceof Draw || i instanceof Modify || i instanceof Select || i instanceof Snap,
      );
      toRemove.forEach((i: any) => map.removeInteraction(i));

      if (drawingMode === 'idle' || drawingMode === 'inspect-coordinate' || drawingMode === 'pick-location') {
        layersRef.current['trace_twin_source']?.clear?.();
        return;
      }

      const activeScadaTool = scadaGeoToolRef.current;
      const isScadaPathMode = activeScadaTool === 'path' && drawingMode === 'line';

      // Build snapping source from visible map layers + draw layer.
      const snapSource = new VectorSourceAny();
      const snapLayerKeys = [
        'projects',
        'assets',
        'principal_assets',
        'child_assets',
        'work_orders',
        'employees',
        'warehouses',
        'draw',
        'scada_geo',
        'infra_roads',
        'infra_wadi',
        'infra_river',
        'infra_power',
      ];
      snapLayerKeys.forEach((k) => {
        const layer = layersRef.current[k];
        const source = layer?.getSource?.()?.getSource?.() ?? layer?.getSource?.();
        const features = source?.getFeatures?.() ?? [];
        features.forEach((f: any) => {
          const geom = f.getGeometry?.();
          if (!geom) return;
          const gt = geom.getType?.();
          if (gt === 'Point' || gt === 'LineString' || gt === 'Polygon' || gt === 'MultiPolygon' || gt === 'MultiLineString') {
            snapSource.addFeature(f.clone());
          }
        });
      });

      // For trace and Geo-SCADA path: also load infra roads + wadis + river pipelines/canals from PostGIS within current viewport.
      if (drawingMode === 'trace' || isScadaPathMode) {
        try {
          const extent = map.getView().calculateExtent(map.getSize());
          const { toLonLat } = await import('ol/proj');
          const ll = toLonLat([extent[0], extent[1]]);
          const ur = toLonLat([extent[2], extent[3]]);
          const url = `/gis/infra-trace?minx=${ll[0].toFixed(4)}&miny=${ll[1].toFixed(4)}&maxx=${ur[0].toFixed(4)}&maxy=${ur[1].toFixed(4)}&layers=roads,wadi,river,power&limit=2500`;
          const resp = await fetch(url);
          if (resp.ok) {
            const gj = await resp.json();
            const { GeoJSON: GeoJSONFormat } = await import('ol/format');
            const fmt = new GeoJSONFormat();
            const infraFeatures = fmt.readFeatures(gj, { featureProjection: 'EPSG:3857', dataProjection: 'EPSG:4326' });
            infraFeatures.forEach((f: any) => snapSource.addFeature(f));
          }
        } catch {
          // trace falls back to existing layers only
        }
      }

      if (drawingMode === 'polygon' || drawingMode === 'line' || drawingMode === 'point' || drawingMode === 'aoi-rectangle' || drawingMode === 'trace' || drawingMode === 'orthogonal-polygon' ||
          drawingMode === 'measure-distance' || drawingMode === 'measure-area') {
        const olType = (
          drawingMode === 'polygon' || drawingMode === 'measure-area' || drawingMode === 'orthogonal-polygon' ? 'Polygon' :
          drawingMode === 'line'    || drawingMode === 'measure-distance' ? 'LineString' : 'Point'
        ) as 'Polygon' | 'LineString' | 'Point';

        const draw = drawingMode === 'aoi-rectangle'
          ? new Draw({
            source: drawSource,
            type: 'Circle',
            geometryFunction: (await import('ol/interaction/Draw')).createBox(),
          })
          : new Draw({
            source: drawSource,
            type: drawingMode === 'trace' ? 'LineString' : olType,
            trace: drawingMode === 'trace',
            traceSource: drawingMode === 'trace' ? snapSource : undefined,
            snapTolerance: isScadaPathMode ? 24 : 16,
          });

        let scadaToolAtDrawStart = 'idle';
        draw.on('drawstart', () => {
          scadaToolAtDrawStart = String(scadaGeoToolRef.current || 'idle');
        });

        // Smart magnetic snapping on all vertices + edges.
        map.addInteraction(new Snap({
          source: snapSource,
          edge: true,
          vertex: true,
          pixelTolerance: isScadaPathMode ? 20 : 14,
        }));

        draw.on('drawend', async (e: any) => {
          if (drawingMode === 'orthogonal-polygon') {
            const g = e.feature?.getGeometry?.();
            if (g?.getType?.() === 'Polygon') {
              const fixed = orthogonalizePolygonCoordinates(g.getCoordinates());
              g.setCoordinates(fixed);
            }
          }
          const { default: GeoJSON } = require('ol/format/GeoJSON');
          const writer = new GeoJSON();
          const geojson = JSON.parse(writer.writeFeature(e.feature, {
            featureProjection: 'EPSG:3857',
            dataProjection: 'EPSG:4326',
          }));
          addDrawnFeature(drawingMode, geojson);

          // Geo-referenced SCADA drawing mode: persist and render on dedicated map layer.
          const isScadaLine = scadaToolAtDrawStart === 'path' && (drawingMode === 'line' || drawingMode === 'trace');
          const isScadaPoint = (scadaToolAtDrawStart === 'valve' || scadaToolAtDrawStart === 'pump') && (drawingMode as string) === 'point';
          const isScadaPolygon = scadaToolAtDrawStart === 'tank' && drawingMode === 'polygon';
          if ((isScadaLine || isScadaPoint || isScadaPolygon) && scadaGeoSource) {
            if (isScadaLine) {
              e.feature.set('scada_kind', 'path');
              e.feature.set('name_ar', 'مسار منظومة');
            } else if (isScadaPolygon) {
              e.feature.set('scada_kind', 'tank');
              e.feature.set('name_ar', 'خزان');
            } else {
              e.feature.set('scada_kind', scadaToolAtDrawStart);
              e.feature.set('name_ar', scadaToolAtDrawStart === 'pump' ? 'مضخة' : 'صمام');
            }
            e.feature.set('scada_geo', true);
            drawSource.removeFeature(e.feature);
            scadaGeoSource.addFeature(e.feature);
            persistScadaGeo();
            return;
          }

          // ── Asset-centric: dispatch feature-drawn for polygon / line / point ──
          if (drawingMode === 'polygon' || drawingMode === 'line' || drawingMode === 'orthogonal-polygon') {
            window.dispatchEvent(new CustomEvent('engineering:feature-drawn', {
              detail: {
                geometry: geojson.geometry,
                mode: drawingMode,
              },
            }));
            // Reset draw mode so the interaction is removed and modal can open
            setDrawingMode('idle');
          } else if ((drawingMode as string) === 'point') {
            // Child asset point picking
            window.dispatchEvent(new CustomEvent('asset:child-point-picked', {
              detail: { geometry: geojson.geometry },
            }));
          } else if (drawingMode === 'aoi-rectangle') {
            const { toLonLat } = await import('ol/proj');
            const extent = e.feature?.getGeometry?.()?.getExtent?.();
            const bbox = Array.isArray(extent) && extent.length === 4
              ? (() => {
                const [minX, minY, maxX, maxY] = extent;
                const [west, south] = toLonLat([minX, minY]);
                const [east, north] = toLonLat([maxX, maxY]);
                return [west, south, east, north] as [number, number, number, number];
              })()
              : null;
            setAoi({
              source: 'manual-rectangle',
              name: 'نطاق يدوي (مربع)',
              geometry: geojson.geometry,
              bbox,
              updatedAt: new Date().toISOString(),
            });
            window.dispatchEvent(new CustomEvent('admin-gateway:open-engineering-core'));
            window.dispatchEvent(new CustomEvent('engineering:focus-extract'));
            window.dispatchEvent(new CustomEvent('engineering:set-aoi', {
              detail: {
                geometry: geojson.geometry,
                source: 'manual-rectangle',
                name: 'نطاق يدوي (مربع)',
              },
            }));
          }
        });
        map.addInteraction(draw);
      } else if (drawingMode === 'modify') {
        map.addInteraction(new Modify({ source: drawSource }));
      } else if (drawingMode === 'delete') {
        const select = new Select();
        select.on('select', (e: any) => {
          e.selected.forEach((f: any) => {
            drawSource.removeFeature(f);
            scadaGeoSource?.removeFeature?.(f);
          });
          persistScadaGeo();
          (select.getFeatures() as any).clear();
        });
        map.addInteraction(select);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawingMode]);

  useEffect(() => {
    if (!ready) return;
    const scadaGeoSource = layersRef.current['scada_geo_source'];
    if (!scadaGeoSource) return;

    const clearGeoScada = () => {
      scadaGeoSource.clear();
      try {
        window.localStorage.removeItem('engineering_scada_geo_features_v1');
      } catch {
        // ignore
      }
    };

    window.addEventListener('engineering:scada-geo-clear', clearGeoScada as EventListener);
    return () => window.removeEventListener('engineering:scada-geo-clear', clearGeoScada as EventListener);
  }, [ready]);

  // ── Child assets layer loader ────────────────────────────────────────────
  // ── Principal assets layer loader ───────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const loadPrincipalAssets = async () => {
      const source = layersRef.current['principal_assets']?.getSource?.();
      if (!source) return;
      try {
        console.log('DEBUG MAP FETCH PA'); const res = await fetch('/api/engineering/workspace/principal-assets', {
          headers: getTenantHeader(),
        });
        if (!res.ok || cancelled) return;
        const assets: any[] = await res.json();
        const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
        const fmt = new GeoJSONFmt();
        source.clear();
        for (const a of assets) {
          if (!a.geometry) continue;
          try {
            const feats = fmt.readFeatures(
              { type: 'Feature', geometry: a.geometry, properties: {} },
              { featureProjection: 'EPSG:3857' }
            );
            feats.forEach((f: any) => {
              f.set('name', a.name);
              f.set('id', a.id);
              source.addFeature(f);
            });
          } catch { /* skip bad geom */ }
        }
      } catch { /* ignore */ }
    };

    loadPrincipalAssets();

    const handler = () => { if (!cancelled) loadPrincipalAssets(); };
    window.addEventListener('engineering:refresh-principal-layer', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('engineering:refresh-principal-layer', handler);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;

    const loadChildAssets = async () => {
      const source = layersRef.current['child_assets']?.getSource?.();
      if (!source) return;
      try {
        console.log('DEBUG MAP FETCH AC'); const res = await fetch('/api/engineering/workspace/principal-assets/all-children', {
          headers: getTenantHeader(),
        });
        if (!res.ok || cancelled) return;
        const children: any[] = await res.json();
        const GeoJSONFmt: any = (await import('ol/format/GeoJSON')).default;
        const FeatureCls: any = (await import('ol/Feature')).default;
        const fmt = new GeoJSONFmt();
        source.clear();
        for (const c of children) {
          if (!c.geometry) continue;
          try {
            const feats = fmt.readFeatures(
              { type: 'Feature', geometry: c.geometry, properties: {} },
              { featureProjection: 'EPSG:3857' }
            );
            feats.forEach((f: any) => {
              f.set('name', c.name);
              f.set('asset_type', c.asset_type);
              f.set('owner_department', c.owner_department);
              f.set('status', c.status);
              f.set('id', c.id);
              source.addFeature(f);
            });
          } catch { /* skip bad geom */ }
        }
      } catch { /* ignore */ }
    };

    loadChildAssets();

    const handler = () => { if (!cancelled) loadChildAssets(); };
    window.addEventListener('engineering:refresh-child-layer', handler);
    return () => {
      cancelled = true;
      window.removeEventListener('engineering:refresh-child-layer', handler);
    };
  }, [ready]);

  // ── Swap basemap + auto-fallback ─────────────────────────────────────────
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    const baseLayer = layersRef.current['base'];
    if (!baseLayer) return;

    const FALLBACK_CHAIN: BasemapKey[] = ['satellite', 'road', 'light', 'terrain'];

    bmSwapIdRef.current += 1;
    const swapId = bmSwapIdRef.current;

    const tryBm = async (key: BasemapKey) => {
      const XYZ: any = (await import('ol/source/XYZ')).default;
      const bm = BASEMAPS[key] ?? BASEMAPS.satellite;
      const src = new XYZ({ url: bm.url, attributions: [bm.attr], maxZoom: 19 });

      let triggered = false;
      let loaded = false;
      src.on('tileloaderror', () => {
        if (triggered || bmSwapIdRef.current !== swapId) return;
        triggered = true;
        const next = FALLBACK_CHAIN[FALLBACK_CHAIN.indexOf(key) + 1];
        if (next) { setTileStatus('fallback'); tryBm(next); }
        else       setTileStatus('error');
      });
      src.on('tileloadend', () => {
        if (bmSwapIdRef.current !== swapId) return;
        loaded = true;
        setTileStatus('ok');
      });

      // Some providers fail silently (no tile events) on certain networks.
      // Add a timeout-based fallback to avoid a permanently blank map.
      setTimeout(() => {
        if (bmSwapIdRef.current !== swapId || triggered || loaded) return;
        if (!loaded) {
          triggered = true;
          const next = FALLBACK_CHAIN[FALLBACK_CHAIN.indexOf(key) + 1];
          if (next) { setTileStatus('fallback'); tryBm(next); }
          else setTileStatus('error');
        }
      }, 2500);

      baseLayer.setSource(src);
      setActiveBm(key);
    };

    setTileStatus('loading');
    tryBm(basemap as BasemapKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basemap, ready]);


  useEffect(() => {
    (Object.keys(layerVis) as string[]).forEach(id => {
      const layer = layersRef.current[id];
      if (!layer) return;
      if (id === 'employees' || id === 'warehouses') {
        layer.setVisible((layerVis as any)[id] && entityRenderMode === 'icons');
      } else {
        layer.setVisible((layerVis as any)[id]);
      }
      layer.setOpacity((layerOpacity as any)[id] ?? 1.0);
    });

    const densityVisible = entityRenderMode === 'density' && (layerVis.heatmap || layerVis.employees || layerVis.warehouses || layerVis.contracts);
    layersRef.current['density_heatmap']?.setVisible(densityVisible);
    layersRef.current['density_chart']?.setVisible(densityVisible);
  }, [layerVis, layerOpacity, entityRenderMode]);

  // ── Smooth fly-to from store (no map remount/no flicker) ─────────────────
  useEffect(() => {
    if (!ready || !mapObjRef.current) return;
    let cancelled = false;

    (async () => {
      const map = mapObjRef.current;
      const view = map.getView();
      if (!view) return;

      const { fromLonLat, toLonLat } = await import('ol/proj');
      if (cancelled) return;

      const currentCenter = view.getCenter();
      const currentZoom = view.getZoom() ?? 0;
      if (!currentCenter) return;

      const [currLon, currLat] = toLonLat(currentCenter);
      const [targetLon, targetLat] = viewCenter;
      const distance = Math.hypot(currLon - targetLon, currLat - targetLat);
      const zoomDiff = Math.abs(currentZoom - viewZoom);

      // Guard tiny updates from moveend feedback to avoid jitter.
      if (distance < 0.0005 && zoomDiff < 0.05) return;

      view.animate({
        center: fromLonLat([targetLon, targetLat]),
        zoom: viewZoom,
        duration: 850,
      });
    })();

    return () => { cancelled = true; };
  }, [ready, viewCenter, viewZoom]);

  // ── Render projects ───────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Skip entity rendering in satellite workspace (uses AOI-only mode)
      if (workspace === 'satellite') return;
      
      const src = layersRef.current['projects']?.getSource();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      const GeoJSONAny: any = (await import('ol/format/GeoJSON')).default;
      src.clear();
      const tfStart = timeFilter.enabled && timeFilter.start ? new Date(timeFilter.start).getTime() : null;
      const tfEnd   = timeFilter.enabled && timeFilter.end   ? new Date(timeFilter.end).getTime()   : null;
      const fmt = new GeoJSONAny();
      // Filter: if a specific project is selected, show only that project
      const visibleProjects = (selectedEntityType === 'project' && selectedEntityId != null)
        ? projects.filter(p => String(p.id) === String(selectedEntityId))
        : projects;
      for (const p of visibleProjects) {
        if (tfStart || tfEnd) {
          const pd = p.start_date ? new Date(p.start_date).getTime() : null;
          if (pd && tfStart && pd < tfStart) continue;
          if (pd && tfEnd   && pd > tfEnd)   continue;
        }
        const geom = parseGeometry(p.geometry);
        if (geom && (geom.type === 'Polygon' || geom.type === 'MultiPolygon')) {
          if (!featureInsideAoi(geom, aoiGeomWithBbox)) continue;
          const feats = fmt.readFeatures({ type: 'Feature', geometry: geom, properties: {} }, { featureProjection: 'EPSG:3857' });
          feats.forEach((f: any) => { f.set('entity_type', 'project'); f.set('entity_id', p.id); f.set('name', p.name); });
          src.addFeatures(feats);
        } else if (p.latitude != null && p.longitude != null) {
          if (!pointInAoiGeometry([p.longitude, p.latitude], aoiGeomWithBbox)) continue;
          const f = new FeatureAny({ geometry: new PointAny(fromLonLat([p.longitude, p.latitude])) });
          f.set('entity_type', 'project'); f.set('entity_id', p.id); f.set('name', p.name);
          src.addFeature(f);
        }
      }
    })();
  }, [workspace, projects, selectedEntityType, selectedEntityId, timeFilter, aoiGeomWithBbox]);

  // ── Render assets ─────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Skip entity rendering in satellite workspace (uses AOI-only mode)
      if (workspace === 'satellite') return;
      
      const inner = layersRef.current['assets']?.getSource()?.getSource?.();
      if (!inner) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      inner.clear();
      for (const a of assets) {
        if (a.latitude == null || a.longitude == null) continue;
        if (!pointInAoiGeometry([a.longitude, a.latitude], aoiGeomWithBbox)) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([a.longitude, a.latitude])) });
        f.set('entity_type', 'asset'); f.set('entity_id', a.id); f.set('health_score', a.health_score ?? 100);
        inner.addFeature(f);
      }
    })();
  }, [workspace, assets, aoiGeomWithBbox]);

  // ── Render work orders ────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Skip entity rendering in satellite workspace (uses AOI-only mode)
      if (workspace === 'satellite') return;
      
      const src = layersRef.current['work_orders']?.getSource();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      src.clear();
      const tfStart = timeFilter.enabled && timeFilter.start ? new Date(timeFilter.start).getTime() : null;
      const tfEnd   = timeFilter.enabled && timeFilter.end   ? new Date(timeFilter.end).getTime()   : null;
      for (const wo of workOrders) {
        if (wo.latitude == null || wo.longitude == null) continue;
        if (!pointInAoiGeometry([wo.longitude, wo.latitude], aoiGeomWithBbox)) continue;
        if (tfStart || tfEnd) {
          const sd = wo.scheduled_date ? new Date(wo.scheduled_date).getTime() : null;
          if (sd && tfStart && sd < tfStart) continue;
          if (sd && tfEnd   && sd > tfEnd)   continue;
        }
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([wo.longitude, wo.latitude])) });
        f.set('entity_type', 'work_order'); f.set('entity_id', wo.id); f.set('priority', wo.priority);
        src.addFeature(f);
      }
    })();
  }, [workspace, workOrders, timeFilter, aoiGeomWithBbox]);

  // ── Render employees ──────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Skip entity rendering in satellite workspace (uses AOI-only mode)
      if (workspace === 'satellite') return;
      
      const src = layersRef.current['employees']?.getSource()?.getSource?.();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      src.clear();
      for (const emp of employees) {
        if (emp.latitude == null || emp.longitude == null) continue;
        if (!pointInAoiGeometry([emp.longitude, emp.latitude], aoiGeomWithBbox)) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([emp.longitude, emp.latitude])) });
        f.set('entity_type', 'employee');
        f.set('entity_id', emp.id);
        f.set('name', emp.name);
        f.set('department', emp.department);
        f.set('latitude', emp.latitude);
        f.set('longitude', emp.longitude);
        src.addFeature(f);
      }
    })();
  }, [workspace, employees, aoiGeomWithBbox]);

  // ── Render warehouses (clustered) ─────────────────────────────────────────
  useEffect(() => {
    (async () => {
      // Skip entity rendering in satellite workspace (uses AOI-only mode)
      if (workspace === 'satellite') return;
      
      const src = layersRef.current['warehouses']?.getSource()?.getSource?.();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      src.clear();
      for (const wh of warehouses) {
        if (wh.latitude == null || wh.longitude == null) continue;
        if (!pointInAoiGeometry([wh.longitude, wh.latitude], aoiGeomWithBbox)) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([wh.longitude, wh.latitude])) });
        f.set('entity_type', 'warehouse');
        f.set('entity_id', wh.id);
        f.set('name', wh.name);
        f.set('city', wh.city);
        f.set('capacity', wh.capacity);
        f.set('status', wh.status);
        f.set('latitude', wh.latitude);
        f.set('longitude', wh.longitude);
        src.addFeature(f);
      }
    })();
  }, [workspace, warehouses, aoiGeomWithBbox]);

  // ── Render density source (employees + warehouses) ───────────────────────
  // ── Load corridors on first render ───────────────────────────────────────
  useEffect(() => {
    if (ready) { loadCorridors(); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  useEffect(() => {
    const onCorridorsChanged = () => {
      loadCorridors();
    };
    window.addEventListener('gis:corridors-changed', onCorridorsChanged as EventListener);
    return () => {
      window.removeEventListener('gis:corridors-changed', onCorridorsChanged as EventListener);
    };
  }, [loadCorridors]);

  // ── Focus + pulse for corrosion prediction point (3s) ───────────────────
  useEffect(() => {
    const onPredictionFocus = (ev: Event) => {
      const detail = (ev as CustomEvent<any>)?.detail ?? {};
      const lat = Number(detail.lat);
      const lon = Number(detail.lon);
      const chainageRaw = Number(detail.chainage_m);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const expiresAt = Date.now() + 3000;
      svyFocusRef.current = {
        lat,
        lon,
        chainage: Number.isFinite(chainageRaw) ? chainageRaw : null,
        expiresAt,
      };

      if (svyPulseTimerRef.current) {
        clearInterval(svyPulseTimerRef.current);
        svyPulseTimerRef.current = null;
      }

      svyPulseTickRef.current = 0;
      layersRef.current['svy_cp_overlay']?.changed?.();

      svyPulseTimerRef.current = setInterval(() => {
        if (!svyFocusRef.current || Date.now() > svyFocusRef.current.expiresAt) {
          if (svyPulseTimerRef.current) {
            clearInterval(svyPulseTimerRef.current);
            svyPulseTimerRef.current = null;
          }
          svyFocusRef.current = null;
          layersRef.current['svy_cp_overlay']?.changed?.();
          return;
        }
        svyPulseTickRef.current += 1;
        layersRef.current['svy_cp_overlay']?.changed?.();
      }, 240);
    };

    window.addEventListener('corrosion:prediction-focus', onPredictionFocus as EventListener);
    return () => {
      window.removeEventListener('corrosion:prediction-focus', onPredictionFocus as EventListener);
      if (svyPulseTimerRef.current) {
        clearInterval(svyPulseTimerRef.current);
        svyPulseTimerRef.current = null;
      }
    };
  }, []);

  // ── Render corridors ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const src = layersRef.current['corridors']?.getSource?.();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const LineStringAny: any = (await import('ol/geom/LineString')).default;
      src.clear();
      for (const corridor of corridors) {
        if (!Array.isArray(corridor.geometry) || corridor.geometry.length < 2) continue;
        const coords = corridor.geometry.map(([lon, lat]: [number, number]) => fromLonLat([lon, lat]));
        const f = new FeatureAny({ geometry: new LineStringAny(coords) });
        f.set('entity_type', 'corridor');
        f.set('entity_id', corridor.id);
        f.set('name', corridor.name);
        f.set('status', corridor.status ?? 'active');
        src.addFeature(f);
      }
      // Visibility follows layerVis.corridors
      const corridorLayer = layersRef.current['corridors'];
      if (corridorLayer) {
        corridorLayer.setVisible(layerVis.corridors !== false);
      }
    })();
  }, [corridors, ready, layerVis]);

  // ── Render SVY CP Survey Overlay ─────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    (async () => {
      const src = layersRef.current['svy_cp_overlay']?.getSource?.();
      if (!src) return;
      src.clear();
      if (!canViewCorrosionOverlay) {
        layersRef.current['svy_cp_overlay']?.setVisible(false);
        return;
      }
      if (!svyCpOverlay?.features?.length) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      for (const pt of svyCpOverlay.features) {
        if (pt.gps_lat == null || pt.gps_lon == null) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([pt.gps_lon, pt.gps_lat])) });
        f.set('entity_type', 'svy_cp_point');
        f.set('chainage_m', pt.chainage_m);
        f.set('on_mv', pt.on_mv);
        f.set('off_mv', pt.off_mv);
        f.set('protection_status', pt.protection_status);
        f.set('gps_lat', pt.gps_lat);
        f.set('gps_lon', pt.gps_lon);
        src.addFeature(f);
      }
      layersRef.current['svy_cp_overlay']?.setVisible(true);
      // Auto-fit view to SVY extent
      const extent = src.getExtent();
      if (extent && extent[0] !== Infinity) {
        mapObjRef.current?.getView().fit(extent, { padding: [60, 60, 60, 60], maxZoom: 16, duration: 800 });
      }
    })();
  }, [svyCpOverlay, ready, canViewCorrosionOverlay]);

  useEffect(() => {
    (async () => {
      const src = layersRef.current['density_heatmap']?.getSource?.();
      if (!src) return;
      const { fromLonLat } = await import('ol/proj');
      const FeatureAny: any = (await import('ol/Feature')).default;
      const PointAny: any = (await import('ol/geom/Point')).default;
      src.clear();

      for (const emp of employees) {
        if (emp.latitude == null || emp.longitude == null) continue;
        if (!pointInAoiGeometry([emp.longitude, emp.latitude], aoiGeomWithBbox)) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([emp.longitude, emp.latitude])) });
        f.set('entity_type', 'employee');
        f.set('entity_id', emp.id);
        f.set('name', emp.name);
        f.set('department', emp.department);
        f.set('latitude', emp.latitude);
        f.set('longitude', emp.longitude);
        f.set('weight', 1.0);
        src.addFeature(f);
      }

      for (const wh of warehouses) {
        if (wh.latitude == null || wh.longitude == null) continue;
        if (!pointInAoiGeometry([wh.longitude, wh.latitude], aoiGeomWithBbox)) continue;
        const f = new FeatureAny({ geometry: new PointAny(fromLonLat([wh.longitude, wh.latitude])) });
        f.set('entity_type', 'warehouse');
        f.set('entity_id', wh.id);
        f.set('name', wh.name);
        f.set('city', wh.city);
        f.set('status', wh.status);
        f.set('capacity', wh.capacity);
        f.set('latitude', wh.latitude);
        f.set('longitude', wh.longitude);
        f.set('weight', 1.4);
        src.addFeature(f);
      }
    })();
  }, [employees, warehouses, aoiGeomWithBbox]);

  // ── UI ────────────────────────────────────────────────────────────────────
  if (initErr) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 text-red-400 gap-3">
        <AlertTriangle className="w-8 h-8" />
        <p className="text-sm">{initErr}</p>
        <button onClick={() => window.location.reload()} className="text-xs text-slate-400 underline">إعادة المحاولة</button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-hidden" dir="ltr">
      <div ref={mapRef} className="absolute inset-0 w-full h-full" />

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-950 z-50">
          <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
        </div>
      )}

      {/* Pick-location mode overlay — crosshair cursor + banner */}
      {drawingMode === 'pick-location' && (
        <>
          <div className="absolute inset-0 z-30 pointer-events-none cursor-crosshair" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none">
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/20 border border-emerald-400/60 text-emerald-300 text-sm backdrop-blur-md animate-pulse" dir="rtl">
              <span className="text-base">📍</span>
              <span>انقر على الخريطة لاختيار الموقع</span>
            </div>
          </div>
        </>
      )}

      <div className="absolute top-24 left-3 z-30 flex flex-col gap-2" dir="rtl">
        {!hideControls && <button
          type="button"
          onClick={() => {
            if (drawingMode === 'pick-location') {
              cancelLocationPick();
            } else {
              setDrawingMode('pick-location');
            }
          }}
          className={`px-3 py-2 rounded-xl border text-xs backdrop-blur-md transition-colors flex items-center gap-1.5 ${
            drawingMode === 'pick-location'
              ? 'border-emerald-400/70 bg-emerald-500/25 text-emerald-200'
              : 'border-white/20 bg-slate-900/70 text-white hover:bg-slate-800/80'
          }`}
          title="تحديد موقع"
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>تحديد موقع</span>
        </button>}
      </div>

      {/* Drawing mode badge */}
      {drawingMode !== 'idle' && drawingMode !== 'pick-location' && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 text-xs backdrop-blur-sm" dir="rtl">
          <Edit2 className="w-3 h-3" />
          <span>{{
            polygon:              'رسم مضلع',
            line:                 'رسم خط',
            point:                'إضافة نقطة',
            'aoi-rectangle':      'تحديد نطاق (مربع)',
            trace:                'تتبع تلقائي للمعالم',
            'orthogonal-polygon': 'رسم مبنى متعامد',
            modify:               'تعديل',
            delete:               'حذف',
            'measure-distance':   'قياس مسافة',
            'measure-area':       'قياس مساحة',
            'inspect-coordinate': 'فحص إحداثيات',
          }[drawingMode as string]}
          </span>
        </div>
      )}

      {/* Debug badge — basemap key + tile load status */}
      {ready && (
        <div
          className="absolute top-3 left-3 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900/80 border border-slate-700/60 backdrop-blur-sm text-xs font-mono select-none"
          dir="ltr"
          title="Basemap debug info"
        >
          <span className={[
            'w-2 h-2 rounded-full flex-shrink-0',
            tileStatus === 'ok'       ? 'bg-emerald-400'              :
            tileStatus === 'fallback' ? 'bg-amber-400'                :
            tileStatus === 'error'    ? 'bg-red-400'                  :
                                        'bg-blue-400 animate-pulse',
          ].join(' ')} />
          <span className="text-slate-300">{activeBm}</span>
          <span className="text-slate-600">|</span>
          <span className={
            tileStatus === 'ok'       ? 'text-emerald-400' :
            tileStatus === 'fallback' ? 'text-amber-400'   :
            tileStatus === 'error'    ? 'text-red-400'     :
                                        'text-blue-400'
          }>{tileStatus}</span>
        </div>
      )}

      {timeFilter.enabled && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/20 border border-amber-500/40 backdrop-blur-sm text-xs text-amber-300">
            <span>⏱</span>
            <span>
              {timeFilter.start && new Date(timeFilter.start).toLocaleDateString('ar-SA')}
              {timeFilter.start && timeFilter.end && ' — '}
              {timeFilter.end && new Date(timeFilter.end).toLocaleDateString('ar-SA')}
            </span>
          </div>
        </div>
      )}

      <div className="absolute top-14 left-3 z-30" dir="rtl">
        {!hideControls && <button
          type="button"
          onClick={toggleEntityRenderMode}
          className="px-3 py-1.5 rounded-xl border border-white/20 bg-slate-900/70 text-xs text-white backdrop-blur-md hover:bg-slate-800/80 transition-colors"
          title="تبديل فوري بين الأيقونات والكثافة"
        >
          {entityRenderMode === 'density' ? 'نمط الكثافة (Heatmap/Chart)' : 'نمط الأيقونات (Clusters)'}
        </button>}
      </div>

      {siteList && (
        <aside className="absolute top-24 right-3 z-40 w-[340px] max-h-[70vh] overflow-hidden rounded-2xl border border-white/15 bg-slate-900/60 backdrop-blur-xl shadow-2xl" dir="rtl">
          <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white">بيانات الموقع</h3>
              <p className="text-[11px] text-white/70">
                {siteList.employees.length} موظف • {siteList.warehouses.length} مخزن
              </p>
            </div>
            <button type="button" onClick={() => setSiteList(null)} className="text-xs text-white/70 hover:text-white">إغلاق</button>
          </div>
          <div className="max-h-[58vh] overflow-auto px-3 py-3 space-y-3">
            {siteList.employees.length > 0 && (
              <section>
                <p className="text-[11px] text-violet-300 mb-2">الموظفون</p>
                <div className="space-y-1.5">
                  {siteList.employees.map((emp) => (
                    <div key={`emp-${emp.id}`} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                      <p className="text-xs text-white font-medium">{emp.name}</p>
                      <p className="text-[11px] text-white/70">{emp.department}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {siteList.warehouses.length > 0 && (
              <section>
                <p className="text-[11px] text-cyan-300 mb-2">المخازن</p>
                <div className="space-y-1.5">
                  {siteList.warehouses.map((wh) => (
                    <div key={`wh-${wh.id}`} className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-2">
                      <p className="text-xs text-white font-medium">{wh.name}</p>
                      <p className="text-[11px] text-white/70">{wh.city ?? 'غير محدد'} • {wh.status}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>
      )}

      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-4 px-3 py-1 bg-slate-950/80 backdrop-blur-sm border-t border-slate-800 text-xs text-slate-400" dir="rtl">
        <span>تكبير: {zoom}</span>
        {coords && <span>{coords.lat.toFixed(4)}° ش | {coords.lon.toFixed(4)}° ط</span>}
        <span className="mr-auto flex items-center gap-3">
          {layerVis.projects    && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />{projects.length} مشروع</span>}
          {layerVis.assets      && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />{assets.length} أصل</span>}
          {layerVis.work_orders && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" />{workOrders.length} أمر</span>}
          {layerVis.employees   && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-violet-500 inline-block" />{employees.length} موظف</span>}
          {layerVis.warehouses  && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />{warehouses.length} مخزن</span>}
          <span className="text-white/70">العرض: {entityRenderMode === 'density' ? 'كثافة' : 'أيقونات'}</span>
        </span>
        <button onClick={refreshAll} className="flex items-center gap-1 hover:text-slate-200 transition-colors" title="تحديث"><RefreshCw className="w-3 h-3" /></button>
      </div>

    </div>
  );
}
// Legacy named export for backward compatibility with GisMapShell
export { MapCenterCanvas as MapCenterCanvasLegacy };
