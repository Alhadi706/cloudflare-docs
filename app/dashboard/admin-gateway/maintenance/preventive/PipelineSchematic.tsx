'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export const SCHEMATIC_REF = {
  production: 1018728,
  consumption: 1013159,
  nrw: 0.55
};

export interface SchematicProps {
  filename?: string;
  backgroundImage?: string;
  totalProduction: number;
  totalConsumption: number;
  nrw: number;
  stations: { name: string; flow: number; pressure: number }[];
  consumption: { name: string; actual: number; design: number }[];
}

const SourceNode = ({ x, y, title, flow, wells }: any) => (
  <foreignObject x={x} y={y} width="150" height="90">
    <div className="flex flex-col border-[1.5px] border-[#5c3a21] bg-[#f4e6e0] text-[10px] w-full h-full shadow-sm">
      <div className="font-bold text-[#800000] text-center py-1 border-b-[1.5px] border-[#5c3a21] leading-tight flex-1 flex items-center justify-center">{title}</div>
      <table className="w-full bg-white text-center border-collapse">
        <tbody>
          <tr><td className="border-b border-t border-l border-[#5c3a21] text-[#1d3369] font-bold p-1 w-1/2">معدل التدفق<br/>(م³/يوم)</td><td className="border-b border-t border-[#5c3a21] font-bold p-1 text-black">{flow?.toLocaleString() || '---'}</td></tr>
          <tr><td className="border-l border-[#5c3a21] text-[#1d3369] font-bold p-1">الآبار العاملة</td><td className="font-bold p-1 text-black">{wells}</td></tr>
        </tbody>
      </table>
    </div>
  </foreignObject>
);

const Pump = ({ x, y, color = "#22c55e" }: any) => (
  <g transform={`translate(${x}, ${y})`}>
    <circle cx="0" cy="0" r="14" fill="white" stroke="black" strokeWidth="1.5" />
    <polygon points="-5,-7 -5,7 9,0" fill={color} stroke="black" strokeWidth="0.5" />
  </g>
);

const FlowMeter = ({ x, y, value, label = "معدل التدفق" }: any) => (
  <g transform={`translate(${x}, ${y})`}>
    <rect x="-45" y="-12" width="90" height="24" fill="white" stroke="#5c3a21" strokeWidth="1.5" rx="12" />
    <text x="0" y="4" textAnchor="middle" fontSize="11" fontWeight="bold" fill="black">{value > 0 ? value.toLocaleString() : '---'}</text>
    <rect x="-40" y="-30" width="80" height="16" fill="white" stroke="#a0a0a0" strokeWidth="0.5" />
    <text x="0" y="-19" textAnchor="middle" fontSize="9" fontWeight="bold" fill="#1d3369">{label}</text>
  </g>
);

const CrossValve = ({ x, y, open = true, vertical = false }: any) => {
  const color = open ? "#22c55e" : "#ef4444";
  return (
    <g transform={`translate(${x}, ${y}) ${vertical ? 'rotate(90)' : ''}`}>
      <polygon points="-10,-10 -10,10 0,0" fill={color} stroke="black" strokeWidth="1" />
      <polygon points="10,-10 10,10 0,0" fill={color} stroke="black" strokeWidth="1" />
    </g>
  );
}

const TankNode = ({ x, y, name, level, max }: any) => {
  const pct = Math.min(100, Math.max(0, (level / (max || 1)) * 100));
  return (
    <g transform={`translate(${x}, ${y})`}>
      <foreignObject x="-60" y="-85" width="120" height="20">
        <div className="text-center font-bold text-[12px] text-black whitespace-nowrap">{name}</div>
      </foreignObject>
      <rect x="-30" y="-60" width="60" height="70" fill="#99bce8" stroke="black" strokeWidth="1.5" />
      <rect x="-30" y={-60 + (70 - (pct * 70 / 100))} width="60" height={(pct * 70 / 100)} fill="#3b82f6" />
      <foreignObject x="-75" y="15" width="150" height="40">
        <table className="w-full bg-white text-center border-collapse border border-black text-[9px] shadow-sm">
          <tbody>
            <tr><td className="border border-black font-bold p-1 bg-gray-100">أعلى مستوى (م)</td><td className="border border-black font-bold p-1" dir="ltr">{max}</td></tr>
            <tr><td className="border border-black font-bold p-1 bg-[#fffbe6]">المستوى الفعلي</td><td className="border border-black font-bold p-1" dir="ltr">{level?.toFixed(2) || '---'}</td></tr>
          </tbody>
        </table>
      </foreignObject>
    </g>
  );
}

export default function PipelineSchematic({
  filename, backgroundImage, totalProduction, totalConsumption, nrw, stations, consumption
}: SchematicProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 36, y: 36 });
  const [dragging, setDragging] = useState(false);
  const [imgSize, setImgSize] = useState({ w: 1600, h: 1100 });
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const viewport = { w: 1400, h: 900 };
  
  const getStationFlow = (keywords: string[]) => {
    if (!stations) return 0;
    const s = stations.find(s => keywords.some(k => s.name.includes(k)));
    return s ? s.flow : 0;
  };

  const flowNEJHN = getStationFlow(['شمالي', 'الشمالي']);
  const flowNEJHS = getStationFlow(['جنوبي', 'الجنوبي']);
  const flowEJH = getStationFlow(['شرقي', 'الشرقي']);
  const flowShwayrif = getStationFlow(['شويرف']);

  const getStationPressure = (keywords: string[]) => {
    const s = stations.find((st) => keywords.some((k) => st.name.includes(k)));
    return s?.pressure ?? 0;
  };

  const pressureNEJHN = getStationPressure(['شمالي', 'الشمالي']);
  const pressureNEJHS = getStationPressure(['جنوبي', 'الجنوبي']);
  const pressureEJH = getStationPressure(['شرقي', 'الشرقي']);

  const pressureColor = (p: number, low: number, high: number) => {
    if (!p || Number.isNaN(p)) return '#64748b';
    if (p < low || p > high) return '#ef4444';
    if (p < low + 0.2 || p > high - 0.2) return '#f59e0b';
    return '#22c55e';
  };

  const scadaConsumptionTable = useMemo(() => {
    if (!Array.isArray(consumption) || consumption.length === 0) return [] as Array<{ label: string; value: number | null }>;
    const merged = new Map<string, number>();
    for (const row of consumption) {
      const label = String(row?.name || '').trim();
      if (!label) continue;
      const value = Number(row?.actual);
      if (!Number.isFinite(value)) continue;
      merged.set(label, (merged.get(label) || 0) + value);
    }
    return [...merged.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => (b.value || 0) - (a.value || 0));
  }, [consumption]);

  useEffect(() => {
    if (!backgroundImage) return;
    const img = new window.Image();
    img.onload = () => {
      setImgSize({
        w: img.naturalWidth || 1600,
        h: img.naturalHeight || 1100,
      });
    };
    img.src = backgroundImage;
  }, [backgroundImage]);

  const hasValidBackground = !!backgroundImage && imgSize.w >= 1100 && imgSize.h >= 700;

  const fitView = useCallback(() => {
    const zx = (viewport.w - 80) / imgSize.w;
    const zy = (viewport.h - 80) / imgSize.h;
    const nextZoom = Math.max(0.2, Math.min(1.25, Math.min(zx, zy)));
    setZoom(nextZoom);
    setPan({
      x: (viewport.w - imgSize.w * nextZoom) / 2,
      y: (viewport.h - imgSize.h * nextZoom) / 2,
    });
  }, [imgSize.h, imgSize.w]);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 36, y: 36 });
  }, []);

  const overlayTags = useMemo(() => {
    return [
      { x: 720, y: 140, label: 'الإنتاج', value: `${totalProduction.toLocaleString()} م³/يوم` },
      { x: 880, y: 140, label: 'الاستهلاك', value: `${totalConsumption.toLocaleString()} م³/يوم` },
      { x: 280, y: 355, label: 'NEJH(N)', value: (flowNEJHN || 124695).toLocaleString() },
      { x: 280, y: 470, label: 'NEJH(S)', value: (flowNEJHS || 155451).toLocaleString() },
      { x: 280, y: 592, label: 'EJH', value: (flowEJH || 684777).toLocaleString() },
      { x: 1005, y: 628, label: 'NRW', value: `${nrw.toFixed(2)}%` },
    ];
  }, [flowEJH, flowNEJHN, flowNEJHS, nrw, totalConsumption, totalProduction]);

  const symbolPumps = useMemo(
    () => [
      { x: 346, y: 359, color: pressureColor(pressureNEJHN, 8.5, 10.0), label: 'NEJH(N)' },
      { x: 346, y: 474, color: pressureColor(pressureNEJHS, 6.5, 7.5), label: 'NEJH(S)' },
      { x: 346, y: 595, color: pressureColor(pressureEJH, 6.5, 7.5), label: 'EJH' },
      { x: 1118, y: 644, color: '#22c55e', label: 'PS2' },
      { x: 1118, y: 690, color: '#22c55e', label: 'PS1' },
    ],
    [pressureEJH, pressureNEJHN, pressureNEJHS]
  );

  const symbolValves = useMemo(
    () => [
      { x: 406, y: 359, state: 'open' },
      { x: 406, y: 474, state: 'open' },
      { x: 406, y: 595, state: 'open' },
      { x: 726, y: 624, state: 'closed' },
      { x: 760, y: 624, state: 'open' },
      { x: 794, y: 624, state: 'closed' },
      { x: 901, y: 612, state: 'closed' },
    ],
    []
  );

  const symbolTanks = useMemo(
    () => [
      { x: 560, y: 456, name: 'ترهونة' },
      { x: 762, y: 457, name: 'سيدي الصيد' },
      { x: 990, y: 622, name: 'سيدي السايح' },
      { x: 566, y: 760, name: 'الشويرف' },
      { x: 768, y: 760, name: 'أبوزيان' },
    ],
    []
  );

  if (hasValidBackground) {
    return (
      <div className="space-y-3" style={{ direction: 'rtl' }}>
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
          تمت قراءة مخطط "اليومي" الأصلي من ملف Excel. يمكنك الآن التحريك/التكبير لرؤية المخطط بالكامل بدون قص.
        </div>

        <div className="rounded-xl border border-slate-300 bg-slate-100 p-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
            <button onClick={() => setZoom((z) => Math.min(3, z * 1.2))} className="rounded border border-slate-500 bg-white px-2 py-1 text-slate-800">تكبير +</button>
            <button onClick={() => setZoom((z) => Math.max(0.2, z / 1.2))} className="rounded border border-slate-500 bg-white px-2 py-1 text-slate-800">تصغير -</button>
            <button onClick={fitView} className="rounded border border-slate-500 bg-white px-2 py-1 text-slate-800">ملاءمة الشاشة</button>
            <button onClick={resetView} className="rounded border border-slate-500 bg-white px-2 py-1 text-slate-800">إعادة ضبط</button>
            <span className="text-slate-600">Zoom: {(zoom * 100).toFixed(0)}%</span>
            {filename && <span className="text-slate-500">{filename}</span>}
          </div>

          <div
            className="relative h-[78vh] min-h-[560px] overflow-hidden rounded-lg border border-slate-400 bg-white"
            onMouseDown={(e) => {
              setDragging(true);
              dragRef.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
            }}
            onMouseMove={(e) => {
              if (!dragging || !dragRef.current) return;
              setPan({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
            }}
            onMouseUp={() => setDragging(false)}
            onMouseLeave={() => setDragging(false)}
          >
            <svg
              viewBox={`0 0 ${viewport.w} ${viewport.h}`}
              className="h-full w-full"
              onWheel={(e) => {
                e.preventDefault();
                setZoom((z) => {
                  const next = e.deltaY < 0 ? z * 1.08 : z * 0.92;
                  return Math.max(0.2, Math.min(3, next));
                });
              }}
            >
              <rect x="0" y="0" width={viewport.w} height={viewport.h} fill="#f8fafc" />
              <g transform={`translate(${pan.x} ${pan.y}) scale(${zoom})`}>
                <image href={backgroundImage} x="0" y="0" width={imgSize.w} height={imgSize.h} preserveAspectRatio="xMinYMin meet" />

                {/* SCADA symbol layer: pumps/valves/tanks anchored to the original diagram */}
                {symbolTanks.map((t) => (
                  <g key={`tank-${t.x}-${t.y}`} transform={`translate(${t.x} ${t.y})`}>
                    <rect x="-3" y="-42" width="6" height="42" fill="#3b82f6" opacity="0.55" />
                    <text x="0" y="-46" fontSize="8" textAnchor="middle" fill="#1e293b">{t.name}</text>
                  </g>
                ))}

                {symbolPumps.map((p) => (
                  <g key={`pump-${p.x}-${p.y}`} transform={`translate(${p.x} ${p.y})`}>
                    <circle cx="0" cy="0" r="10" fill="white" stroke="#0f172a" strokeWidth="1" />
                    <polygon points="-3,-5 -3,5 5,0" fill={p.color} stroke="#0f172a" strokeWidth="0.5" />
                    <text x="12" y="3" fontSize="7" fill="#0f172a">{p.label}</text>
                  </g>
                ))}

                {symbolValves.map((v, idx) => (
                  <g key={`valve-${idx}`} transform={`translate(${v.x} ${v.y})`}>
                    <polygon points="-6,-6 -6,6 0,0" fill={v.state === 'open' ? '#22c55e' : '#ef4444'} stroke="#111827" strokeWidth="0.7" />
                    <polygon points="6,-6 6,6 0,0" fill={v.state === 'open' ? '#22c55e' : '#ef4444'} stroke="#111827" strokeWidth="0.7" />
                  </g>
                ))}

                {overlayTags.map((t, i) => (
                  <g key={`${t.label}-${i}`} transform={`translate(${t.x} ${t.y})`}>
                    <rect x="-4" y="-16" width="138" height="24" rx="4" fill="rgba(255,255,255,0.93)" stroke="#0f172a" strokeWidth="0.6" />
                    <text x="4" y="-1" fontSize="10" fill="#334155">{t.label}</text>
                    <text x="70" y="-1" fontSize="11" fontWeight="bold" fill="#0f172a">{t.value}</text>
                  </g>
                ))}
              </g>
            </svg>

            <div className="absolute right-3 top-3 rounded border border-slate-600 bg-white/95 px-2 py-1 text-[11px] shadow">
              <div className="font-bold text-slate-900">قراءات حية</div>
              <div className="text-slate-700">الإنتاج: {totalProduction.toLocaleString()} م³/يوم</div>
              <div className="text-slate-700">الاستهلاك: {totalConsumption.toLocaleString()} م³/يوم</div>
              <div className="text-slate-700">NRW: {nrw.toFixed(2)}%</div>
            </div>

            <div className="absolute bottom-3 left-3 rounded border border-slate-600 bg-white/95 px-2 py-1 text-[10px] shadow">
              <div className="font-bold text-slate-900">طبقة SCADA</div>
              <div className="text-slate-700">المضخة: أخضر طبيعي، أصفر تحذير، أحمر حرج</div>
              <div className="text-slate-700">الصمامات: أخضر فتح، أحمر إغلاق</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {backgroundImage && !hasValidBackground && (
        <div className="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" style={{ direction: 'rtl' }}>
          تم العثور على صورة داخل الملف لكنها ليست لوحة المخطط الكاملة. تم التحويل تلقائيا إلى وضع SCADA المتجهي الكامل.
        </div>
      )}

      <div className="w-full overflow-x-auto bg-gray-50 flex justify-center border border-gray-300 rounded shadow-inner p-4 font-sans" style={{ direction: 'rtl' }}>
      <svg viewBox="0 0 1400 950" preserveAspectRatio="xMidYMid meet" className="w-[1400px] h-[950px] bg-white shadow-md border border-gray-400" style={{ minWidth: '@1400px' }}>
        
        {/* Base Grid Pattern */}
        <defs>
          <pattern id="scadagrid" width="30" height="30" patternUnits="userSpaceOnUse">
            <rect width="30" height="30" fill="white" />
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#f4f4f4" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#scadagrid)" />

        {/* --- PIPES --- */}
        <g fill="none" stroke="black" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round">
          <path d="M 160 260 L 380 260" />
          <path d="M 160 410 L 1050 410" />
          <path d="M 160 560 L 380 560" />
          <path d="M 380 260 L 380 560" /> {/* Vertical manifold */}
          
          <path d="M 280 810 L 950 810" /> {/* Lower track (Shwayrif/Fezzan) */}
          
          <path d="M 550 410 L 550 300" /> {/* Tarhuna tap */}
          <path d="M 750 410 L 750 300" /> {/* Sidi Said tap */}
          <path d="M 950 410 L 950 510" /> {/* Sidi Sayeh tap */}
        </g>

        {/* --- PUMPS --- */}
        <Pump x="190" y="260" />
        <Pump x="190" y="410" />
        <Pump x="190" y="560" />
        <Pump x="310" y="810" />

        {/* --- VALVES --- */}
        <CrossValve x="350" y="260" />
        <CrossValve x="350" y="410" />
        <CrossValve x="350" y="560" />
        <CrossValve x="380" y="335" vertical={true} />
        <CrossValve x="380" y="485" vertical={true} />
        
        <CrossValve x="480" y="410" />
        <CrossValve x="650" y="410" />
        <CrossValve x="850" y="410" />

        {/* --- FLOW METERS --- */}
        <FlowMeter x="270" y="260" value={138828} />
        <FlowMeter x="270" y="410" value={162911} />
        <FlowMeter x="270" y="560" value={711420} />
        
        <FlowMeter x="430" y="410" value={totalProduction} />
        <FlowMeter x="700" y="410" value={totalProduction > 0 ? Math.round(totalProduction * 0.8) : 0} />
        <FlowMeter x="950" y="580" value={410000} />

        {/* --- SOURCES --- */}
        <SourceNode x="10" y="215" title="حقل شمال شرق جبل الحساونة الشمالي" flow={flowNEJHN || 124695} wells={30} />
        <SourceNode x="10" y="365" title="حقل شمال شرق جبل الحساونة الجنوبي" flow={flowNEJHS || 155451} wells={42} />
        <SourceNode x="10" y="515" title="حقل شرق جبل الحساونة" flow={flowEJH || 684777} wells={175} />
        <SourceNode x="120" y="765" title="معدل الدفق للشويرف" flow={flowShwayrif || 116560} wells="--" />

        {/* --- TANKS --- */}
        <TankNode x="550" y="270" name="خزان ترهونة" level={342.1} max={350} />
        <TankNode x="750" y="270" name="خزان سيدي الصيد" level={349.5} max={355} />
        <TankNode x="950" y="470" name="خزان سيدي السايح" level={98.5} max={103.22} />
        <TankNode x="450" y="770" name="خزان الشويرف" level={347.5} max={350} />
        <TankNode x="650" y="770" name="خزان أبوزيان" level={156.5} max={160} />

        {/* --- HTML OVERLAYS (Tables, Headers, Widgets) --- */}
        
        {/* Header Title */}
        <foreignObject x="450" y="20" width="500" height="60">
          <div className="bg-[#99bce8] border-2 border-[#1d3369] text-center font-bold text-[22px] py-1 shadow-sm text-black">
            التقرير اليومي لوضعية تشغيل المنظومة
          </div>
        </foreignObject>

        {/* Prod / Con Header */}
        <foreignObject x="500" y="90" width="400" height="80">
          <table className="w-full bg-white border-[1.5px] border-black text-center shadow-md">
            <tbody>
              <tr className="bg-[#e2cbc1] border-b border-black">
                <td className="border-l border-black font-bold p-1 text-[14px] text-black">الإنتاج (م³/يوم)</td>
                <td className="font-bold p-1 text-[14px] text-black">الاستهلاك (م³/يوم)</td>
              </tr>
              <tr>
                <td className="border-l border-black font-bold text-[#1d3369] text-xl p-2">{totalProduction?.toLocaleString()}</td>
                <td className="font-bold text-[#1d3369] text-xl p-2">{totalConsumption?.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </foreignObject>

        {/* Date Box */}
        <foreignObject x="40" y="30" width="180" height="60">
          <div className="bg-[#b4c6e7] border-[1.5px] border-[#1d3369] text-center font-bold shadow-sm">
             <div className="border-b-[1.5px] border-[#1d3369] py-0.5 text-black">تاريخ الإصدار</div>
             <div className="bg-white py-1">{new Date().toISOString().split('T')[0]}</div>
          </div>
        </foreignObject>

        {/* Quality Box */}
        <foreignObject x="40" y="110" width="220" height="100">
          <table className="w-full bg-white border-[1.5px] border-[#1d3369] text-center shadow-sm text-[11px]">
            <thead>
              <tr>
                <th colSpan={2} className="bg-[#b4c6e7] border-b-[1.5px] border-[#1d3369] p-1.5 text-black font-bold leading-tight">نتائج تحاليل المياه المنتجة في<br/>الخط الرئيسي</th>
              </tr>
              <tr className="bg-gray-50 border-b-[1.5px] border-[#1d3369]">
                 <th className="border-l-[1.5px] border-[#1d3369] p-1 text-[#1d3369]">TDS (ملي جرام/لتر)</th>
                 <th className="p-1 text-[#1d3369]">NO3 (ملي جرام/لتر)</th>
              </tr>
            </thead>
            <tbody>
               <tr>
                 <td className="border-l-[1.5px] border-[#1d3369] font-bold p-1.5 text-black text-[13px]">1083</td>
                 <td className="font-bold p-1.5 text-black text-[13px]">46.2</td>
               </tr>
            </tbody>
          </table>
        </foreignObject>

        {/* Consumption Side-Table */}
        <foreignObject x="1100" y="50" width="280" height="850">
          <div className="bg-white border-[1.5px] border-[#1d3369] h-[800px] flex flex-col shadow-lg overflow-hidden">
            <div className="bg-[#b4c6e7] border-b-[1.5px] border-[#1d3369] text-center font-bold py-1.5 text-[14px] text-black">كميات المياه المستهلكة</div>
            <div className="flex-1 overflow-auto">
              <table className="w-full text-center border-collapse text-[12px]">
                 <thead className="sticky top-0 bg-[#e2cbc1] border-b border-[#1d3369]">
                   <tr>
                     <th className="border-l border-[#1d3369] p-1.5 w-1/2 text-black">المدينة</th>
                     <th className="p-1.5 w-1/2 text-black">الكمية (م³/يوم)</th>
                   </tr>
                 </thead>
                 <tbody>
                   {scadaConsumptionTable.length === 0 && (
                     <tr className="border-b border-[#1d3369] bg-white">
                       <td className="border-l border-[#1d3369] p-1.5 font-bold text-[#1d3369]">غير متاح</td>
                       <td className="p-1.5 font-bold text-[#64748b]">N/A</td>
                     </tr>
                   )}
                   {scadaConsumptionTable.map((row, i) => (
                     <tr key={i} className={`border-b border-[#1d3369] ${i%2===0?'bg-white':'bg-blue-50'}`}>
                       <td className="border-l border-[#1d3369] p-1.5 font-bold text-[#1d3369]">{row.label}</td>
                       <td className="p-1.5 font-bold text-[#800000]">{row.value != null ? row.value.toLocaleString() : 'N/A'}</td>
                     </tr>
                   ))}
                 </tbody>
              </table>
            </div>
          </div>
        </foreignObject>

        {/* Legend */}
        <foreignObject x="40" y="800" width="180" height="120">
          <div className="bg-white border border-gray-400 p-2 shadow-sm rounded-sm text-[11px] flex flex-col">
              <div className="font-bold border-b border-black mb-2 text-center text-[#1d3369]">تعريف المصطلحات</div>
              <div className="flex items-center mb-1"><div className="w-4 h-4 bg-red-500 border border-black ml-2 flex items-center justify-center text-[10px] text-white font-bold">X</div> صمام مغلق</div>
              <div className="flex items-center mb-1"><div className="w-4 h-4 bg-green-500 border border-black ml-2 flex items-center justify-center text-[10px] text-white font-bold">✓</div> صمام مفتوح</div>
              <div className="flex items-center mb-1"><div className="w-4 h-4 rounded-full bg-white border border-black ml-2 flex items-center justify-center"><div className="w-0 h-0 border-l-[4px] border-l-green-500 border-t-[3px] border-t-transparent border-b-[3px] border-b-transparent"></div></div> مضخة عاملة</div>
          </div>
        </foreignObject>

        {/* Signatures */}
        <foreignObject x="650" y="850" width="400" height="80">
          <div className="flex border-[1.5px] border-[#1d3369] flex-row text-center font-bold text-[12px] bg-white shadow-md">
            <div className="flex-1 flex flex-col border-l border-[#1d3369]"><div className="bg-[#b4c6e7] border-b border-[#1d3369] py-1 text-black">إعداد</div><div className="h-10"></div></div>
            <div className="flex-1 flex flex-col border-l border-[#1d3369]"><div className="bg-[#b4c6e7] border-b border-[#1d3369] py-1 text-black">مراجعة</div><div className="h-10"></div></div>
            <div className="flex-1 flex flex-col"><div className="bg-[#b4c6e7] border-b border-[#1d3369] py-1 text-black">إعتماد</div><div className="h-10"></div></div>
          </div>
        </foreignObject>

      </svg>
    </div>
    </>
  );
}
