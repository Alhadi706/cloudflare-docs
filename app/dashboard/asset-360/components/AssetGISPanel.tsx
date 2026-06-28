import React from 'react';
import { ExternalLink, LocateFixed, MapPin } from 'lucide-react';

export default function AssetGISPanel({
  gis,
}: {
  gis: {
    coordinates: { lon: number; lat: number } | null;
    geometry_type: string | null;
    map_links: { engineering_workspace: string; sovereignty_workspace: string };
  };
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2">
        <MapPin className="h-5 w-5 text-cyan-700" />
        <h3 className="text-base font-semibold text-slate-900">Asset Location (GIS)</h3>
      </div>

      <div className="mt-3 space-y-2 text-sm text-slate-700">
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-slate-500">Geometry Type</span>
          <span className="font-semibold">{gis.geometry_type || '-'}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-slate-500">Longitude</span>
          <span className="font-semibold">{gis.coordinates?.lon ?? '-'}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
          <span className="text-slate-500">Latitude</span>
          <span className="font-semibold">{gis.coordinates?.lat ?? '-'}</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <a href={gis.map_links.engineering_workspace} className="inline-flex items-center gap-1 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800">
          <LocateFixed className="h-3.5 w-3.5" />
          Open Engineering Workspace
        </a>
        <a href={gis.map_links.sovereignty_workspace} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <ExternalLink className="h-3.5 w-3.5" />
          Open GIS Sovereignty
        </a>
      </div>
    </section>
  );
}
