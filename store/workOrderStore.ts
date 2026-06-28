'use client';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ─── Types ─────────────────────────────────────────────────────────────────
export type WODepartment = 'maintenance' | 'corrosion' | 'operations';

/**
 * Full lifecycle of a work order:
 *   Maintenance creates (draft) → dispatches → Corrosion acknowledges →
 *   executes (in_progress) → submits results (results_submitted) →
 *   Maintenance receives (results_received) → closes (closed)
 */
export type WOStatus =
  | 'draft'
  | 'dispatched'
  | 'acknowledged'
  | 'in_progress'
  | 'results_submitted'
  | 'results_received'
  | 'closed';

export interface WOMeasurements {
  /** UT thickness readings in mm (multiple points) */
  thickness_readings?: number[];
  /** Corrosion rate in mm/year */
  corrosion_rate?: number;
  coating_condition?: 'good' | 'fair' | 'poor' | 'failed';
  ph?: number;
  pressure_bar?: number;
}

export interface WOResult {
  submitted_at: string;
  technician_name: string;
  actual_hours: number;
  /** index matches workOrder.checklist */
  checklist_done: boolean[];
  measurements?: WOMeasurements;
  finding: 'passed' | 'needs_attention' | 'critical_finding';
  notes: string;
  recommended_next_action?: string;
  next_inspection_months?: number;
}

export interface WorkOrder {
  id: string;
  equipment_code: string;
  asset_id: string;
  task_type: string;
  priority: 'critical' | 'warning' | 'routine';
  scheduled_month: number;
  month_name: string;
  sector: string;
  checklist: string[];
  estimated_hours: number;
  materials: string[];
  status: WOStatus;
  department: WODepartment;
  created_at: string;
  dispatched_at?: string;
  result?: WOResult;
}

interface DispatchRecord {
  recipients: string[];
  reports: string[];
  at: string;
}

interface WorkOrderStore {
  workOrders: WorkOrder[];
  lastDispatch: DispatchRecord | null;

  /** Add one or more newly-created work orders (they start in 'draft') */
  addWorkOrders: (wos: WorkOrder[]) => void;

  /** Replace the entire WO list (used by MaintenanceSchedule for clear-all) */
  setWorkOrders: (wos: WorkOrder[]) => void;

  /** Dispatch: move all 'draft' WOs to 'dispatched', record dispatch metadata */
  dispatchWorkOrders: (recipients: string[], reports: string[]) => void;

  // ── Corrosion-side lifecycle ──────────────────────────────────────────────
  /** Corrosion admin acknowledges receipt */
  acknowledgeWorkOrder: (id: string) => void;
  /** Field team starts execution */
  startWorkOrder: (id: string) => void;
  /** Field team submits completed results */
  submitResults: (id: string, result: WOResult) => void;

  // ── Back to Maintenance ────────────────────────────────────────────────────
  /** Maintenance marks results as received (read) */
  receiveResults: (id: string) => void;
  /** Maintenance closes the WO after reviewing results */
  closeWorkOrder: (id: string) => void;

  clearAllWorkOrders: () => void;
}

export const useWorkOrderStore = create<WorkOrderStore>()(
  persist(
    (set) => ({
      workOrders: [],
      lastDispatch: null,

      addWorkOrders: (wos) =>
        set((s) => ({ workOrders: [...s.workOrders, ...wos] })),

      setWorkOrders: (wos) => set({ workOrders: wos }),

      dispatchWorkOrders: (recipients, reports) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.status === 'draft'
              ? { ...w, status: 'dispatched' as WOStatus, dispatched_at: new Date().toISOString() }
              : w
          ),
          lastDispatch: { recipients, reports, at: new Date().toISOString() },
        })),

      acknowledgeWorkOrder: (id) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status: 'acknowledged' as WOStatus } : w
          ),
        })),

      startWorkOrder: (id) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status: 'in_progress' as WOStatus } : w
          ),
        })),

      submitResults: (id, result) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id
              ? { ...w, status: 'results_submitted' as WOStatus, result }
              : w
          ),
        })),

      receiveResults: (id) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status: 'results_received' as WOStatus } : w
          ),
        })),

      closeWorkOrder: (id) =>
        set((s) => ({
          workOrders: s.workOrders.map((w) =>
            w.id === id ? { ...w, status: 'closed' as WOStatus } : w
          ),
        })),

      clearAllWorkOrders: () => set({ workOrders: [], lastDispatch: null }),
    }),
    { name: 'digital-dashboard-work-orders' }
  )
);
