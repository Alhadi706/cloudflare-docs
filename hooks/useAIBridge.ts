/**
 * useAIBridge
 * ──────────────────────────────────────────────────────────────────
 * Parses AI responses to extract cross-system intents and propagates
 * them into the OperationalContext store.
 *
 * Capabilities:
 *   - Geographic coordinate extraction → sets selected_location + mapStore
 *   - Project keyword detection → activates selected_project context
 *   - Navigation intent detection → sets pending_navigation for the UI to consume
 *   - Report / workflow reference detection → sets active IDs
 *   - Records every AI interaction for Command Center history
 *
 * Usage:
 *   const { processAIResponse } = useAIBridge();
 *   // call after every successful AI answer:
 *   processAIResponse({ question, answer, mode, intent });
 *
 * The hook does NOT navigate — it signals intent via pending_navigation.
 * The calling component reads pending_navigation from operationalContext
 * and renders a navigation chip for the user to confirm.
 */
'use client';

import { useCallback } from 'react';
import { useOperationalContext, PendingNavigation, SelectedLocation } from '@/store/operationalContext';
import { useMapStore } from '@/store/mapStore';
import { useErpContextStore } from '@/store/erpContextStore';
import { useActivatedDepartments } from '@/store/activatedDepartments';

// ── Navigation intent patterns ───────────────────────────────────────────────

const NAV_RULES: Array<{
  patterns: RegExp[];
  nav: PendingNavigation;
}> = [
  {
    patterns: [/خريطة|gis|مكاني|طبقة|رسم|layer|map\b/i],
    nav: { route: '/dashboard/gis-sovereignty', label: 'GIS Sovereignty', labelAr: 'السيادة الجغرافية' },
  },
  {
    patterns: [/مشاريع|المشاريع|projects?\b|project list/i],
    nav: { route: '/dashboard/admin-gateway/projects', label: 'Projects', labelAr: 'المشاريع' },
  },
  {
    patterns: [/مهمة|workflow|task|خطوة|pending step|steps/i],
    nav: { route: '/dashboard/admin-gateway/maintenance', label: 'Workflows', labelAr: 'المهام والسير' },
  },
  {
    patterns: [/بلاغ|تقرير\sمواطن|citizen report|complaint|شكوى/i],
    nav: { route: '/dashboard/command-center', label: 'Command Center', labelAr: 'مركز القيادة' },
  },
  {
    patterns: [/موظف|hr|human resource|رواتب|إجازة|leave/i],
    nav: { route: '/dashboard/admin-gateway/hr', label: 'HR', labelAr: 'الموارد البشرية' },
  },
  {
    patterns: [/asset|أصل|أصول|صيانة|maintenance|corrosion/i],
    nav: { route: '/dashboard/admin-gateway/assets', label: 'Assets', labelAr: 'الأصول' },
  },
  {
    patterns: [/ذكاء|AI assistant|مساعد|ai\b/i],
    nav: { route: '/dashboard/ai-assistant', label: 'AI Assistant', labelAr: 'المساعد الذكي' },
  },
];

// ── Coordinate extraction ─────────────────────────────────────────────────────

/** Try to extract a lat/lon pair from Arabic/English AI answer text. */
function extractCoordinates(text: string): { lat: number; lon: number } | null {
  // Pattern: "24.7136, 46.6753" or "lat: 24.7 lon: 46.6" or Arabic "خط العرض 24.7 خط الطول 46.6"
  const patterns = [
    /(?:lat(?:itude)?[:\s]*)([+-]?\d{1,3}\.\d+)[,\s]+(?:lon(?:gitude)?[:\s]*)([+-]?\d{1,3}\.\d+)/i,
    /([+-]?\d{1,3}\.\d{4,})[,\s]+([+-]?\d{1,3}\.\d{4,})/,
    /خط العرض[:\s]*([+-]?\d{1,3}\.\d+)[,\s]*خط الطول[:\s]*([+-]?\d{1,3}\.\d+)/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (m) {
      const a = parseFloat(m[1]);
      const b = parseFloat(m[2]);
      // Validate plausible WGS84 values for the Arabian Peninsula / Libya region
      if (a >= 10 && a <= 40 && b >= 10 && b <= 60) return { lat: a, lon: b };
      if (b >= 10 && b <= 40 && a >= 10 && a <= 60) return { lat: b, lon: a };
    }
  }
  return null;
}

// ── Project mention extraction ─────────────────────────────────────────────────

/** Very lightweight: if answer contains a project name from the store, activate it. */
function findMentionedProject(
  text: string,
  projects: Array<{ id: string | number; name?: string; project_name?: string }>
): { id: string | number; name: string } | null {
  for (const p of projects) {
    const name = p.name || p.project_name || '';
    if (name.length > 3 && text.includes(name)) {
      return { id: p.id, name };
    }
  }
  return null;
}

// ── Report/workflow ID extraction ─────────────────────────────────────────────

function extractReportId(text: string): string | null {
  const m = text.match(/(?:report[_-]?id|بلاغ\s*رقم|report)[:\s#]*([A-Za-z0-9_-]{6,})/i);
  return m ? m[1] : null;
}

function extractWorkflowId(text: string): number | null {
  const m = text.match(/(?:workflow[_-]?id|instance[_-]?id|مسار\s*رقم)[:\s#]*(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// ── Determine navigation intent from question + answer ──────────────────────

function detectNavIntent(question: string, answer: string): PendingNavigation | null {
  const combined = `${question} ${answer}`;
  for (const rule of NAV_RULES) {
    if (rule.patterns.some((re) => re.test(combined))) {
      return rule.nav;
    }
  }
  return null;
}

// ── Department mention detection ───────────────────────────────────────────────
// Returns the best-match activated department if any dept name appears in the text.

import type { ActivatedDept } from '@/store/activatedDepartments';

function detectDeptMention(
  text: string,
  departments: ActivatedDept[]
): { dept: ActivatedDept; route: string } | null {
  for (const dept of departments) {
    const name = dept.custom_name_ar ?? dept.name_ar;
    if (name.length > 3 && text.includes(name)) {
      const route = dept.frontend_route
        ?? `/dashboard/departments/${dept.department_code.toLowerCase().replace('dept_', '')}`;
      return { dept, route };
    }
  }
  return null;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export interface AIBridgeInput {
  question: string;
  answer: string;
  mode?: string;
  intent?: string;
}

export function useAIBridge() {
  const {
    recordAIInteraction,
    setPendingNavigation,
    setSelectedLocation,
    setActiveReport,
    setActiveWorkflow,
    setSelectedProject,
  } = useOperationalContext();

  const { setCenter, setPendingFitExtent } = useMapStore();
  const { projects, setActiveProject: setErpProject } = useErpContextStore();
  const { departments } = useActivatedDepartments();

  const processAIResponse = useCallback(
    ({ question, answer, mode = 'auto', intent = '' }: AIBridgeInput) => {
      // 1. Record for Command Center history
      recordAIInteraction(intent || mode, question, answer);

      // 2. Extract coordinates → update map + operational context
      const coords = extractCoordinates(answer);
      if (coords) {
        const loc: SelectedLocation = { ...coords, source: 'ai_mention' };
        setSelectedLocation(loc);
        setCenter([coords.lon, coords.lat]);
        // Zoom into area (extent ±0.05 deg)
        setPendingFitExtent([
          coords.lon - 0.05,
          coords.lat - 0.05,
          coords.lon + 0.05,
          coords.lat + 0.05,
        ]);
      }

      // 3. Project mention → activate in erpContextStore + operationalContext
      const mentioned = findMentionedProject(answer, projects);
      if (mentioned) {
        setErpProject(String(mentioned.id));
        setSelectedProject(mentioned.id, mentioned.name);
      }

      // 4. Report / workflow reference
      const reportId = extractReportId(answer);
      if (reportId) setActiveReport(reportId);

      const wfId = extractWorkflowId(answer);
      if (wfId) setActiveWorkflow(wfId);

      // 5. Department mention → navigate to department route (check activated depts first)
      const deptMatch = detectDeptMention(`${question} ${answer}`, departments);
      if (deptMatch) {
        setPendingNavigation({
          route: deptMatch.route,
          label: deptMatch.dept.name_en ?? deptMatch.dept.name_ar,
          labelAr: deptMatch.dept.custom_name_ar ?? deptMatch.dept.name_ar,
        });
        return; // dept match is higher priority than generic nav
      }

      // 6. Generic navigation intent — only suggest, never force-navigate
      const nav = detectNavIntent(question, answer);
      if (nav) {
        setPendingNavigation(nav);
      }
    },
    [
      recordAIInteraction,
      setPendingNavigation,
      setSelectedLocation,
      setActiveReport,
      setActiveWorkflow,
      setSelectedProject,
      setCenter,
      setPendingFitExtent,
      projects,
      setErpProject,
      departments,
    ]
  );

  return { processAIResponse };
}
