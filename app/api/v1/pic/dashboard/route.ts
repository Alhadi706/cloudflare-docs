/**
 * GET /api/v1/pic/dashboard — KPIs ولوحة الاستخبارات التنفيذية
 */
import { NextRequest, NextResponse } from 'next/server';
import { extractTenantId } from '@/lib/backendProxy';
import { getDashboardStats, listAlerts, listProjects } from '@/lib/picDB';

export async function GET(req: NextRequest) {
  const tenantId = extractTenantId(req);
  if (!tenantId) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });

  try {
    const [stats, alerts, projects] = await Promise.all([
      getDashboardStats(tenantId),
      listAlerts(tenantId, true),
      listProjects(tenantId, { limit: 200 }),
    ]);

    // Top at-risk projects
    const atRisk = projects
      .filter(p => p.health_score < 50 && p.status !== 'completed')
      .sort((a, b) => a.health_score - b.health_score)
      .slice(0, 5);

    // Most stopped
    const longestStopped = projects
      .filter(p => p.status === 'stopped')
      .sort((a, b) => b.longest_interruption_days - a.longest_interruption_days)
      .slice(0, 5);

    // Activity breakdown
    const byType: Record<string, number> = {};
    projects.forEach(p => {
      byType[p.type] = (byType[p.type] ?? 0) + 1;
    });

    return NextResponse.json({
      ok: true,
      stats,
      recent_alerts:   alerts.slice(0, 10),
      at_risk:         atRisk,
      longest_stopped: longestStopped,
      by_type:         byType,
      generated_at:    new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}
