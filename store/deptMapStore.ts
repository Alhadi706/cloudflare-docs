/**
 * deptMapStore — Phase 3: per-department map visibility preference
 * ════════════════════════════════════════════════════════════════
 * Each department can independently show or hide the map.
 * The last choice is persisted in localStorage: `map_pref_[deptCode]`
 *
 * Usage:
 *   const { mapHidden, toggleMap, initDept } = useDeptMapStore();
 *
 * Defaults:
 *   - Departments that benefit from a map → mapHidden = false (map visible by default)
 *   - Departments with no spatial work   → mapHidden = true  (map hidden by default)
 */
import { create } from 'zustand';

// Departments where map is visible by default (spatial-first depts)
const MAP_VISIBLE_BY_DEFAULT = new Set([
  'corrosion',
  'maintenance',
  'projects',
  'assets',
  'gis',
  'engineering',
  'operations',
]);

function getStorageKey(deptCode: string): string {
  return `map_pref_${deptCode}`;
}

function loadPref(deptCode: string): boolean | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(getStorageKey(deptCode));
  if (raw === null) return null;
  return raw === 'hidden';
}

function savePref(deptCode: string, hidden: boolean): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(deptCode), hidden ? 'hidden' : 'visible');
}

interface DeptMapState {
  /** Current active dept code (derived from route) */
  activeDeptCode: string;
  /** Whether the map is hidden for the current dept */
  mapHidden: boolean;
  /**
   * Call this when the route changes to a new department.
   * Reads localStorage preference or falls back to per-dept default.
   */
  initDept: (deptCode: string) => void;
  /**
   * Toggle map visibility for the current dept.
   * Persists the new preference to localStorage.
   */
  toggleMap: () => void;
  /**
   * Explicitly set map visibility.
   */
  setMapHidden: (hidden: boolean) => void;
}

export const useDeptMapStore = create<DeptMapState>((set, get) => ({
  activeDeptCode: '',
  mapHidden: true, // safe SSR default

  initDept: (deptCode: string) => {
    const storedPref = loadPref(deptCode);
    const hidden =
      storedPref !== null
        ? storedPref                              // user has an explicit preference
        : !MAP_VISIBLE_BY_DEFAULT.has(deptCode);  // fall back to dept default
    set({ activeDeptCode: deptCode, mapHidden: hidden });
  },

  toggleMap: () => {
    const { activeDeptCode, mapHidden } = get();
    const newHidden = !mapHidden;
    savePref(activeDeptCode, newHidden);
    set({ mapHidden: newHidden });
  },

  setMapHidden: (hidden: boolean) => {
    const { activeDeptCode } = get();
    savePref(activeDeptCode, hidden);
    set({ mapHidden: hidden });
  },
}));
