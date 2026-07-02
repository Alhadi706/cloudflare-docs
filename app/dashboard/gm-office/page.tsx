'use client';
/**
 * GM Office — Top-level canonical page (Phase 7)
 * ════════════════════════════════════════════════════════════════
 * Route: /dashboard/gm-office
 *
 * Renders the full GM Strategic Command Center with a persistent
 * GmOfficeTabBar at the top linking to all intelligence sub-pages.
 *
 * The old /dashboard/admin-gateway/gm-office now redirects here.
 * The intelligence sub-pages (briefing, risk, forecast, performance)
 * also show the same tab bar for seamless navigation.
 */

import GmOfficeTabBar from '@/components/GmOfficeTabBar';
import GmOfficeDashboard from '@/app/dashboard/admin-gateway/gm-office/page';

export default function GmOfficePage() {
  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col" dir="rtl">
      <GmOfficeTabBar />
      <div className="flex-1">
        <GmOfficeDashboard />
      </div>
    </div>
  );
}
