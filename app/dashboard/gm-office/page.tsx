'use client';
/**
 * GM Office — Top-level standalone page (Phase 7)
 * ════════════════════════════════════════════════════════════════
 * Route: /dashboard/gm-office
 *
 * Full-screen strategic command center for the General Manager.
 * Runs OUTSIDE admin-gateway layout (no floating panel, no background map).
 * Has its own GmOfficeTabBar for navigation to intelligence sub-pages.
 *
 * Map toggle: hidden by default (strategic dashboard, no map needed).
 */

import GmOfficeTabBar from '@/components/GmOfficeTabBar';
import GmOfficeDashboard from '@/app/dashboard/admin-gateway/gm-office/page';

export default function GmOfficePage() {
  return (
    <div className="min-h-screen bg-[#080d1a] flex flex-col" dir="rtl">
      {/* Persistent tab navigation across all GM Office sub-pages */}
      <GmOfficeTabBar />
      {/* Main dashboard content */}
      <div className="flex-1">
        <GmOfficeDashboard />
      </div>
    </div>
  );
}
