'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { Project360Response } from '@/app/dashboard/project-360/components/types';

type Props = {
  projectId: string;
};

function toCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number.isFinite(value) ? value : 0);
}

function toDate(value: unknown): string {
  if (!value) return '-';
  const ts = Date.parse(String(value));
  if (Number.isNaN(ts)) return String(value);
  return new Date(ts).toLocaleDateString();
}

export default function Project360Client({ projectId }: Props) {
  const [data, setData] = useState<Project360Response | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/v1/workspace/projects/${encodeURIComponent(projectId)}/project-360`, {
          cache: 'no-store',
        });
        const json = await res.json().catch(() => null);
        if (!res.ok || !json?.ok) {
          throw new Error(String(json?.detail || `HTTP ${res.status}`));
        }
        if (!active) return;
        setData(json as Project360Response);
      } catch (e: any) {
        if (!active) return;
        setError(String(e?.message || 'failed to load project 360'));
      } finally {
        if (active) setLoading(false);
      }
    }

    run();
    return () => {
      active = false;
    };
  }, [projectId]);

  const model = data?.project360;
  const degraded = !!model?.integration_status?.degraded;

  const documentTypeRows = useMemo(() => {
    const byType = model?.documents?.counters?.by_type || {};
    return Object.entries(byType)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
  }, [model]);

  if (loading) {
    return <div className="p-6 text-sm text-gray-300">Loading Project 360...</div>;
  }

  if (error || !model) {
    return (
      <div className="p-6 space-y-3">
        <h1 className="text-xl font-semibold text-red-300">Project 360 unavailable</h1>
        <p className="text-sm text-red-100/90">{error || 'Unknown error'}</p>
        <Link href="/dashboard" className="text-sm text-blue-300 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const s = model.project_summary;

  return (
    <main className="p-4 md:p-6 lg:p-8 space-y-6">
      <header className="rounded-2xl border border-gray-700/80 bg-gray-950/70 p-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300/80">Project 360 Workspace</p>
            <h1 className="text-2xl md:text-3xl font-semibold text-white mt-1">
              {String(s.project_name || s.name || model.project_id)}
            </h1>
            <p className="text-sm text-gray-300 mt-2">Canonical Project ID: {model.project_id}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs md:text-sm">
            <div className="rounded-xl bg-gray-900/80 border border-gray-700 px-3 py-2">
              <p className="text-gray-400">Status</p>
              <p className="text-white font-medium">{String(s.status || 'unknown')}</p>
            </div>
            <div className="rounded-xl bg-gray-900/80 border border-gray-700 px-3 py-2">
              <p className="text-gray-400">Handover</p>
              <p className="text-white font-medium">{model.handover_status.handover_state}</p>
            </div>
          </div>
        </div>
      </header>

      {degraded && (
        <section className="rounded-2xl border border-amber-500/50 bg-amber-500/10 p-4">
          <h2 className="text-sm font-semibold text-amber-200">Integration Degradation Detected</h2>
          <p className="text-xs text-amber-100/90 mt-1">
            {model.integration_status.failed_sources} of {model.integration_status.total_sources} sources failed in this response.
          </p>
          <ul className="mt-3 text-xs text-amber-100/90 space-y-1">
            {model.integration_status.sources
              .filter((src) => !src.ok)
              .map((src) => (
                <li key={`${src.source}:${src.path}`}>
                  {src.source} -> {src.path} ({src.http_status || 'network'}) {src.error || ''}
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold text-white">Project Summary</h2>
          <dl className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-gray-400">Start Date</dt>
              <dd className="text-gray-100">{toDate(s.start_date)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">End Date</dt>
              <dd className="text-gray-100">{toDate(s.end_date)}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Owner</dt>
              <dd className="text-gray-100">{String(s.project_manager || s.owner_name || '-')}</dd>
            </div>
            <div>
              <dt className="text-gray-400">Sites</dt>
              <dd className="text-gray-100">{model.project_sites.length}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">GIS Context</h2>
          <p className="mt-2 text-xs text-gray-300">Area: {String(model.gis_context.total_area || model.gis_context.area || '-')}</p>
          <p className="text-xs text-gray-300">Layers: {String(model.gis_context.layers_count || model.gis_context.layers || '-')}</p>
          <p className="text-xs text-gray-300">Coverage: {String(model.gis_context.coverage || '-')}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Documents</h2>
          <p className="mt-2 text-2xl font-semibold text-cyan-300">{model.documents.counters.total}</p>
          <ul className="mt-3 text-xs text-gray-300 space-y-1">
            {documentTypeRows.map(([key, value]) => (
              <li key={key} className="flex items-center justify-between">
                <span>{key}</span>
                <span>{value}</span>
              </li>
            ))}
          </ul>
        </article>

        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Contracts</h2>
          <p className="mt-2 text-2xl font-semibold text-blue-300">{model.contracts.counters.total}</p>
          <p className="mt-2 text-xs text-gray-300">Active: {model.contracts.counters.active}</p>
          <p className="text-xs text-gray-300">Completed: {model.contracts.counters.completed}</p>
          <p className="text-xs text-gray-300">Cancelled: {model.contracts.counters.cancelled}</p>
        </article>

        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Budget</h2>
          <p className="mt-2 text-lg font-semibold text-emerald-300">{toCurrency(model.budget_summary.totals.total_budget)}</p>
          <p className="mt-2 text-xs text-gray-300">Spent: {toCurrency(model.budget_summary.totals.spent_amount)}</p>
          <p className="text-xs text-gray-300">Remaining: {toCurrency(model.budget_summary.totals.remaining_amount)}</p>
          <p className="text-xs text-gray-300">Utilization: {model.budget_summary.totals.utilization_pct.toFixed(1)}%</p>
        </article>

        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Correspondence</h2>
          <p className="mt-2 text-2xl font-semibold text-indigo-300">{model.correspondence.counters.total}</p>
          <p className="mt-2 text-xs text-gray-300">Incoming: {model.correspondence.counters.incoming}</p>
          <p className="text-xs text-gray-300">Outgoing: {model.correspondence.counters.outgoing}</p>
          <p className="text-xs text-gray-300">Internal: {model.correspondence.counters.internal}</p>
        </article>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Milestones & Handover</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3">
              <p className="text-gray-400">Milestones</p>
              <p className="text-white font-semibold">{model.milestones.counters.completed}/{model.milestones.counters.total}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3">
              <p className="text-gray-400">Resulting Assets</p>
              <p className="text-white font-semibold">{model.handover_status.resulting_assets_count}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3">
              <p className="text-gray-400">Work Orders</p>
              <p className="text-white font-semibold">{model.handover_status.maintenance_work_orders_count}</p>
            </div>
            <div className="rounded-lg border border-gray-700 bg-gray-950/70 p-3">
              <p className="text-gray-400">Maintenance Items</p>
              <p className="text-white font-semibold">{model.handover_status.maintenance_items_count}</p>
            </div>
          </div>
        </article>

        <article className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
          <h2 className="text-sm font-semibold text-white">Governance Activity</h2>
          <div className="mt-3 max-h-64 overflow-auto space-y-2 pr-1">
            {model.governance_activity.slice(0, 12).map((item) => (
              <div key={`${item.action_type}:${item.id}`} className="rounded-lg border border-gray-700 bg-gray-950/70 p-2 text-xs">
                <p className="text-gray-100 font-medium">{item.title}</p>
                <p className="text-gray-300 mt-1">
                  {item.canonical_ref.entity_type}:{item.canonical_ref.entity_id}
                </p>
                <p className="text-gray-400">{item.actor || '-'} | {toDate(item.at)}</p>
              </div>
            ))}
            {!model.governance_activity.length && (
              <p className="text-xs text-gray-400">No governance actions found for canonical project/asset scope.</p>
            )}
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-gray-700 bg-gray-900/80 p-4">
        <h2 className="text-sm font-semibold text-white">Operational Timeline</h2>
        <div className="mt-3 max-h-96 overflow-auto space-y-2 pr-1">
          {model.operational_timeline.slice(0, 40).map((event) => (
            <div key={event.id} className="rounded-lg border border-gray-700 bg-gray-950/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-3">
                <p className="text-gray-100 font-medium">{event.title}</p>
                <p className="text-gray-400">{event.kind}</p>
              </div>
              <p className="text-gray-300 mt-1">{event.subtitle || '-'}</p>
              <p className="text-gray-400 mt-1">{toDate(event.at)} | {event.status || 'n/a'}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
