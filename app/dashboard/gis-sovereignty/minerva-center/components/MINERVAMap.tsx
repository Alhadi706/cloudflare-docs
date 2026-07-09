'use client';
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface AnomalyPoint { lat:number; lon:number; score:number; date:string; severity:string; is_event:boolean; }
export type DrawMode = 'none'|'point'|'rectangle'|'polygon'|'circle'|'line';
export interface LayerVisibility { pipeline:boolean; buffer:boolean; anomalies:boolean; labels:boolean; }
export interface MINERVAMapHandle {
  flyToAnomaly:(lat:number,lon:number,zoom?:number)=>void;
  flyToAsset:()=>void;
  setDrawMode:(mode:DrawMode)=>void;
  clearDraw:()=>void;
  loadGeoJSON:(g:any)=>void;
  getDrawnGeometry:()=>any;
}
interface Props {
  lat:number; lon:number; bufferMeters?:number; assetColor?:string; assetLabel?:string;
  timeline:AnomalyPoint[]; timelineIndex:number; showAllAnomalies:boolean;
  layers:LayerVisibility; onMapClick?:(lat:number,lon:number)=>void;
  onDrawComplete?:(g:any)=>void; onAnomalyClick?:(p:AnomalyPoint)=>void;
}

function mToDeg(m:number,lat:number){const r=(lat*Math.PI)/180;return Math.max(m/(111320*Math.cos(r)),m/110540);}
function buildPipe(lon:number,lat:number):number[][]{return[[lon-.06,lat+.002],[lon-.03,lat+.005],[lon,lat],[lon+.03,lat-.003],[lon+.06,lat+.001]];}
function bufferPoly(coords:number[][],d:number):number[][][]{const u=coords.map(([x,y])=>[x,y+d]);const l=[...coords].reverse().map(([x,y])=>[x,y-d]);return[[...u,...l,u[0]]];}
const SEV:Record<string,string>={SEVERE:'#ef4444',ANOMALY:'#f97316',WATCH:'#eab308',NORMAL:'#22c55e'};

const MINERVAMap=forwardRef<MINERVAMapHandle,Props>(function MINERVAMap(p,ref){
  const cRef=useRef<HTMLDivElement>(null);
  const mRef=useRef<any>(null);
  const mkRef=useRef<any[]>([]);
  const dsRef=useRef<{mode:DrawMode;pts:[number,number][]}>({mode:'none',pts:[]});
  const dlRef=useRef(false);
  const drRef=useRef<any>(null);
  const startPt=useRef<[number,number]|null>(null);

  useImperativeHandle(ref,()=>({
    flyToAnomaly(lat,lon,zoom=14.5){mRef.current?.flyTo({center:[lon,lat],zoom,duration:900});},
    flyToAsset(){mRef.current?.flyTo({center:[p.lon,p.lat],zoom:13,duration:900});},
    setDrawMode(mode){dsRef.current={mode,pts:[]};if(mRef.current)mRef.current.getCanvas().style.cursor=mode!=='none'?'crosshair':'grab';},
    clearDraw(){
      dsRef.current={mode:'none',pts:[]};drRef.current=null;
      if(mRef.current){mRef.current.getCanvas().style.cursor='grab';
        mRef.current.getSource('draw')?.setData({type:'FeatureCollection',features:[]});}
    },
    loadGeoJSON(gj){
      const m=mRef.current;if(!m)return;
      if(m.getSource('ext'))m.getSource('ext').setData(gj);
      else{m.addSource('ext',{type:'geojson',data:gj});
        m.addLayer({id:'ext-fill',type:'fill',source:'ext',paint:{'fill-color':'#f59e0b','fill-opacity':.25},filter:['==','$type','Polygon']});
        m.addLayer({id:'ext-line',type:'line',source:'ext',paint:{'line-color':'#f59e0b','line-width':2.5}});}
      try{const coords:number[][]=[];
        const col=(g:any)=>{if(g.type==='Point')coords.push(g.coordinates);else if(g.type==='LineString')coords.push(...g.coordinates);else if(g.type==='Polygon')coords.push(...g.coordinates[0]);else if(g.type==='FeatureCollection')g.features.forEach((f:any)=>col(f.geometry));else if(g.type==='Feature')col(g.geometry);};
        col(gj);if(coords.length>0){const lo=coords.map(c=>c[0]),la=coords.map(c=>c[1]);m.fitBounds([[Math.min(...lo),Math.min(...la)],[Math.max(...lo),Math.max(...la)]],{padding:60});}
      }catch{}
    },
    getDrawnGeometry(){return drRef.current;},
  }),[p.lat,p.lon]);

  useEffect(()=>{
    if(!cRef.current||mRef.current)return;
    let ml:any;try{ml=require('maplibre-gl');}catch{return;}
    const m=new ml.Map({container:cRef.current,
      style:{version:8,sources:{osm:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,attribution:'© OpenStreetMap'}},layers:[{id:'osm',type:'raster',source:'osm'}],glyphs:'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf'},
      center:[p.lon,p.lat],zoom:12.5});

    m.on('load',()=>{
      const pipe=buildPipe(p.lon,p.lat);
      const bd=mToDeg(p.bufferMeters??50,p.lat);
      const bp=bufferPoly(pipe,bd);
      const ac=p.assetColor??'#3b82f6';

      m.addSource('buf',{type:'geojson',data:{type:'Feature',properties:{},geometry:{type:'Polygon',coordinates:bp}}});
      m.addLayer({id:'buf-fill',type:'fill',source:'buf',paint:{'fill-color':ac,'fill-opacity':.08}});
      m.addLayer({id:'buf-line',type:'line',source:'buf',paint:{'line-color':ac,'line-width':1.5,'line-opacity':.4,'line-dasharray':[4,3]}});

      m.addSource('pipe',{type:'geojson',data:{type:'Feature',properties:{name:p.assetLabel??'الأصل محل الدراسة'},geometry:{type:'LineString',coordinates:pipe}}});
      m.addLayer({id:'pipe-glow',type:'line',source:'pipe',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':ac,'line-width':14,'line-opacity':.1,'line-blur':6}});
      m.addLayer({id:'pipe-line',type:'line',source:'pipe',layout:{'line-join':'round','line-cap':'round'},paint:{'line-color':ac,'line-width':3.5,'line-opacity':.95}});
      m.addLayer({id:'pipe-dash',type:'line',source:'pipe',layout:{'line-join':'round','line-cap':'butt'},paint:{'line-color':'#fff','line-width':1,'line-opacity':.25,'line-dasharray':[2,8]}});
      m.addLayer({id:'pipe-lbl',type:'symbol',source:'pipe',layout:{'symbol-placement':'line-center','text-field':['get','name'],'text-size':11,'text-offset':[0,-1.5]},paint:{'text-color':'#93c5fd','text-halo-color':'#000','text-halo-width':1.5}});

      m.addSource('draw',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
      m.addLayer({id:'draw-fill',type:'fill',source:'draw',paint:{'fill-color':'#f59e0b','fill-opacity':.2},filter:['==','$type','Polygon']});
      m.addLayer({id:'draw-line',type:'line',source:'draw',paint:{'line-color':'#f59e0b','line-width':2,'line-dasharray':[2,2]}});
      dlRef.current=true;
    });

    m.on('mousedown',(e:any)=>{if(dsRef.current.mode!=='none')startPt.current=[e.lngLat.lng,e.lngLat.lat];});
    m.on('mouseup',(e:any)=>{
      const ds=dsRef.current;if(ds.mode==='none')return;
      const end:[number,number]=[e.lngLat.lng,e.lngLat.lat];let geom:any=null;
      if(ds.mode==='point'){geom={type:'Point',coordinates:end};p.onMapClick?.(end[1],end[0]);}
      else if(ds.mode==='rectangle'&&startPt.current){const[x1,y1]=startPt.current,[x2,y2]=end;geom={type:'Polygon',coordinates:[[[x1,y1],[x2,y1],[x2,y2],[x1,y2],[x1,y1]]]};}
      else if(ds.mode==='circle'&&startPt.current){const dx=end[0]-startPt.current[0],dy=end[1]-startPt.current[1],r=Math.sqrt(dx*dx+dy*dy),pts:number[][]=[];for(let i=0;i<=64;i++){const a=(i/64)*2*Math.PI;pts.push([startPt.current[0]+r*Math.cos(a),startPt.current[1]+r*Math.sin(a)]);}geom={type:'Polygon',coordinates:[pts]};}
      if(geom&&dlRef.current){drRef.current=geom;m.getSource('draw')?.setData({type:'FeatureCollection',features:[{type:'Feature',properties:{},geometry:geom}]});p.onDrawComplete?.({type:'Feature',properties:{},geometry:geom});}
      startPt.current=null;
      if(['rectangle','circle'].includes(ds.mode)){dsRef.current={mode:'none',pts:[]};m.getCanvas().style.cursor='grab';}
    });
    m.on('click',(e:any)=>{if(dsRef.current.mode==='none')p.onMapClick?.(e.lngLat.lat,e.lngLat.lng);});
    m.addControl(new ml.NavigationControl({showCompass:true}),'top-right');
    m.addControl(new ml.ScaleControl({maxWidth:100,unit:'metric'}),'bottom-left');
    mRef.current=m;
    return()=>{m.remove();mRef.current=null;dlRef.current=false;};
  },[p.lat,p.lon]);

  useEffect(()=>{
    const m=mRef.current;if(!m||!m.loaded())return;
    let ml:any;try{ml=require('maplibre-gl');}catch{return;}
    mkRef.current.forEach(mk=>mk.remove());mkRef.current=[];
    if(!p.timeline||p.timeline.length===0)return;
    const pipe=buildPipe(p.lon,p.lat);const tLen=pipe.length-1;
    const pts=p.showAllAnomalies?p.timeline.filter(x=>x.score>.15):p.timeline.slice(0,p.timelineIndex+1).filter(x=>x.score>.15);
    const peak=Math.max(...p.timeline.map(x=>x.score));
    pts.forEach((pt,i)=>{
      const t=pts.length>1?i/(pts.length-1):.5,ri=t*tLen;
      const s0=pipe[Math.floor(ri)],s1=pipe[Math.min(Math.ceil(ri),tLen)];
      const f=ri-Math.floor(ri);
      const mLon=s0[0]+(s1[0]-s0[0])*f,mLat=s0[1]+(s1[1]-s0[1])*f;
      const jit=(Math.random()-.5)*.0008;
      const col=SEV[pt.severity]??'#94a3b8';const isPk=Math.abs(pt.score-peak)<.001;const sz=isPk?22:pt.score>=.6?16:12;
      const el=document.createElement('div');
      el.style.cssText=`width:${sz}px;height:${sz}px;border-radius:50%;background:${col};border:2.5px solid rgba(255,255,255,.9);cursor:pointer;box-shadow:0 2px 8px ${col}80;transition:transform .15s;z-index:${isPk?10:5};${isPk?'animation:mvp 1.4s infinite;':''}`;
      el.addEventListener('mouseenter',()=>{el.style.transform='scale(1.3)';});
      el.addEventListener('mouseleave',()=>{el.style.transform='scale(1)';});
      el.addEventListener('click',(e)=>{e.stopPropagation();p.onAnomalyClick?.(pt);});
      const mk=new ml.Marker({element:el}).setLngLat([mLon+jit,mLat+jit]).setPopup(
        new ml.Popup({offset:16,closeButton:true,maxWidth:'200px'}).setHTML(`<div dir="rtl" style="font-family:system-ui,sans-serif;padding:4px"><div style="font-weight:700;color:${col};font-size:13px">${pt.severity}</div><div style="font-size:12px;color:#cbd5e1">Score: <b>${pt.score.toFixed(3)}</b></div><div style="font-size:11px;color:#64748b">${pt.date}</div>${pt.is_event?'<div style="color:#ef4444;font-size:11px;font-weight:700;margin-top:3px">◄ حدث مؤكد</div>':''}</div>`)
      ).addTo(m);
      mkRef.current.push(mk);if(isPk){mk.togglePopup();}
    });
  },[p.timeline,p.timelineIndex,p.showAllAnomalies,p.lat,p.lon]);

  useEffect(()=>{
    const m=mRef.current;if(!m||!m.loaded())return;
    const tog=(id:string,v:boolean)=>{if(m.getLayer(id))m.setLayoutProperty(id,'visibility',v?'visible':'none');};
    tog('pipe-line',p.layers.pipeline);tog('pipe-glow',p.layers.pipeline);tog('pipe-dash',p.layers.pipeline);
    tog('pipe-lbl',p.layers.labels);tog('buf-fill',p.layers.buffer);tog('buf-line',p.layers.buffer);
    mkRef.current.forEach(mk=>{mk.getElement().style.display=p.layers.anomalies?'block':'none';});
  },[p.layers]);

  return(<>
    <style>{`@keyframes mvp{0%,100%{box-shadow:0 0 6px 2px #ef444488;transform:scale(1)}50%{box-shadow:0 0 18px 8px #ef444433;transform:scale(1.2)}}.maplibregl-ctrl-attrib{font-size:9px!important}.maplibregl-popup-content{background:#1e293b!important;color:#e2e8f0!important;border:1px solid #334155!important;border-radius:10px!important;padding:10px!important}.maplibregl-popup-tip{border-top-color:#1e293b!important;border-bottom-color:#1e293b!important}`}</style>
    <div ref={cRef} className="w-full h-full"/>
  </>);
});
export default MINERVAMap;
