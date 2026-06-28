'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import 'ol/ol.css';
import Map from 'ol/Map';
import View from 'ol/View';
import TileLayer from 'ol/layer/Tile';
import XYZ from 'ol/source/XYZ';
import VectorLayer from 'ol/layer/Vector';
import VectorSource from 'ol/source/Vector';
import { Style, Fill, Stroke, Circle as CircleStyle, Text as OLText } from 'ol/style';
import { fromLonLat } from 'ol/proj';
import Feature from 'ol/Feature';
import Point from 'ol/geom/Point';
import { Map as OLMap } from 'ol';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface ProjectPin {
  id: number; name: string; status: string; budget: number;
  start_date: string|null; end_date: string|null; location_name: string|null;
  site_count: number; color: string; lng: number; lat: number;
  organization?: string;
}
interface SpatialSummary   { sites_total:number; sites_mapped:number; assets_total:number; assets_mapped:number; layers_total:number; gis_coverage_pct:number; }
interface ExecutionSummary { budgets_count:number; allocated_amount:number; spent_amount:number; budget_utilization_pct:number; milestones_count:number; completed_milestones:number; tasks_count:number; completed_tasks:number; open_tasks:number; }
interface ProjectDetail { loading:boolean; error:string|null; project?:any; spatial?:SpatialSummary; execution?:ExecutionSummary; sites?:any[]; layers?:any[]; asset_depts?:Record<string,{total:number;healthy:number;critical:number}>; }

/* ─── Constants ──────────────────────────────────────────────────────────────── */
const getTenantId = () => {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('tenant_id') || localStorage.getItem('active_tenant_id') || '';
};
const STATUS_LABEL:Record<string,string> = { active:'نشط', completed:'مكتمل', on_hold:'معلق', cancelled:'ملغي', planning:'تخطيط' };
const STATUS_COLOR:Record<string,string> = { active:'#22c55e', completed:'#60a5fa', on_hold:'#f59e0b', cancelled:'#ef4444', planning:'#a78bfa' };
type BaseMap = 'dark'|'satellite'|'light';

function getAuthHeaders():Record<string,string> {
  if (typeof window==='undefined') return { 'Content-Type': 'application/json' };
  const tenantId = getTenantId();
  return {
    ...(tenantId ? { 'X-Tenant-ID': tenantId } : {}),
    'x-user-id': localStorage.getItem('user_id')?? '1',
    'x-user-role': localStorage.getItem('admin_mode')==='1'?'super_admin':(localStorage.getItem('user_role')?? 'viewer'),
    'Content-Type': 'application/json',
  };
}
function getSource(b:BaseMap) {
  if (b==='satellite') return new XYZ({ url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', maxZoom:19 });
  if (b==='light')     return new XYZ({ url:'https://basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png' });
  return new XYZ({ url:'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png' });
}
function pinStyle(pin:ProjectPin, sel:boolean):Style {
  const c=STATUS_COLOR[pin.status]??'#94a3b8';
  return new Style({
    image: new CircleStyle({ radius:sel?20:13, fill:new Fill({color:sel?c:c+'bb'}), stroke:new Stroke({color:sel?'#fff':'#ffffff66',width:sel?3:1.5}) }),
    text: new OLText({
      text: pin.name.length>14?pin.name.slice(0,14)+'…':pin.name,
      font:`${sel?'bold ':''}10px Cairo,sans-serif`,
      fill:new Fill({color:'#fff'}),
      offsetY:sel?30:24,
      backgroundFill:new Fill({color:sel?'rgba(0,0,0,0.85)':'rgba(0,0,0,0.6)'}),
      padding:[2,5,2,5],
    }),
  });
}

/* ─── Page ───────────────────────────────────────────────────────────────────── */
export default function ERPGisDashboardPage() {
  const mapRef      = useRef<HTMLDivElement>(null);
  const mapObj      = useRef<OLMap|null>(null);
  const pinSrcRef   = useRef<VectorSource|null>(null);
  const baseTile    = useRef<TileLayer<any>|null>(null);
  const featById    = useRef<Map<number,Feature>>(new Map());

  const [pins, setPins]       = useState<ProjectPin[]>([]);
  const [loading, setLoad]    = useState(true);
  const [selected, setSel]    = useState<ProjectPin|null>(null);
  const [detail, setDetail]   = useState<ProjectDetail>({loading:false,error:null});
  const [baseMap, setBase]    = useState<BaseMap>('dark');
  const [search, setSearch]   = useState('');
  const [orgFilter, setOrg]    = useState('');
  const [popupPos, setPopup]  = useState<{x:number,y:number}|null>(null);

  /* fetch all project pins */
  const fetchPins = useCallback(async()=>{
    setLoad(true);
    try {
      const r = await fetch(`/api/v1/erp-spatial/dashboard/geojson?tenant_id=${getTenantId()}`,{headers:getAuthHeaders()});
      const d = await r.json();
      const feats=(d.features??[]).filter((f:any)=>f.properties?.entity_type==='project');
      setPins(feats.map((f:any)=>({
        id:f.properties.id, name:f.properties.name, status:f.properties.status??'active',
        budget:f.properties.budget??0, start_date:f.properties.start_date, end_date:f.properties.end_date,
        location_name:f.properties.location_name, site_count:f.properties.site_count??0,
        color:STATUS_COLOR[f.properties.status]??'#94a3b8',
        lng:f.geometry.coordinates[0], lat:f.geometry.coordinates[1],
        organization:f.properties.organization??'',
      })));
    } catch(e){ console.error(e); } finally { setLoad(false); }
  },[]);
  useEffect(()=>{ fetchPins(); },[fetchPins]);

  /* fetch per-project detail */
  const loadDetail = useCallback(async(pin:ProjectPin)=>{
    setDetail({loading:true,error:null});
    try {
      const r = await fetch(`/api/v1/workspace/projects/${pin.id}/gis-overview`,{headers:getAuthHeaders()});
      if(!r.ok){ setDetail({loading:false,error:null,project:{...pin},spatial:{sites_total:pin.site_count,sites_mapped:0,assets_total:0,assets_mapped:0,layers_total:0,gis_coverage_pct:0},execution:{budgets_count:0,allocated_amount:0,spent_amount:0,budget_utilization_pct:0,milestones_count:0,completed_milestones:0,tasks_count:0,completed_tasks:0,open_tasks:0},sites:[],layers:[]}); return; }
      const d = await r.json();
      setDetail({loading:false,error:null,project:d.project,spatial:d.spatial_summary,execution:d.execution_summary,sites:d.sites??[],layers:d.layers??[],asset_depts:d.department_linkage?.asset_departments??{}});
    } catch(e:any){ setDetail({loading:false,error:e.message}); }
  },[]);

  /* init OL map */
  useEffect(()=>{
    if(!mapRef.current) return;
    const tile = new TileLayer({source:getSource('dark')});
    baseTile.current = tile;
    const src = new VectorSource();
    pinSrcRef.current = src;
    const vec = new VectorLayer({source:src,zIndex:10});
    const map = new OLMap({target:mapRef.current,layers:[tile,vec],view:new View({center:fromLonLat([13.18,32.9]),zoom:10})});
    mapObj.current = map;
    map.on('click',(evt)=>{
      const feat = map.forEachFeatureAtPixel(evt.pixel,f=>f,{hitTolerance:10});
      if(feat){ const p=(feat as any).__pin as ProjectPin; if(p) doSelect(p,map); }
      else     { setSel(null); setPopup(null); }
    });
    map.on('pointermove',(evt)=>{ (map.getTarget() as HTMLElement).style.cursor=map.hasFeatureAtPixel(evt.pixel,{hitTolerance:10})?'pointer':''; });
    return ()=>{ map.setTarget(undefined); mapObj.current=null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  /* populate pins on map when data arrives */
  useEffect(()=>{
    if(!pinSrcRef.current) return;
    pinSrcRef.current.clear();
    featById.current.clear();
    pins.forEach(pin=>{
      const f = new Feature({geometry:new Point(fromLonLat([pin.lng,pin.lat]))});
      (f as any).__pin=pin;
      f.setStyle(pinStyle(pin,false));
      pinSrcRef.current!.addFeature(f);
      featById.current.set(pin.id,f);
    });
  },[pins]);

  /* re-style on selection change */
  useEffect(()=>{
    featById.current.forEach((f,id)=>{
      const pin=pins.find(p=>p.id===id);
      if(pin) f.setStyle(pinStyle(pin,selected?.id===id));
    });
  },[selected,pins]);

  /* switch basemap */
  useEffect(()=>{ baseTile.current?.setSource(getSource(baseMap)); },[baseMap]);

  /* reposition popup on map move */
  useEffect(()=>{
    const map=mapObj.current;
    if(!map||!selected) return;
    const h=()=>{ const px=map.getPixelFromCoordinate(fromLonLat([selected.lng,selected.lat])); if(px) setPopup({x:px[0],y:px[1]}); };
    map.on('moveend',h);
    return ()=>map.un('moveend',h);
  },[selected]);

  const doSelect=(pin:ProjectPin,map?:OLMap|null)=>{
    setSel(pin);
    const m=map??mapObj.current;
    if(m){
      m.getView().animate({center:fromLonLat([pin.lng,pin.lat]),zoom:13,duration:600});
      const px=m.getPixelFromCoordinate(fromLonLat([pin.lng,pin.lat]));
      if(px) setPopup({x:px[0],y:px[1]});
      // After animate, update position
      setTimeout(()=>{ const px2=m.getPixelFromCoordinate(fromLonLat([pin.lng,pin.lat])); if(px2) setPopup({x:px2[0],y:px2[1]}); },700);
    }
    loadDetail(pin);
  };

  const fmt=(n:number)=>{ if(!n) return '—'; if(n>=1e6) return `${(n/1e6).toFixed(1)} م`; if(n>=1000) return `${(n/1000).toFixed(0)} ألف`; return `${n}`; };
  const orgs = Array.from(new Set(pins.map(p=>p.organization??'').filter(Boolean))).sort();
  const filtered=pins.filter(p=>{
    if(orgFilter && p.organization!==orgFilter) return false;
    if(search && !p.name.includes(search) && !(p.location_name??'').includes(search)) return false;
    return true;
  });

  /* popup screen position */
  const popupStyle = ():React.CSSProperties=>{
    if(!popupPos||!mapRef.current) return {display:'none'};
    const rect=mapRef.current.getBoundingClientRect();
    const W=340,H=500;
    let l=popupPos.x-W/2, t=popupPos.y-H-20;
    if(l<4) l=4;
    if(l+W>rect.width-4) l=rect.width-W-4;
    if(t<4) t=popupPos.y+24;
    return {position:'absolute',left:l,top:t,zIndex:50,width:W,display:'block'};
  };

  return (
    <div className="relative w-full h-screen bg-gray-950 flex overflow-hidden" dir="rtl" style={{fontFamily:'Cairo,sans-serif'}}>

      {/* ── Sidebar ─────────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 bg-gray-900 border-l border-gray-700 flex flex-col z-20">
        <div className="p-3 border-b border-gray-700">
          <h2 className="text-sm font-bold text-white mb-2">🗺️ المشاريع الجغرافية</h2>
          <select value={orgFilter} onChange={e=>setOrg(e.target.value)}
            className="w-full bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none mb-1.5">
            <option value="">— جميع المؤسسات —</option>
            {orgs.map(o=><option key={o} value={o}>{o}</option>)}
          </select>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="بحث في المشاريع…"
            className="w-full bg-gray-800 text-white text-xs px-2 py-1.5 rounded-lg border border-gray-600 focus:border-emerald-500 outline-none placeholder-gray-500"/>
        </div>
        <div className="flex text-xs text-center border-b border-gray-700">
          <div className="flex-1 py-2 text-gray-400"><div className="text-white font-bold text-base">{pins.length}</div><div>مشروع</div></div>
          <div className="flex-1 py-2 text-gray-400 border-r border-l border-gray-700"><div className="text-emerald-400 font-bold text-base">{pins.filter(p=>p.status==='active').length}</div><div>نشط</div></div>
          <div className="flex-1 py-2 text-gray-400"><div className="text-blue-400 font-bold text-base">{pins.filter(p=>p.status==='completed').length}</div><div>مكتمل</div></div>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {loading && <div className="text-xs text-gray-500 text-center py-8 animate-pulse">جارٍ التحميل…</div>}
          {filtered.map(pin=>(
            <button key={pin.id} onClick={()=>doSelect(pin)}
              className={`w-full text-right mb-1 px-2 py-2 rounded-lg text-xs transition-all border ${selected?.id===pin.id?'border-emerald-500 bg-emerald-900/30 text-white':'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-700/50 hover:border-gray-500'}`}>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:pin.color}}/>
                <span className="truncate font-medium leading-snug">{pin.name}</span>
              </div>
              <div className="text-gray-500 mt-0.5 pr-3.5 flex gap-2">
                <span>{STATUS_LABEL[pin.status]??pin.status}</span>
                {pin.budget>0&&<span>{fmt(pin.budget)}</span>}
              </div>
            </button>
          ))}
          {!loading&&filtered.length===0&&<p className="text-xs text-gray-600 text-center py-8">لا توجد نتائج</p>}
        </div>
        <div className="p-3 border-t border-gray-700">
          <p className="text-xs text-gray-500 font-bold mb-2">الحالة</p>
          <div className="grid grid-cols-2 gap-1">
            {Object.entries(STATUS_LABEL).map(([k,l])=>(
              <div key={k} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{background:STATUS_COLOR[k]}}/>
                <span className="text-xs text-gray-400">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ── Map + popup ─────────────────────────────────── */}
      <div className="flex-1 relative">
        {/* top bar */}
        <div className="absolute top-0 inset-x-0 z-30 flex items-center justify-between px-3 py-2 bg-gray-900/80 backdrop-blur border-b border-gray-700">
          <span className="text-xs text-gray-400">
            {selected?<><span className="text-white font-medium">{selected.name}</span> — انقر على الخريطة لإلغاء التحديد</>:'انقر على مشروع في القائمة أو على الخريطة'}
          </span>
          <div className="flex gap-1">
            {(['dark','satellite','light'] as BaseMap[]).map(b=>(
              <button key={b} onClick={()=>setBase(b)}
                className={`px-2 py-0.5 text-xs rounded ${baseMap===b?'bg-emerald-600 text-white':'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
                {b==='dark'?'داكن':b==='satellite'?'قمر صناعي':'فاتح'}
              </button>
            ))}
          </div>
        </div>
        <div ref={mapRef} className="w-full h-full pt-9"/>

        {/* popup */}
        {selected&&(
          <div style={popupStyle()} className="pointer-events-auto">
            <Popup pin={selected} detail={detail} onClose={()=>{setSel(null);setPopup(null);}} fmt={fmt}/>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Popup ───────────────────────────────────────────────────────────────────── */
function Popup({pin,detail:d,onClose,fmt}:{pin:ProjectPin;detail:ProjectDetail;onClose:()=>void;fmt:(n:number)=>string}) {
  const color=STATUS_COLOR[pin.status]??'#94a3b8';
  return (
    <div className="bg-gray-900 border border-gray-600 rounded-xl shadow-2xl overflow-hidden" style={{width:340}}>
      {/* header */}
      <div className="px-4 py-3 flex items-start justify-between" style={{borderBottom:`2px solid ${color}44`}}>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-white leading-snug">{pin.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{background:color+'33',color}}>{STATUS_LABEL[pin.status]??pin.status}</span>
            {pin.location_name&&<span className="text-xs text-gray-400 truncate max-w-[160px]">📍 {pin.location_name}</span>}
          </div>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-white text-xl leading-none ml-2">×</button>
      </div>

      {d.loading&&<div className="p-6 text-center text-xs text-gray-400 animate-pulse">جارٍ تحميل بيانات المشروع…</div>}

      {!d.loading&&(
        <div className="p-4 space-y-3 max-h-96 overflow-y-auto">

          {/* spatial */}
          {d.spatial&&(
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1.5">الملخص المكاني</p>
              <div className="grid grid-cols-3 gap-2">
                <SC label="المواقع"  value={d.spatial.sites_total}  c="emerald"/>
                <SC label="الأصول"   value={d.spatial.assets_total} c="blue"/>
                <SC label="الطبقات"  value={d.spatial.layers_total} c="purple"/>
              </div>
              {d.spatial.gis_coverage_pct>0&&(
                <div className="mt-2">
                  <div className="flex justify-between text-xs text-gray-400 mb-1"><span>تغطية GIS</span><span className="text-white">{d.spatial.gis_coverage_pct.toFixed(0)}%</span></div>
                  <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden"><div className="h-full bg-emerald-500 rounded-full" style={{width:`${d.spatial.gis_coverage_pct}%`}}/></div>
                </div>
              )}
            </div>
          )}

          {/* execution */}
          {d.execution&&(d.execution.tasks_count>0||d.execution.milestones_count>0||d.execution.allocated_amount>0)&&(
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1.5">التنفيذ</p>
              <div className="space-y-1 text-xs">
                {d.execution.tasks_count>0&&<div className="flex justify-between text-gray-300"><span className="text-white font-medium">{d.execution.completed_tasks}/{d.execution.tasks_count}</span><span>المهام</span></div>}
                {d.execution.milestones_count>0&&<div className="flex justify-between text-gray-300"><span className="text-white font-medium">{d.execution.completed_milestones}/{d.execution.milestones_count}</span><span>الأهداف</span></div>}
                {d.execution.allocated_amount>0&&<div className="flex justify-between text-gray-300"><span className="text-white font-medium">{fmt(d.execution.spent_amount)} / {fmt(d.execution.allocated_amount)}</span><span>المصروف/المخصص</span></div>}
                {d.execution.open_tasks>0&&<div className="flex justify-between text-gray-300"><span className="text-amber-400 font-medium">{d.execution.open_tasks}</span><span>مهام مفتوحة</span></div>}
              </div>
            </div>
          )}

          {/* budget */}
          {pin.budget>0&&<div className="flex justify-between text-xs"><span className="text-white font-bold">{fmt(pin.budget)} د.ل</span><span className="text-gray-400">الميزانية الكلية</span></div>}

          {/* dates */}
          {(pin.start_date||pin.end_date)&&(
            <div className="text-xs text-gray-400 flex gap-4">
              {pin.start_date&&<span>من: <span className="text-white">{pin.start_date.slice(0,10)}</span></span>}
              {pin.end_date  &&<span>إلى: <span className="text-white">{pin.end_date.slice(0,10)}</span></span>}
            </div>
          )}

          {/* sites */}
          {d.sites&&d.sites.length>0&&(
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1">المواقع ({d.sites.length})</p>
              <div className="space-y-1">
                {d.sites.slice(0,5).map((s:any)=>(
                  <div key={s.id} className="flex items-center gap-2 text-xs">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.status==='active'?'bg-emerald-400':'bg-gray-400'}`}/>
                    <span className="text-gray-200 truncate">{s.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* layers */}
          {d.layers&&d.layers.length>0&&(
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1">الطبقات ({d.layers.length})</p>
              <div className="space-y-1">
                {d.layers.slice(0,4).map((l:any)=>(
                  <div key={l.id} className="flex items-center gap-2 text-xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-purple-400"/>
                    <span className="text-gray-200 truncate">{l.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* asset departments */}
          {d.asset_depts&&Object.keys(d.asset_depts).length>0&&(
            <div>
              <p className="text-xs text-gray-500 font-bold mb-1">أصول حسب القسم</p>
              {Object.entries(d.asset_depts).map(([dept,info]:[string,any])=>(
                <div key={dept} className="flex justify-between text-xs mb-0.5">
                  <div className="flex gap-2">
                    {info.healthy>0&&<span className="text-emerald-400">{info.healthy} سليم</span>}
                    {info.critical>0&&<span className="text-red-400">{info.critical} حرج</span>}
                  </div>
                  <span className="text-gray-300 truncate max-w-[140px]">{dept}</span>
                </div>
              ))}
            </div>
          )}

          {/* no data */}
          {d.spatial&&d.spatial.assets_total===0&&d.spatial.layers_total===0&&(!d.sites||d.sites.length===0)&&(
            <p className="text-xs text-gray-600 text-center py-2">لم يتم إضافة بيانات مكانية لهذا المشروع بعد</p>
          )}

          {d.error&&<p className="text-xs text-red-400">{d.error}</p>}
        </div>
      )}

      {/* footer */}
      <div className="px-4 pb-3 pt-2 flex gap-2">
        <a href={`/dashboard/gis-sovereignty/engineering-workspace?project_id=${pin.id}`}
          className="flex-1 text-center text-xs py-1.5 bg-emerald-700 hover:bg-emerald-600 text-white rounded-lg transition font-medium">
          المساحة الهندسية
        </a>
        <a href={`/dashboard/admin-gateway/projects/sites?project_id=${pin.id}`}
          className="flex-1 text-center text-xs py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition">
          إدارة المشروع
        </a>
      </div>
    </div>
  );
}

function SC({label,value,c}:{label:string;value:number;c:'emerald'|'blue'|'purple'|'amber'}) {
  const cls={emerald:'text-emerald-400',blue:'text-blue-400',purple:'text-purple-400',amber:'text-amber-400'}[c];
  return (
    <div className="bg-gray-800 rounded-lg p-2 text-center">
      <div className={`font-bold text-lg ${cls}`}>{value}</div>
      <div className="text-gray-400 text-xs">{label}</div>
    </div>
  );
}
