/**
 * contextBrokerClient.ts
 * ======================
 * API client for Spatiotemporal Context Broker — Phase S9
 *
 * All calls go to /api/v1/context-broker/* (proxied by Next.js to port 7860).
 *
 * Error handling: throws ContextBrokerError with message and status,
 * never silently swallows errors.
 */

import type {
  ContextRequest,
  ContextResponse,
  ContextGroupId,
  GeoJSONPolygon,
  AvailableGroupsResponse,
  BrokerContractSchema,
  DetailLevel,
} from "./contextBrokerTypes";

// ─── Base URL ──────────────────────────────────────────────────────────────────

const BASE = "/api/v1/context-broker";

// ─── Error class ──────────────────────────────────────────────────────────────

export class ContextBrokerError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "ContextBrokerError";
    this.status = status;
  }
}

// ─── Internal fetch helper ─────────────────────────────────────────────────────

async function _post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `Context Broker error ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail ?? err.message ?? msg;
    } catch (_) { /* ignore json parse failure */ }
    throw new ContextBrokerError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

async function _get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) {
    let msg = `Context Broker error ${res.status}`;
    try {
      const err = await res.json();
      msg = err.detail ?? err.message ?? msg;
    } catch (_) { /* ignore */ }
    throw new ContextBrokerError(msg, res.status);
  }
  return res.json() as Promise<T>;
}

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Request context for a polygon area + date range.
 *
 * @param geometry    GeoJSON Polygon or raw ring [[lon,lat],...]
 * @param dateFrom    YYYY-MM-DD (optional)
 * @param dateTo      YYYY-MM-DD (optional)
 * @param groups      specific groups to request, null = all
 * @param detailLevel "executive" | "technical" | "human"
 */
export async function requestAreaContext(
  geometry:    GeoJSONPolygon | number[][] | null,
  dateFrom?:   string | null,
  dateTo?:     string | null,
  groups?:     ContextGroupId[] | null,
  detailLevel: DetailLevel = "technical",
): Promise<ContextResponse> {
  const body: ContextRequest = {
    request_type:    "get_area_context",
    geometry:        geometry ?? null,
    date_from:       dateFrom ?? null,
    date_to:         dateTo   ?? null,
    context_groups:  groups   ?? null,
    detail_level:    detailLevel,
  };
  return _post<ContextResponse>("/request", body);
}

/**
 * Request context for a specific scene UID.
 * Bypasses temporal search — uses the named scene directly.
 */
export async function requestSceneContext(
  sceneUid: string,
  geometry?: GeoJSONPolygon | number[][] | null,
  groups?:   ContextGroupId[] | null,
): Promise<ContextResponse> {
  const body: ContextRequest = {
    request_type:   "get_scene_context",
    scene_uid:      sceneUid,
    geometry:       geometry ?? null,
    context_groups: groups   ?? null,
    detail_level:   "technical",
  };
  return _post<ContextResponse>("/request", body);
}

/**
 * Request context using a project_id geometry from the GIS layer.
 * The backend will resolve the project geometry.
 */
export async function requestProjectContext(
  projectId:   number,
  groups?:     ContextGroupId[] | null,
  dateFrom?:   string | null,
  dateTo?:     string | null,
): Promise<ContextResponse> {
  const body: ContextRequest = {
    request_type:   "get_project_context",
    project_id:     projectId,
    date_from:      dateFrom ?? null,
    date_to:        dateTo   ?? null,
    context_groups: groups   ?? null,
    detail_level:   "technical",
  };
  return _post<ContextResponse>("/request", body);
}

/**
 * Request context for a corridor (project_id).
 * Same as project context but semantically labeled for linear projects.
 */
export async function requestCorridorContext(
  projectId:   number,
  groups?:     ContextGroupId[] | null,
  dateFrom?:   string | null,
  dateTo?:     string | null,
): Promise<ContextResponse> {
  const body: ContextRequest = {
    request_type:   "get_corridor_context",
    project_id:     projectId,
    date_from:      dateFrom ?? null,
    date_to:        dateTo   ?? null,
    context_groups: groups   ?? null,
    detail_level:   "technical",
  };
  return _post<ContextResponse>("/request", body);
}

/**
 * Get scene-anchored context via GET endpoint.
 * Lightweight alternative to POST /request for scene-scoped queries.
 */
export async function getSceneContext(
  sceneUid: string,
  groups?:  ContextGroupId[] | null,
): Promise<ContextResponse> {
  const groupsParam = groups ? `?groups=${groups.join(",")}` : "";
  return _get<ContextResponse>(`/scene/${encodeURIComponent(sceneUid)}${groupsParam}`);
}

/** List all available context group definitions. */
export async function getAvailableGroups(): Promise<AvailableGroupsResponse> {
  return _get<AvailableGroupsResponse>("/available-groups");
}

/** Fetch the machine-readable brain integration contract schema. */
export async function getBrokerContract(): Promise<BrokerContractSchema> {
  return _get<BrokerContractSchema>("/contract");
}

// ─── Export download helpers ───────────────────────────────────────────────────

/** Download the brain_ready contract as JSON file. */
export function downloadBrainReadyJSON(response: ContextResponse, filename?: string): void {
  const blob = new Blob(
    [JSON.stringify(response.brain_ready, null, 2)],
    { type: "application/json" },
  );
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename ?? `context-broker-${response.request_id}-brain-ready.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Download the full context response as JSON file. */
export function downloadFullResponseJSON(response: ContextResponse, filename?: string): void {
  const blob = new Blob(
    [JSON.stringify(response, null, 2)],
    { type: "application/json" },
  );
  const url  = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href     = url;
  link.download = filename ?? `context-broker-${response.request_id}-full.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
