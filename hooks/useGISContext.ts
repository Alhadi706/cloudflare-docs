/**
 * useGISContext
 * ─────────────────────────────────────────────────────────────────────────────
 * Turns GIS map interactions into shared operational context.
 *
 * Provides:
 *   onLocationSelected(lat, lon, name?)
 *     → Call this from any map click/select handler.
 *       Sets selected_location in operationalContext and syncs mapStore center.
 *
 *   syncMapToContext()
 *     → Reads current mapStore bounds/center and writes to operationalContext.
 *       Use in a useEffect inside map components.
 *
 *   contextFromGIS
 *     → The current operationalContext values relevant to GIS (read-only).
 *
 * Usage in a map component:
 *   const { onLocationSelected } = useGISContext();
 *   map.on('click', (e) => onLocationSelected(e.coordinate[1], e.coordinate[0]));
 *
 * Usage in project list:
 *   const { onProjectSiteSelected } = useGISContext();
 *   onProjectSiteSelected(projectId, projectName, lat, lon);
 */
'use client';

import { useCallback } from 'react';
import { useMapStore } from '@/store/mapStore';
import { useErpContextStore } from '@/store/erpContextStore';
import { useOperationalContext, SelectedLocation } from '@/store/operationalContext';

// ── Reverse-geocode stub ──────────────────────────────────────────────────────
// Future: replace with actual API call to backend /api/v1/gis/reverse-geocode
async function reverseGeocode(_lat: number, _lon: number): Promise<string | null> {
  // Placeholder — return null to use coordinate label instead
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGISContext() {
  const { setCenter, setPendingFitExtent, center, zoom } = useMapStore();
  const { setActiveProject: setErpProject } = useErpContextStore();
  const {
    setSelectedLocation,
    setSelectedProject,
    selected_location,
    selected_project_id,
    selected_project_name,
    last_ai_intent,
  } = useOperationalContext();

  /**
   * Primary entrypoint: user clicked a point on the map.
   * Propagates to:
   *   - operationalContext.selected_location
   *   - mapStore.center / pendingFitExtent (so other map components zoom in)
   */
  const onLocationSelected = useCallback(
    async (lat: number, lon: number, name?: string) => {
      // Attempt reverse-geocode (non-blocking — fails silently)
      const geocodedName = name ?? (await reverseGeocode(lat, lon).catch(() => null)) ?? undefined;

      const loc: SelectedLocation = {
        lat,
        lon,
        name: geocodedName ?? `${lat.toFixed(5)}, ${lon.toFixed(5)}`,
        source: 'gis_click',
      };
      setSelectedLocation(loc);
      setCenter([lon, lat]);
    },
    [setSelectedLocation, setCenter]
  );

  /**
   * Call when user selects a project + its site coordinates in GIS or the project list.
   * Syncs across: erpContextStore, operationalContext, mapStore.
   */
  const onProjectSiteSelected = useCallback(
    (
      projectId: string | number,
      projectName: string,
      lat?: number | null,
      lon?: number | null
    ) => {
      // Activate in ERP context store (existing integration)
      setErpProject(String(projectId));
      // Activate in operational context (new bridge)
      setSelectedProject(projectId, projectName);

      // If project has coordinates, pan the map there
      if (lat != null && lon != null) {
        const loc: SelectedLocation = {
          lat,
          lon,
          name: projectName,
          source: 'project_site',
        };
        setSelectedLocation(loc);
        setCenter([lon, lat]);
        setPendingFitExtent([lon - 0.1, lat - 0.1, lon + 0.1, lat + 0.1]);
      }
    },
    [setErpProject, setSelectedProject, setSelectedLocation, setCenter, setPendingFitExtent]
  );

  /**
   * Read-only summary of what the GIS modules need from shared context.
   * Use in map components to show context overlays:
   *   - active project boundary highlight
   *   - selected location pin
   *   - AI-mentioned location marker
   */
  const contextFromGIS = {
    selectedLocation: selected_location,
    activeProjectId: selected_project_id,
    activeProjectName: selected_project_name,
    lastAIIntent: last_ai_intent,
    mapCenter: center,
    mapZoom: zoom,
  };

  return {
    onLocationSelected,
    onProjectSiteSelected,
    contextFromGIS,
  };
}
