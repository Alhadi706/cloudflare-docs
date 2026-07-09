'use client';
// MINERVAMapOL — OpenLayers (same DSP engine) + registered assets + basemap switcher
import React,{useEffect,useRef,useImperativeHandle,forwardRef,useState,useCallback}from'react';

// Dynamic CSS import — guarded to avoid SSR issues
if (typeof window !== 'undefined') {
  try { require('ol/ol.css'); } catch { /* ignore if ol not available */ }
}
export type DrawMode='none'|'point'|'rectangle'|'polygon'|'circle'|'line';
export type BaseMapType='satellite'|'osm'|'terrain'|'dark';
export interface AnomalyPoint{lat:number;lon:number;score:number;date:string;severity:string;is_event:boolean;}
export interface LayerVisibility{pipeline:boolean;buffer:boolean;anomalies:boolean;labels:boolean;}
export interface PrincipalAsset{id:string|number;name:string;classification:string|null;geometry_type:string|null;geometry:any;health_score:number|null;status:string|null;}
export interface MINERVAMapHandle{flyToAnomaly:(l:number,o:number,z?:number)=>void;flyToAsset:()=>void;setDrawMode:(m:DrawMode)=>void;clearDraw:()=>void;loadGeoJSON:(g:any)=>void;getDrawnGeometry:()=>any;setBaseMap:(t:BaseMapType)=>void;reloadAssets:()=>void;}
interface Props{lat:number;lon:number;bufferMeters?:number;assetColor?:string;assetLabel?:string;timeline:AnomalyPoint[];timelineIndex:number;showAllAnomalies:boolean;layers:LayerVisibility;onMapClick?:(a:number,b:number)=>void;onDrawComplete?:(g:any)=>void;onAnomalyClick?:(p:AnomalyPoint)=>void;onAssetSelect?:(a:PrincipalAsset)=>void;selectedAssetId?:string|number|null;initialBaseMap?:BaseMapType;}

const SEV:Record<string,string>={SEVERE:'#ef4444',ANOMALY:'#f97316',WATCH:'#eab308',NORMAL:'#22c55e'};
function classColor(c:string|null):string{const s=(c??'').toLowerCase();if(s.includes('water'))return'#3b82f6';if(s.includes('oil'))return'#f97316';if(s.includes('gas'))return'#a855f7';if(s.includes('power'))return'#eab308';if(s.includes('road'))return'#64748b';return'#94a3b8';}
function buildPipe(lon:number,lat:number):[number,number][]{return[[lon-.06,lat+.002],[lon-.03,lat+.005],[lon,lat],[lon+.03,lat-.003],[lon+.06,lat+.001]];}
function mToDeg(m:number,lat:number):number{return Math.max(m/(111320*Math.cos((lat*Math.PI)/180)),m/110540);}
function makeSrc(t:BaseMapType){
  try{
    const{XYZ,OSM}=require('ol/source');
    return t==='satellite'?new XYZ({url:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',maxZoom:19}):t==='terrain'?new XYZ({url:'https://tile.opentopomap.org/{z}/{x}/{y}.png',maxZoom:17}):t==='dark'?new XYZ({url:'https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'}):new OSM();
  }catch{return null;}
}

const MINERVAMapOL=forwardRef<MINERVAMapHandle,Props>(function MINERVAMapOL(p,ref){
  const cr=useRef<HTMLDivElement>(null),mr=useRef<any>(null),br=useRef<any>(null);
  const dr=useRef<any>(null),di=useRef<any>(null),dg=useRef<any>(null);
  const[bm,setBm]=useState<BaseMapType>(p.initialBaseMap??'satellite');
  const[assets,setAssets]=useState<PrincipalAsset[]>([]);
  const[loadA,setLoadA]=useState(false);

  const loadAssets=useCallback(async()=>{
    setLoadA(true);
    try{
      const tk=typeof window!=='undefined'?(localStorage.getItem('auth_token')||''):'';
      const ti=typeof window!=='undefined'?(localStorage.getItem('tenant_id')||localStorage.getItem('active_tenant_id')||''):'';
      const h:Record<string,string>={};
      if(tk)h.Authorization='Bearer '+tk;
      if(ti)h['X-Tenant-ID']=ti;
      const res=await fetch('/api/engineering/workspace/principal-assets?limit=300',{headers:h});
      if(!res.ok)return;
      const d=await res.json();
      setAssets((Array.isArray(d)?d:(d?.data??d?.assets??[])).filter((a:PrincipalAsset)=>a.geometry));
    }catch{}finally{setLoadA(false);}
  },[]);

  useEffect(()=>{loadAssets();},[]);

  useImperativeHandle(ref,()=>({
    flyToAnomaly(lt,ln,z=14.5){const{fromLonLat:f}=require('ol/proj');mr.current?.getView().animate({center:f([ln,lt]),zoom:z,duration:900});},
    flyToAsset(){const{fromLonLat:f}=require('ol/proj');mr.current?.getView().animate({center:f([p.lon,p.lat]),zoom:13,duration:900});},
    setDrawMode(mode){
      const m=mr.current;if(!m)return;
      if(di.current){m.removeInteraction(di.current);di.current=null;}
      if(mode==='none'){m.getTargetElement().style.cursor='';return;}
      const{Draw}=require('ol/interaction');
      const tm:Record<string,string>={point:'Point',line:'LineString',polygon:'Polygon',rectangle:'Circle',circle:'Circle'};
      const draw=new Draw({source:dr.current,type:tm[mode]??'Point',geometryFunction:mode==='rectangle'?require('ol/interaction/Draw').createBox():undefined});
      draw.on('drawend',(e:any)=>{
        dg.current=e.feature.getGeometry();
        const fmt=new(require('ol/format').GeoJSON)();
        const gj=JSON.parse(fmt.writeFeature(e.feature,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'}));
        p.onDrawComplete?.(gj);m.removeInteraction(draw);di.current=null;
        m.getTargetElement().style.cursor='';
      });
      m.addInteraction(draw);m.getTargetElement().style.cursor='crosshair';di.current=draw;
    },
    clearDraw(){dr.current?.clear();dg.current=null;},
    loadGeoJSON(gj){
      const m=mr.current;if(!m)return;
      const{GeoJSON}=require('ol/format'),{Vector:VS}=require('ol/source'),{Vector:VL}=require('ol/layer'),{Style,Fill,Stroke}=require('ol/style');
      const feats=new GeoJSON().readFeatures(gj,{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});
      let lyr=m.getLayers().getArray().find((l:any)=>l.get('n')==='ext');
      if(!lyr){const s=new VS();lyr=new VL({source:s,zIndex:90,style:new Style({fill:new Fill({color:'rgba(245,158,11,.22)'}),stroke:new Stroke({color:'#f59e0b',width:2.5})})});lyr.set('n','ext');m.addLayer(lyr);}
      lyr.getSource().clear();lyr.getSource().addFeatures(feats);
      if(feats.length)m.getView().fit(lyr.getSource().getExtent(),{padding:[60,60,60,60],maxZoom:16,duration:700});
    },
    getDrawnGeometry(){return dg.current;},
    setBaseMap(t){setBm(t);br.current?.setSource(makeSrc(t));},
    reloadAssets(){loadAssets();},
  }),[p.lat,p.lon,loadAssets]);

  // ── Init map ────────────────────────────────────────────────────────────────
  useEffect(()=>{
    if(!cr.current||mr.current)return;
    try{
      const{Map}=require('ol'),{View}=require('ol'),{TileLayer,Vector:VL}=require('ol/layer'),{Vector:VS}=require('ol/source'),{fromLonLat}=require('ol/proj'),{ScaleLine,Attribution}=require('ol/control'),{Style,Fill,Stroke}=require('ol/style');
      const src=makeSrc(bm);if(!src)return;
      const bt=new TileLayer({source:src,zIndex:0});br.current=bt;
      const ds=new VS();dr.current=ds;
      const dl=new VL({source:ds,zIndex:99,style:new Style({fill:new Fill({color:'rgba(245,158,11,.18)'}),stroke:new Stroke({color:'#f59e0b',width:2.5,lineDash:[5,4]})})});dl.set('n','draw');
      const map=new Map({target:cr.current,layers:[bt,dl],view:new View({center:fromLonLat([p.lon,p.lat]),zoom:12.5}),controls:[new ScaleLine({units:'metric'}),new Attribution({collapsible:true})]});
      map.on('click',(e:any)=>{
        const{toLonLat}=require('ol/proj');const[ln,lt]=toLonLat(e.coordinate);
        let hit=false;
        map.forEachFeatureAtPixel(e.pixel,(f:any,l:any)=>{if(hit)return;if(l?.get('n')==='assets'){const a=f.get('a');if(a){hit=true;p.onAssetSelect?.(a);}}},{hitTolerance:6});
        p.onMapClick?.(lt,ln);
      });
      map.on('pointermove',(e:any)=>{
        let ov=false;
        map.forEachFeatureAtPixel(e.pixel,(_:any,l:any)=>{if(l?.get('n')==='assets')ov=true;},{hitTolerance:4});
        if(!di.current)map.getTargetElement().style.cursor=ov?'pointer':'';
      });
      mr.current=map;
      return()=>{map.setTarget(undefined);mr.current=null;};
    }catch(err){console.error('[MINERVAMap] OL init error:',err);}
  },[]);

  // ── Assets layer ────────────────────────────────────────────────────────────
  useEffect(()=>{
    const m=mr.current;if(!m||!assets.length)return;
    const{Vector:VS}=require('ol/source'),{Vector:VL}=require('ol/layer'),{GeoJSON}=require('ol/format'),{Style,Fill,Stroke,Circle:CS}=require('ol/style');
    const old=m.getLayers().getArray().find((l:any)=>l.get('n')==='assets');if(old)m.removeLayer(old);
    const src=new VS(),fmt=new GeoJSON(),sid=p.selectedAssetId?.toString();
    assets.forEach(a=>{
      if(!a.geometry)return;
      try{const fs=fmt.readFeatures({type:'Feature',geometry:a.geometry,properties:{}},{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'});fs.forEach((f:any)=>f.set('a',a));src.addFeatures(fs);}catch{}
    });
    const lyr=new VL({source:src,zIndex:10,style:(f:any)=>{
      const a=f.get('a');const isSel=a?.id?.toString()===sid;
      const c=isSel?'#f59e0b':classColor(a?.classification??null);
      const gt=f.getGeometry()?.getType()??'';
      if(gt==='LineString'||gt==='MultiLineString')return[new Style({stroke:new Stroke({color:c+'30',width:isSel?20:14})}),new Style({stroke:new Stroke({color:c,width:isSel?4.5:3})})];
      if(gt.includes('Polygon'))return new Style({fill:new Fill({color:c+'22'}),stroke:new Stroke({color:c,width:isSel?3:2})});
      return new Style({image:new CS({radius:isSel?10:7,fill:new Fill({color:c}),stroke:new Stroke({color:'#fff',width:isSel?2.5:1.5})})});
    }});
    lyr.set('n','assets');m.addLayer(lyr);
  },[assets,p.selectedAssetId]);

  // ── Buffer ──────────────────────────────────────────────────────────────────
  useEffect(()=>{
    const m=mr.current;if(!m)return;
    const old=m.getLayers().getArray().find((l:any)=>l.get('n')==='buf');if(old)m.removeLayer(old);
    if(!p.layers.buffer)return;
    const{Vector:VS}=require('ol/source'),{Vector:VL}=require('ol/layer'),{GeoJSON}=require('ol/format'),{Style,Fill,Stroke}=require('ol/style');
    const bd=mToDeg(p.bufferMeters??50,p.lat),pipe=buildPipe(p.lon,p.lat);
    const u=pipe.map(([x,y])=>[x,y+bd]),lo=[...pipe].reverse().map(([x,y])=>[x,y-bd]);
    const src=new VS();
    src.addFeatures(new GeoJSON().readFeatures({type:'Feature',geometry:{type:'Polygon',coordinates:[[...u,...lo,u[0]]]},properties:{}},{dataProjection:'EPSG:4326',featureProjection:'EPSG:3857'}));
    const c=p.assetColor??'#3b82f6';
    const lyr=new VL({source:src,zIndex:8,style:new Style({fill:new Fill({color:c+'15'}),stroke:new Stroke({color:c,width:1.5,lineDash:[6,4]})})});
    lyr.set('n','buf');m.addLayer(lyr);
  },[p.lat,p.lon,p.bufferMeters,p.assetColor,p.layers.buffer]);

  // ── Anomaly markers ─────────────────────────────────────────────────────────
  useEffect(()=>{
    const m=mr.current;if(!m)return;
    const old=m.getLayers().getArray().find((l:any)=>l.get('n')==='anm');if(old)m.removeLayer(old);
    if(!p.layers.anomalies||!p.timeline?.length)return;
    const{Vector:VS}=require('ol/source'),{Vector:VL}=require('ol/layer'),{Style,Fill,Stroke,Circle:CS}=require('ol/style'),{Feature}=require('ol'),{Point}=require('ol/geom'),{fromLonLat}=require('ol/proj');
    const pts=p.showAllAnomalies?p.timeline.filter(t=>t.score>.15):p.timeline.slice(0,p.timelineIndex+1).filter(t=>t.score>.15);
    const pipe=buildPipe(p.lon,p.lat),tLen=pipe.length-1,pk=Math.max(...p.timeline.map(t=>t.score));
    const src=new VS();
    pts.forEach((pt,i)=>{
      const t=pts.length>1?i/(pts.length-1):.5,ri=t*tLen;
      const s0=pipe[Math.floor(ri)],s1=pipe[Math.min(Math.ceil(ri),tLen)],f=ri-Math.floor(ri);
      const mLon=s0[0]+(s1[0]-s0[0])*f+(Math.random()-.5)*.0008;
      const mLat=s0[1]+(s1[1]-s0[1])*f+(Math.random()-.5)*.0004;
      const c=SEV[pt.severity]??'#94a3b8';const ip=Math.abs(pt.score-pk)<.001;const r=ip?11:pt.score>=.6?8:6;
      const feat=new Feature({geometry:new Point(fromLonLat([mLon,mLat])),anm:pt});
      feat.setStyle(new Style({image:new CS({radius:r,fill:new Fill({color:c}),stroke:new Stroke({color:'#fff',width:ip?2.5:1.5})})}));
      src.addFeature(feat);
    });
    const lyr=new VL({source:src,zIndex:20});lyr.set('n','anm');m.addLayer(lyr);
  },[p.timeline,p.timelineIndex,p.showAllAnomalies,p.lat,p.lon,p.layers.anomalies]);

  useEffect(()=>{br.current?.setSource(makeSrc(bm));},[bm]);

  return(
    <div className="relative w-full h-full">
      <style>{`.ol-scale-line{background:rgba(15,23,42,.8)!important;border-radius:8px!important;padding:3px 8px!important}.ol-scale-line-inner{border-color:#475569!important;color:#94a3b8!important;font-size:10px!important}.ol-attribution{background:rgba(15,23,42,.75)!important;border-radius:8px!important}.ol-attribution ul{font-size:9px!important;color:#64748b!important;margin:0!important}`}</style>
      <div ref={cr} className="w-full h-full rounded-xl overflow-hidden"/>
      <div className="absolute bottom-10 right-3 flex flex-col gap-1 z-30">
        {([{id:'satellite' as BaseMapType,l:'فضائي',e:'🛰️'},{id:'osm' as BaseMapType,l:'شوارع',e:'🗺️'},{id:'terrain' as BaseMapType,l:'تضاريس',e:'⛰️'},{id:'dark' as BaseMapType,l:'داكن',e:'🌑'}]).map(({id,l,e})=>(
          <button key={id} onClick={()=>setBm(id)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all shadow-lg backdrop-blur-sm border ${bm===id?'bg-blue-600/90 border-blue-400/60 text-white':'bg-slate-950/80 border-slate-700/50 text-slate-400 hover:text-slate-200'}`}><span>{e}</span>{l}</button>
        ))}
      </div>
      {assets.length>0&&<div className="absolute bottom-3 right-3 bg-slate-950/80 border border-slate-700/50 rounded-lg px-2 py-1 text-xs text-slate-400 backdrop-blur-sm z-20">{assets.length} أصل مسجّل</div>}
      {loadA&&<div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 bg-slate-950/85 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 flex items-center gap-2 pointer-events-none backdrop-blur-sm"><svg className="w-3 h-3 animate-spin text-blue-400" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>جارٍ تحميل الأصول...</div>}
    </div>
  );
});
export default MINERVAMapOL;
