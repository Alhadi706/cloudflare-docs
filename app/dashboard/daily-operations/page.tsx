'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import {
  Droplets, Activity, Gauge, Layers, BarChart3, FlaskConical,
  FileText, Save, Printer, ChevronDown, AlertTriangle,
  CheckCircle, TrendingUp, TrendingDown, Minus, RefreshCw,
} from 'lucide-react';
import {
  PUMP_STATION_CONFIG, EASTERN_CONFIG, CENTRAL_CONFIG,
  CONSUMPTION_AREAS, type PumpStationId, type EasternId, type CentralId,
} from './config';
import type { DailyFormData, PumpStationData, FlowControlData, TabId } from './types';

// ─── Helpers ────────────────────────────────────────────────
const n = (v: string) => parseFloat(v);
const fmt = (v: string, decimals = 0) => {
  const num = parseFloat(v);
  if (isNaN(num)) return '—';
  return num.toLocaleString('en', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtQ = (v: string) => fmt(v, 0) + ' م³';
const pressureStatus = (val: string, lo: number, hi: number): 'ok' | 'low' | 'high' | 'empty' => {
  const num = n(val);
  if (isNaN(num)) return 'empty';
  if (num < lo) return 'low';
  if (num > hi) return 'high';
  return 'ok';
};

// ─── Default State ────────────────────────────────────────────
const emptyPS = (): PumpStationData => ({
  dailyFlowPump: '', operatingPumps: '', outletPressure: '',
  forebayTankLevel: '', wellFieldDailyFlow: '', workingWells: '',
});
const emptyFC = (valveCount: number): FlowControlData => ({
  dailyFlow: '', valveOpenings: Array(valveCount).fill(''),
  outletPressure: '', inletPressure: '', level: '', operatingPumps: '',
});

const INITIAL_FORM: DailyFormData = {
  date: new Date().toISOString().split('T')[0],
  preparedBy: '',
  reviewedBy: '',
  pumpStations: {
    nejh_n: emptyPS(), nejh_s: emptyPS(), ejh: emptyPS(),
    fezzanLevel: '',
  },
  easternBranch: {
    ashShwayrifFCS: emptyFC(4),
    sidiSaiahFCS:   emptyFC(3),
    garabulliFT:    emptyFC(0),
    wadiTumallahFCS:emptyFC(3),
    airportFCV:     emptyFC(1),
  },
  centralBranch: {
    crossConnections:     emptyFC(3),
    sidiSiedRT:           emptyFC(0),
    tarhunah:             emptyFC(0),
    ashShwayrifCentral:   emptyFC(4),
  },
  waterQuality: { tdsActual: '', saltConcActual: '' },
  consumption: {},
  remarks: '',
};

// ─── Reusable UI Components ───────────────────────────────────
function Lbl({ children }: { children: React.ReactNode }) {
  return <span className="block text-xs text-gray-400 mb-0.5 leading-tight">{children}</span>;
}

function NumInput({
  value, onChange, unit, placeholder = '—', wide, warn, 
}: {
  value: string;
  onChange: (v: string) => void;
  unit?: string;
  placeholder?: string;
  wide?: boolean;
  warn?: 'ok' | 'low' | 'high' | 'empty';
}) {
  const borderCls =
    warn === 'high' ? 'border-red-500 text-red-300' :
    warn === 'low'  ? 'border-amber-400 text-amber-300' :
    warn === 'ok'   ? 'border-green-600 text-green-200' :
    'border-gray-600 text-white';
  return (
    <div className="flex items-center gap-1">
      <input
        type="number"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-gray-800 border rounded px-2 py-1 text-sm font-mono
          focus:outline-none focus:ring-1 focus:ring-blue-500
          ${wide ? 'w-28' : 'w-20'} ${borderCls}`}
      />
      {unit && <span className="text-xs text-gray-500 whitespace-nowrap">{unit}</span>}
    </div>
  );
}

function StatusDot({ status }: { status: 'ok' | 'low' | 'high' | 'empty' }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
      status === 'ok' ? 'bg-green-400' :
      status === 'low' ? 'bg-amber-400' :
      status === 'high' ? 'bg-red-400' : 'bg-gray-600'}`} />
  );
}

function SectionCard({ title, icon: Icon, children, badge }: {
  title: string; icon: React.ElementType; children: React.ReactNode; badge?: string;
}) {
  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gray-800/60 border-b border-gray-700">
        <Icon className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-semibold text-gray-100">{title}</span>
        {badge && (
          <span className="ml-auto text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function StatCard({ label, value, unit, sub, color = 'blue' }: {
  label: string; value: string | number; unit?: string; sub?: string; color?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'bg-blue-900/30 border-blue-800 text-blue-300',
    green: 'bg-green-900/30 border-green-800 text-green-300',
    amber: 'bg-amber-900/30 border-amber-800 text-amber-300',
    red: 'bg-red-900/30 border-red-800 text-red-300',
    purple: 'bg-purple-900/30 border-purple-800 text-purple-300',
  };
  return (
    <div className={`border rounded-lg p-3 ${colorMap[color] || colorMap.blue}`}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="text-2xl font-bold font-mono">{value}</p>
      {unit && <p className="text-xs mt-0.5 opacity-70">{unit}</p>}
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

// ─── Tab: Pump Stations ───────────────────────────────────────
function PumpStationsTab({ data, onChange }: {
  data: DailyFormData['pumpStations'];
  onChange: (d: DailyFormData['pumpStations']) => void;
}) {
  const setStation = (id: PumpStationId, field: keyof PumpStationData, val: string) =>
    onChange({ ...data, [id]: { ...data[id], [field]: val } });

  const totalProduction = PUMP_STATION_CONFIG.reduce((sum, cfg) => {
    const v = n(data[cfg.id].wellFieldDailyFlow);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الإنتاج" value={totalProduction > 0 ? totalProduction.toLocaleString('en') : '—'} unit="م³/يوم" color="green" />
        <StatCard label="منسوب خزان فزان" value={data.fezzanLevel || '—'} unit="متر" color="blue" />
        <StatCard label="NEJH – ضغط خروج" value={data.nejh_n.outletPressure || '—'} unit="bar"
          color={pressureStatus(data.nejh_n.outletPressure, 8.5, 10) === 'ok' ? 'green' : 'amber'} />
        <StatCard label="EJH – ضغط خروج" value={data.ejh.outletPressure || '—'} unit="bar"
          color={pressureStatus(data.ejh.outletPressure, 6.5, 7.5) === 'ok' ? 'green' : 'amber'} />
      </div>

      {/* Fezzan level */}
      <SectionCard title="خزان فزان" icon={Gauge}>
        <div className="flex items-center gap-4">
          <div>
            <Lbl>منسوب الخزان (م)</Lbl>
            <NumInput value={data.fezzanLevel}
              onChange={v => onChange({ ...data, fezzanLevel: v })} unit="م" />
          </div>
        </div>
      </SectionCard>

      {/* Per pump station */}
      {PUMP_STATION_CONFIG.map(cfg => {
        const st = data[cfg.id];
        const pStat = pressureStatus(st.outletPressure, cfg.warnPressureLow, cfg.warnPressureHigh);
        return (
          <SectionCard key={cfg.id} title={`${cfg.nameEn} – ${cfg.nameAr}`}
            icon={Activity}
            badge={`تصميم: ${cfg.designOutletPressure} bar`}>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <Lbl>الكمية اليومية (م³/يوم)</Lbl>
                <NumInput value={st.dailyFlowPump}
                  onChange={v => setStation(cfg.id, 'dailyFlowPump', v)} unit="م³" wide />
              </div>
              <div>
                <Lbl>عدد المضخات العاملة / {cfg.maxPumps}</Lbl>
                <NumInput value={st.operatingPumps}
                  onChange={v => setStation(cfg.id, 'operatingPumps', v)} />
              </div>
              <div>
                <Lbl>
                  <StatusDot status={pStat} />
                  ضغط الخروج (bar) — تصميم {cfg.designOutletPressure}
                </Lbl>
                <NumInput value={st.outletPressure}
                  onChange={v => setStation(cfg.id, 'outletPressure', v)}
                  unit="bar" warn={pStat} />
              </div>
              <div>
                <Lbl>منسوب خزان التوازن (م)</Lbl>
                <NumInput value={st.forebayTankLevel}
                  onChange={v => setStation(cfg.id, 'forebayTankLevel', v)} unit="م" />
              </div>
              <div>
                <Lbl>إنتاج حقل الآبار (م³/يوم)</Lbl>
                <NumInput value={st.wellFieldDailyFlow}
                  onChange={v => setStation(cfg.id, 'wellFieldDailyFlow', v)} unit="م³" wide />
              </div>
              <div>
                <Lbl>عدد الآبار العاملة</Lbl>
                <NumInput value={st.workingWells}
                  onChange={v => setStation(cfg.id, 'workingWells', v)} />
              </div>
            </div>
            {/* Efficiency indicator */}
            {st.outletPressure && !isNaN(n(st.outletPressure)) && (
              <div className="mt-3 pt-3 border-t border-gray-700/50">
                <div className="flex items-center gap-2">
                  {pStat === 'ok' && <CheckCircle className="w-4 h-4 text-green-400" />}
                  {pStat === 'high' && <TrendingUp className="w-4 h-4 text-red-400" />}
                  {pStat === 'low' && <TrendingDown className="w-4 h-4 text-amber-400" />}
                  <span className={`text-xs ${pStat === 'ok' ? 'text-green-400' : pStat === 'high' ? 'text-red-400' : 'text-amber-400'}`}>
                    {pStat === 'ok' && `ضغط الخروج ضمن النطاق التصميمي (${cfg.warnPressureLow}–${cfg.warnPressureHigh} bar)`}
                    {pStat === 'high' && `⚠ ضغط الخروج أعلى من الحد التصميمي ${cfg.warnPressureHigh} bar`}
                    {pStat === 'low' && `⚠ ضغط الخروج أدنى من الحد التصميمي ${cfg.warnPressureLow} bar`}
                  </span>
                  {st.operatingPumps && st.wellFieldDailyFlow && (
                    <span className="ml-auto text-xs text-gray-400">
                      متوسط إنتاج مضخة: {(n(st.wellFieldDailyFlow) / n(st.operatingPumps)).toFixed(0)} م³/مضخة
                    </span>
                  )}
                </div>
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

// ─── Tab: Branch (Eastern / Central) ─────────────────────────
function BranchTab<K extends string>({ config, data, onChange, branchNameAr }: {
  config: readonly { id: K; nameEn: string; nameAr: string; valveLabels: readonly string[];
    hasLevel: boolean; hasInletPressure: boolean; hasOutletPressure: boolean; hasPumps?: boolean;
    designInletPressure?: number; designOutletPressure?: number }[];
  data: Record<K, FlowControlData>;
  onChange: (d: Record<K, FlowControlData>) => void;
  branchNameAr: string;
}) {
  const setFC = (id: K, field: keyof FlowControlData, val: string) =>
    onChange({ ...data, [id]: { ...data[id], [field]: val } });
  const setValve = (id: K, idx: number, val: string) => {
    const prev = data[id].valveOpenings;
    const next = [...prev];
    next[idx] = val;
    onChange({ ...data, [id]: { ...data[id], valveOpenings: next } });
  };

  const totalFlow = config.reduce((sum, cfg) => {
    const v = n(data[cfg.id].dailyFlow);
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard label={`إجمالي كمية ${branchNameAr}`} value={totalFlow > 0 ? totalFlow.toLocaleString('en') : '—'} unit="م³/يوم" color="blue" />
      </div>

      {config.map(cfg => {
        const fc = data[cfg.id];
        const inPStat = cfg.hasInletPressure && cfg.designInletPressure
          ? pressureStatus(fc.inletPressure, cfg.designInletPressure * 0.85, cfg.designInletPressure * 1.15)
          : 'empty';
        return (
          <SectionCard key={cfg.id}
            title={`${cfg.nameEn} – ${cfg.nameAr}`}
            icon={Gauge}
            badge={cfg.designInletPressure ? `تصميم دخول: ${cfg.designInletPressure} bar` : undefined}>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
              {/* Daily flow */}
              <div>
                <Lbl>الكمية اليومية (م³/يوم)</Lbl>
                <NumInput value={fc.dailyFlow}
                  onChange={v => setFC(cfg.id, 'dailyFlow', v)} unit="م³" wide />
              </div>

              {/* Valve openings */}
              {cfg.valveLabels.length > 0 && (
                <div>
                  <Lbl>نسبة فتح الصمامات (%)</Lbl>
                  <div className="flex flex-wrap gap-1">
                    {cfg.valveLabels.map((lbl, idx) => (
                      <div key={idx} className="flex flex-col items-center">
                        <span className="text-xs text-gray-500 mb-0.5">{lbl}</span>
                        <NumInput value={fc.valveOpenings[idx] ?? ''}
                          onChange={v => setValve(cfg.id, idx, v)} />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Inlet pressure */}
              {cfg.hasInletPressure && (
                <div>
                  <Lbl><StatusDot status={inPStat} />ضغط الدخول (bar)</Lbl>
                  <NumInput value={fc.inletPressure}
                    onChange={v => setFC(cfg.id, 'inletPressure', v)}
                    unit="bar" warn={inPStat} />
                </div>
              )}

              {/* Outlet pressure */}
              {cfg.hasOutletPressure && (
                <div>
                  <Lbl>ضغط الخروج (bar)</Lbl>
                  <NumInput value={fc.outletPressure}
                    onChange={v => setFC(cfg.id, 'outletPressure', v)} unit="bar" />
                </div>
              )}

              {/* Level */}
              {cfg.hasLevel && (
                <div>
                  <Lbl>منسوب الخزان (م)</Lbl>
                  <NumInput value={fc.level}
                    onChange={v => setFC(cfg.id, 'level', v)} unit="م" />
                </div>
              )}

              {/* Pumps */}
              {cfg.hasPumps && (
                <div>
                  <Lbl>عدد المضخات العاملة</Lbl>
                  <NumInput value={fc.operatingPumps}
                    onChange={v => setFC(cfg.id, 'operatingPumps', v)} />
                </div>
              )}
            </div>

            {/* DP analysis */}
            {cfg.hasInletPressure && cfg.hasOutletPressure &&
             fc.inletPressure && fc.outletPressure && (
              <div className="mt-3 pt-3 border-t border-gray-700/50 text-xs text-gray-400 flex gap-4">
                <span>فرق الضغط (ΔP):
                  <strong className="text-blue-300 ml-1">
                    {(n(fc.inletPressure) - n(fc.outletPressure)).toFixed(2)} bar
                  </strong>
                </span>
                {cfg.designInletPressure && (
                  <span>الكفاءة الضغطية:
                    <strong className={`ml-1 ${inPStat === 'ok' ? 'text-green-400' : 'text-amber-400'}`}>
                      {((n(fc.inletPressure) / cfg.designInletPressure) * 100).toFixed(1)}%
                    </strong>
                  </span>
                )}
              </div>
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

// ─── Tab: Consumption ────────────────────────────────────────
function ConsumptionTab({ data, onChange }: {
  data: Record<string, string>;
  onChange: (d: Record<string, string>) => void;
}) {
  const totalDesign = CONSUMPTION_AREAS.reduce((s, a) => s + a.designQty, 0);
  const totalActual = CONSUMPTION_AREAS.reduce((s, a) => {
    const v = n(data[a.id] ?? '');
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const coverage = totalDesign > 0 ? (totalActual / totalDesign * 100).toFixed(1) : '—';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي التصميم" value={totalDesign.toLocaleString('en')} unit="م³/يوم" color="blue" />
        <StatCard label="إجمالي الفعلي" value={totalActual > 0 ? totalActual.toLocaleString('en') : '—'} unit="م³/يوم" color="green" />
        <StatCard label="نسبة التغطية" value={`${coverage}%`} unit="" color={parseFloat(coverage) > 90 ? 'green' : 'amber'} />
        <StatCard label="الفرق" value={totalActual > 0 ? (totalActual - totalDesign).toLocaleString('en') : '—'} unit="م³/يوم"
          color={totalActual - totalDesign < 0 ? 'red' : 'green'} />
      </div>

      <SectionCard title="كميات الاستهلاك اليومي" icon={BarChart3}>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {CONSUMPTION_AREAS.map(area => {
            const actual = n(data[area.id] ?? '');
            const pct = isNaN(actual) ? null : actual / area.designQty;
            const barWidth = pct ? Math.min(pct * 100, 120) : 0;
            const barColor = pct === null ? 'bg-gray-700' : pct > 1.05 ? 'bg-red-500' : pct > 0.8 ? 'bg-green-500' : 'bg-amber-500';
            return (
              <div key={area.id} className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                <div className="flex items-start justify-between mb-2">
                  <span className="text-sm text-gray-200">{area.nameAr}</span>
                  <span className="text-xs text-gray-500">تصميم: {area.designQty.toLocaleString('en')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <NumInput
                    value={data[area.id] ?? ''}
                    onChange={v => onChange({ ...data, [area.id]: v })}
                    unit="م³" wide
                  />
                  {pct !== null && (
                    <span className={`text-xs ml-auto ${pct > 1.05 ? 'text-red-400' : pct > 0.8 ? 'text-green-400' : 'text-amber-400'}`}>
                      {(pct * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
                <div className="mt-2 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${barColor}`}
                    style={{ width: `${barWidth}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab: Water Quality ───────────────────────────────────────
function WaterQualityTab({ data, onChange }: {
  data: DailyFormData['waterQuality'];
  onChange: (d: DailyFormData['waterQuality']) => void;
}) {
  const tdsDesign = 1097; // from screenshots
  const tdsActual = n(data.tdsActual);
  const tdsOk = !isNaN(tdsActual) && tdsActual <= tdsDesign * 1.05;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="TDS الفعلي" value={data.tdsActual || '—'} unit="ملجم/لتر"
          color={tdsOk ? 'green' : 'red'} />
        <StatCard label="TDS المعياري" value={tdsDesign.toString()} unit="ملجم/لتر" color="blue" />
        <StatCard label="جودة التوصيل الكهربائي" value={data.saltConcActual || '—'} unit="μS/cm" color="purple" />
      </div>

      <SectionCard title="قسم مراقبة جودة المياه – Water Quality Control Dept." icon={FlaskConical}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 border-b border-gray-700 pb-2">تركيز الأملاح (TDS)</h4>
            <div>
              <Lbl>القراءة الفعلية (ملجم/لتر)</Lbl>
              <NumInput value={data.tdsActual}
                onChange={v => onChange({ ...data, tdsActual: v })} unit="ملجم/لتر" wide
                warn={!isNaN(tdsActual) ? (tdsOk ? 'ok' : 'high') : 'empty'} />
              {!isNaN(tdsActual) && (
                <p className={`text-xs mt-1 ${tdsOk ? 'text-green-400' : 'text-red-400'}`}>
                  {tdsOk ? '✓ ضمن الحد المعياري' : `⚠ تجاوز الحد المعياري ${tdsDesign} ملجم/لتر`}
                </p>
              )}
            </div>
            <div>
              <Lbl>القيمة الحسابية (تعبأ تلقائياً)</Lbl>
              <div className="text-sm font-mono text-blue-300 bg-gray-800 px-3 py-2 rounded border border-gray-700">
                {tdsDesign} ملجم/لتر
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-gray-300 border-b border-gray-700 pb-2">تركيز الأملاح (التوصيل الكهربائي)</h4>
            <div>
              <Lbl>القيمة الفعلية (μS/cm أو قراءة)</Lbl>
              <NumInput value={data.saltConcActual}
                onChange={v => onChange({ ...data, saltConcActual: v })} unit="μS/cm" wide />
            </div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Tab: Schematic (SVG Network Overview) ───────────────────
function SchematicTab({ data }: { data: DailyFormData }) {
  const nejhN = data.pumpStations.nejh_n;
  const nejhS = data.pumpStations.nejh_s;
  const ejh   = data.pumpStations.ejh;
  const east  = data.easternBranch;
  const cent  = data.centralBranch;

  const totalProd = PUMP_STATION_CONFIG.reduce((s, c) => {
    const v = n(data.pumpStations[c.id].wellFieldDailyFlow);
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  // Mini station box
  const Station = ({ x, y, name, pressure, flow, pumps, designP }: {
    x: number; y: number; name: string; pressure: string; flow: string; pumps: string; designP: number;
  }) => {
    const pNum = parseFloat(pressure);
    const isHigh = !isNaN(pNum) && pNum > designP * 1.1;
    const isLow  = !isNaN(pNum) && pNum < designP * 0.9;
    const color  = isHigh ? '#ef4444' : isLow ? '#f59e0b' : '#22c55e';
    const bg     = isHigh ? '#450a0a' : isLow ? '#451a03' : '#052e16';
    const strokeC= isHigh ? '#dc2626' : isLow ? '#d97706' : '#16a34a';

    return (
      <g>
        {/* Station box */}
        <rect x={x} y={y} width={130} height={80} rx={6} fill={bg} stroke={strokeC} strokeWidth={1.5} />
        <text x={x + 65} y={y + 14} textAnchor="middle" fill="#e5e7eb" fontSize={9} fontWeight="bold">{name}</text>
        <line x1={x + 8} y1={y + 20} x2={x + 122} y2={y + 20} stroke={strokeC} strokeWidth={0.5} opacity={0.4} />

        {/* Pressure */}
        <text x={x + 8} y={y + 34} fill="#9ca3af" fontSize={8}>ضغط الخروج</text>
        <text x={x + 122} y={y + 34} textAnchor="end" fill={color} fontSize={11} fontWeight="bold">
          {pressure || 'n/av'} bar
        </text>

        {/* Flow */}
        <text x={x + 8} y={y + 48} fill="#9ca3af" fontSize={8}>الإنتاج</text>
        <text x={x + 122} y={y + 48} textAnchor="end" fill="#60a5fa" fontSize={9}>
          {flow ? parseInt(flow).toLocaleString('en') : 'n/av'} م³
        </text>

        {/* Pumps */}
        <text x={x + 8} y={y + 62} fill="#9ca3af" fontSize={8}>مضخات عاملة</text>
        <text x={x + 122} y={y + 62} textAnchor="end" fill="#a78bfa" fontSize={9}>
          {pumps || '—'}
        </text>

        {/* Design reference line */}
        <text x={x + 8} y={y + 75} fill="#4b5563" fontSize={7}>تصميم: {designP} bar</text>
      </g>
    );
  };

  // Flow control station mini box
  const FCSBox = ({ x, y, name, flow, inP, outP, w = 110, h = 60 }: {
    x: number; y: number; name: string; flow: string; inP?: string; outP?: string; w?: number; h?: number;
  }) => (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={4} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} />
      <text x={x + w / 2} y={y + 13} textAnchor="middle" fill="#93c5fd" fontSize={8} fontWeight="bold">{name}</text>
      <line x1={x + 5} y1={y + 17} x2={x + w - 5} y2={y + 17} stroke="#3b82f6" strokeWidth={0.4} opacity={0.5} />
      <text x={x + 5} y={y + 29} fill="#9ca3af" fontSize={7}>كمية:</text>
      <text x={x + w - 5} y={y + 29} textAnchor="end" fill="#60a5fa" fontSize={9}>
        {flow ? parseInt(flow).toLocaleString('en') : 'n/av'}
      </text>
      {inP && (
        <>
          <text x={x + 5} y={y + 42} fill="#9ca3af" fontSize={7}>دخول:</text>
          <text x={x + w - 5} y={y + 42} textAnchor="end" fill="#34d399" fontSize={9}>{inP} bar</text>
        </>
      )}
      {outP && (
        <>
          <text x={x + 5} y={y + 55} fill="#9ca3af" fontSize={7}>خروج:</text>
          <text x={x + w - 5} y={y + 55} textAnchor="end" fill="#f59e0b" fontSize={9}>{outP} bar</text>
        </>
      )}
    </g>
  );

  const Arrow = ({ x1, y1, x2, y2, color = '#4b5563', dashed }: {
    x1: number; y1: number; x2: number; y2: number; color?: string; dashed?: boolean;
  }) => (
    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2}
      strokeDasharray={dashed ? '4,3' : undefined}
      markerEnd="url(#arrowhead)" />
  );

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="إجمالي الإنتاج" value={totalProd > 0 ? totalProd.toLocaleString('en') : '—'} unit="م³/يوم" color="green" />
        <StatCard label="ضغط NEJH(n)" value={nejhN.outletPressure || '—'} unit="bar" color="blue" />
        <StatCard label="ضغط NEJH(s)" value={nejhS.outletPressure || '—'} unit="bar" color="blue" />
        <StatCard label="ضغط EJH" value={ejh.outletPressure || '—'} unit="bar" color="blue" />
        <StatCard label="منسوب فزان" value={data.pumpStations.fezzanLevel || '—'} unit="م" color="purple" />
      </div>

      {/* SVG Schematic */}
      <div className="bg-gray-950 border border-gray-700 rounded-xl p-4 overflow-x-auto">
        <p className="text-xs text-gray-500 mb-3 text-center">
          التقرير اليومي لوضعية تشغيل المنظومة — منظومة سهل الجفارة
        </p>
        <svg viewBox="0 0 1060 480" className="w-full min-w-[800px]" style={{ height: 480 }}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
              <polygon points="0 0, 8 3, 0 6" fill="#4b5563" />
            </marker>
          </defs>

          {/* Background grid */}
          <rect width="1060" height="480" fill="#030712" rx="8" />

          {/* Title */}
          <text x="530" y="22" textAnchor="middle" fill="#6b7280" fontSize={10}>
            التقرير اليومي لوضعية تشغيل المنظومة – {data.date}
          </text>

          {/* ── PUMP STATIONS (left column) ── */}
          <text x="85" y="52" textAnchor="middle" fill="#6b7280" fontSize={9} fontStyle="italic">
            محطات الضخ وحقول الآبار
          </text>

          <Station x={20} y={60}  name="NEJH(n)" pressure={nejhN.outletPressure}
            flow={nejhN.wellFieldDailyFlow} pumps={nejhN.operatingPumps} designP={9.1} />
          <Station x={20} y={175} name="NEJH(s)" pressure={nejhS.outletPressure}
            flow={nejhS.wellFieldDailyFlow} pumps={nejhS.operatingPumps} designP={6.9} />
          <Station x={20} y={290} name="EJH" pressure={ejh.outletPressure}
            flow={ejh.wellFieldDailyFlow} pumps={ejh.operatingPumps} designP={6.9} />

          {/* ── MAIN TRANSMISSION LINE ── */}
          {/* Connection arrows from stations to main line */}
          <line x1={150} y1={100} x2={200} y2={230} stroke="#374151" strokeWidth={2} />
          <line x1={150} y1={215} x2={200} y2={230} stroke="#374151" strokeWidth={2} />
          <line x1={150} y1={330} x2={200} y2={250} stroke="#374151" strokeWidth={2} />

          {/* Main horizontal pipeline */}
          <line x1={200} y1={240} x2={860} y2={240} stroke="#1d4ed8" strokeWidth={4} />
          <text x={530} y={235} textAnchor="middle" fill="#3b82f6" fontSize={8}>الخط الرئيسي للنقل</text>

          {/* PM circles on main line */}
          {[280, 400, 530, 660, 790].map(px => (
            <g key={px}>
              <circle cx={px} cy={240} r={10} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1.5} />
              <text x={px} y={244} textAnchor="middle" fill="#93c5fd" fontSize={7}>PM</text>
            </g>
          ))}

          {/* ── EASTERN BRANCH (top) ── */}
          <text x={480} y={58} textAnchor="middle" fill="#6b7280" fontSize={9} fontStyle="italic">الفرع الشرقي</text>
          {/* Branch takeoff */}
          <line x1={400} y1={230} x2={400} y2={80} stroke="#0f766e" strokeWidth={2} strokeDasharray="3,2" />

          <FCSBox x={220} y={60} name="Ash Shwayrif FCS" w={120}
            flow={east.ashShwayrifFCS.dailyFlow} inP={east.ashShwayrifFCS.inletPressure} h={65} />
          <FCSBox x={360} y={60} name="Sidi Saiah FCS" w={115}
            flow={east.sidiSaiahFCS.dailyFlow} inP={east.sidiSaiahFCS.inletPressure}
            outP={east.sidiSaiahFCS.outletPressure} h={65} />
          <FCSBox x={495} y={60} name="Garabulli R.T" w={105}
            flow={east.garabulliFT.dailyFlow} h={55} />
          <FCSBox x={615} y={60} name="Wadi Tumallah" w={115}
            flow={east.wadiTumallahFCS.dailyFlow} inP={east.wadiTumallahFCS.inletPressure} h={60} />
          <FCSBox x={745} y={60} name="Airport FCV" w={100}
            flow={east.airportFCV.dailyFlow} inP={east.airportFCV.inletPressure} h={55} />

          {/* Eastern branch connecting line */}
          <line x1={220} y1={92} x2={220} y2={92} stroke="#0f766e" strokeWidth={1} />
          <line x1={220} y1={92} x2={845} y2={92} stroke="#0f766e" strokeWidth={1.5} />

          {/* ── CENTRAL BRANCH (bottom) ── */}
          <text x={530} y={330} textAnchor="middle" fill="#6b7280" fontSize={9} fontStyle="italic">الفرع الأوسطى</text>
          {/* Branch takeoff */}
          <line x1={530} y1={250} x2={530} y2={345} stroke="#7c3aed" strokeWidth={2} strokeDasharray="3,2" />

          <FCSBox x={220} y={345} name="Cross Conn. FCV" w={120}
            flow={cent.crossConnections.dailyFlow} inP={cent.crossConnections.inletPressure}
            outP={cent.crossConnections.outletPressure} h={65} />
          <FCSBox x={360} y={345} name="Sidi Sied R.T" w={105}
            flow={cent.sidiSiedRT.dailyFlow} h={55} />
          <FCSBox x={480} y={345} name="Tarhunah R.T" w={115}
            flow={cent.tarhunah.dailyFlow} outP={cent.tarhunah.outletPressure} h={60} />
          <FCSBox x={615} y={345} name="Ash Shwayrif (C)" w={125}
            flow={cent.ashShwayrifCentral.dailyFlow} inP={cent.ashShwayrifCentral.inletPressure} h={60} />

          {/* Central branch connecting line */}
          <line x1={220} y1={372} x2={740} y2={372} stroke="#7c3aed" strokeWidth={1.5} />

          {/* ── FEZZAN TANK (right) ── */}
          <rect x={880} y={200} width={150} height={90} rx={6} fill="#1c1917" stroke="#a16207" strokeWidth={1.5} />
          <text x={955} y={220} textAnchor="middle" fill="#fbbf24" fontSize={9} fontWeight="bold">خزان فزان</text>
          <line x1={888} y1={226} x2={1022} y2={226} stroke="#a16207" strokeWidth={0.5} opacity={0.4} />
          <text x={888} y={242} fill="#9ca3af" fontSize={8}>المنسوب:</text>
          <text x={1022} y={242} textAnchor="end" fill="#fcd34d" fontSize={12} fontWeight="bold">
            {data.pumpStations.fezzanLevel || 'n/av'} م
          </text>
          <text x={888} y={270} fill="#9ca3af" fontSize={7}>ملاحظة: يتم إدخال المنسوب يومياً</text>

          {/* Connection to Fezzan */}
          <line x1={860} y1={240} x2={880} y2={240} stroke="#1d4ed8" strokeWidth={4} />

          {/* Legend */}
          <rect x={20} y={415} width={600} height={50} rx={4} fill="#111827" opacity={0.8} />
          <text x={30} y={430} fill="#6b7280" fontSize={8}>المفتاح:</text>
          <circle cx={75} cy={428} r={5} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} />
          <text x={82} y={431} fill="#9ca3af" fontSize={7}>PM = قياس الضغط</text>
          <line x1={160} y1={428} x2={190} y2={428} stroke="#1d4ed8" strokeWidth={3} />
          <text x={195} y={431} fill="#9ca3af" fontSize={7}>خط نقل رئيسي</text>
          <line x1={280} y1={428} x2={310} y2={428} stroke="#0f766e" strokeWidth={2} strokeDasharray="3,2" />
          <text x={315} y={431} fill="#9ca3af" fontSize={7}>فرع شرقي</text>
          <line x1={390} y1={428} x2={420} y2={428} stroke="#7c3aed" strokeWidth={2} strokeDasharray="3,2" />
          <text x={425} y={431} fill="#9ca3af" fontSize={7}>فرع أوسطى</text>

          <text x={30} y={455} fill="#6b7280" fontSize={8}>ملاحظات:</text>
          <text x={85} y={455} fill="#4b5563" fontSize={7}>
            القيم باللون الأخضر ضمن النطاق التصميمي ◆ الأصفر = تنبيه ◆ الأحمر = تجاوز الحد
          </text>
        </svg>
      </div>

      {/* Quick status table */}
      <SectionCard title="حالة المحطات الرئيسية" icon={Activity}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-gray-500 border-b border-gray-700">
                <th className="text-right py-2 pr-2 font-medium">المحطة</th>
                <th className="text-center py-2 font-medium">الكمية (م³/يوم)</th>
                <th className="text-center py-2 font-medium">ضغط الدخول</th>
                <th className="text-center py-2 font-medium">ضغط الخروج</th>
                <th className="text-center py-2 font-medium">الحالة</th>
              </tr>
            </thead>
            <tbody>
              {PUMP_STATION_CONFIG.map(cfg => {
                const st = data.pumpStations[cfg.id];
                const pStat = pressureStatus(st.outletPressure, cfg.warnPressureLow, cfg.warnPressureHigh);
                return (
                  <tr key={cfg.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="py-2 pr-2 text-gray-200">{cfg.nameEn} – {cfg.nameAr}</td>
                    <td className="text-center font-mono text-blue-300">{fmtQ(st.wellFieldDailyFlow)}</td>
                    <td className="text-center text-gray-400">—</td>
                    <td className="text-center font-mono">{fmt(st.outletPressure, 1)} bar</td>
                    <td className="text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        pStat === 'ok' ? 'bg-green-900/50 text-green-300' :
                        pStat === 'high' ? 'bg-red-900/50 text-red-300' :
                        pStat === 'low' ? 'bg-amber-900/50 text-amber-300' :
                        'bg-gray-800 text-gray-500'}`}>
                        {pStat === 'ok' ? '✓ طبيعي' : pStat === 'high' ? '↑ مرتفع' : pStat === 'low' ? '↓ منخفض' : 'لم يُدخل'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────
const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'schematic',      label: 'وضعية التشغيل',     icon: Activity },
  { id: 'pump_stations',  label: 'محطات الضخ',         icon: Gauge },
  { id: 'eastern_branch', label: 'الفرع الشرقي',      icon: TrendingUp },
  { id: 'central_branch', label: 'الفرع الأوسطى',     icon: Layers },
  { id: 'consumption',    label: 'الاستهلاك',          icon: BarChart3 },
  { id: 'water_quality',  label: 'جودة المياه',        icon: FlaskConical },
  { id: 'remarks',        label: 'ملاحظات',            icon: FileText },
];

export default function DailyOperationsPage() {
  const [form, setForm] = useState<DailyFormData>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('daily_ops_form');
        if (saved) return JSON.parse(saved) as DailyFormData;
      } catch { /* ignore */ }
    }
    return INITIAL_FORM;
  });

  const [activeTab, setActiveTab] = useState<TabId>('schematic');
  const [saved, setSaved] = useState(false);
  const autoSaveRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-save to localStorage
  useEffect(() => {
    if (autoSaveRef.current) clearTimeout(autoSaveRef.current);
    autoSaveRef.current = setTimeout(() => {
      try { localStorage.setItem('daily_ops_form', JSON.stringify(form)); } catch { /* ignore */ }
    }, 800);
    return () => { if (autoSaveRef.current) clearTimeout(autoSaveRef.current); };
  }, [form]);

  const handleSave = useCallback(() => {
    try { localStorage.setItem('daily_ops_form', JSON.stringify(form)); } catch { /* ignore */ }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }, [form]);

  const handleReset = useCallback(() => {
    if (confirm('هل تريد مسح جميع البيانات والبدء من جديد؟')) {
      setForm({ ...INITIAL_FORM, date: new Date().toISOString().split('T')[0] });
    }
  }, []);

  const handlePrint = () => window.print();

  const setPS = useCallback((d: DailyFormData['pumpStations']) =>
    setForm(f => ({ ...f, pumpStations: d })), []);

  const setEast = useCallback((d: DailyFormData['easternBranch']) =>
    setForm(f => ({ ...f, easternBranch: d })), []);

  const setCent = useCallback((d: DailyFormData['centralBranch']) =>
    setForm(f => ({ ...f, centralBranch: d })), []);

  const setConsumption = useCallback((d: Record<string, string>) =>
    setForm(f => ({ ...f, consumption: d })), []);

  const setWQ = useCallback((d: DailyFormData['waterQuality']) =>
    setForm(f => ({ ...f, waterQuality: d })), []);

  // Calculate totals for header
  const totalProd = PUMP_STATION_CONFIG.reduce((s, c) => {
    const v = n(form.pumpStations[c.id].wellFieldDailyFlow);
    return s + (isNaN(v) ? 0 : v);
  }, 0);
  const totalCons = CONSUMPTION_AREAS.reduce((s, a) => {
    const v = n(form.consumption[a.id] ?? '');
    return s + (isNaN(v) ? 0 : v);
  }, 0);

  return (
    <div className="min-h-screen bg-gray-950 text-white" dir="rtl">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 py-3 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-900/50 border border-blue-700 flex items-center justify-center">
                <Droplets className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h1 className="text-base font-bold text-white leading-tight">
                  التقرير اليومي لوضعية تشغيل المنظومة
                </h1>
                <p className="text-xs text-gray-400">منظومة سهل الجفارة – إدارة الصيانة والتشغيل</p>
              </div>
            </div>

            {/* Meta inputs */}
            <div className="flex flex-wrap items-center gap-2 mr-auto">
              <input type="date" value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none" />
              <input type="text" value={form.preparedBy} placeholder="إعداد"
                onChange={e => setForm(f => ({ ...f, preparedBy: e.target.value }))}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white w-28 focus:outline-none" />
              <input type="text" value={form.reviewedBy} placeholder="مراجعة"
                onChange={e => setForm(f => ({ ...f, reviewedBy: e.target.value }))}
                className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm text-white w-28 focus:outline-none" />
            </div>

            {/* Summary chips */}
            <div className="flex items-center gap-2 text-xs">
              <span className="bg-green-900/40 border border-green-800 text-green-300 px-2 py-1 rounded">
                إنتاج: {totalProd > 0 ? totalProd.toLocaleString('en') : '—'} م³
              </span>
              <span className="bg-blue-900/40 border border-blue-800 text-blue-300 px-2 py-1 rounded">
                استهلاك: {totalCons > 0 ? totalCons.toLocaleString('en') : '—'} م³
              </span>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button onClick={handleSave}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-all
                  ${saved ? 'bg-green-800 text-green-200' : 'bg-blue-800 hover:bg-blue-700 text-white'}`}>
                {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {saved ? 'تم الحفظ' : 'حفظ'}
              </button>
              <button onClick={handlePrint}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 text-white">
                <Printer className="w-4 h-4" /> طباعة
              </button>
              <button onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm bg-gray-800 hover:bg-gray-700 text-gray-400">
                <RefreshCw className="w-4 h-4" /> تفريغ
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-gray-900 border-b border-gray-700 px-4 print:hidden">
        <div className="max-w-7xl mx-auto">
          <div className="flex overflow-x-auto gap-0">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-3 text-sm whitespace-nowrap border-b-2 transition-colors
                    ${activeTab === tab.id
                      ? 'border-blue-500 text-blue-300 bg-blue-900/10'
                      : 'border-transparent text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}>
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 py-5">
        {activeTab === 'schematic' && (
          <SchematicTab data={form} />
        )}
        {activeTab === 'pump_stations' && (
          <PumpStationsTab data={form.pumpStations} onChange={setPS} />
        )}
        {activeTab === 'eastern_branch' && (
          <BranchTab
            config={EASTERN_CONFIG}
            data={form.easternBranch as Record<EasternId, FlowControlData>}
            onChange={d => setEast(d as DailyFormData['easternBranch'])}
            branchNameAr="الفرع الشرقي"
          />
        )}
        {activeTab === 'central_branch' && (
          <BranchTab
            config={CENTRAL_CONFIG}
            data={form.centralBranch as Record<CentralId, FlowControlData>}
            onChange={d => setCent(d as DailyFormData['centralBranch'])}
            branchNameAr="الفرع الأوسطى"
          />
        )}
        {activeTab === 'consumption' && (
          <ConsumptionTab data={form.consumption} onChange={setConsumption} />
        )}
        {activeTab === 'water_quality' && (
          <WaterQualityTab data={form.waterQuality} onChange={setWQ} />
        )}
        {activeTab === 'remarks' && (
          <SectionCard title="ملاحظات التشغيل" icon={FileText}>
            <div className="space-y-3">
              <p className="text-xs text-gray-500">
                1– نظراً لتوجيه أعطال بأجهزة قياس مُعدّات التدفق وقُدرات التدفق المحطات التدفق فإن كميات الاستهلاك تُحسب وفق الفرق التقنية.
              </p>
              <p className="text-xs text-gray-500">
                2– الاستهلاك = (الإنتاج ± الفرق بالمنسوب بخزان فزان).
              </p>
              <p className="text-xs text-gray-500">
                3– استمرار تخفيض التدفق في المسار الشرقي لأجل إعمال الصيانة للمحطة (500–707) والتغذية تتم من المسار الأوسط.
              </p>
              <textarea
                value={form.remarks}
                onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
                placeholder="أضف ملاحظات إضافية..."
                rows={6}
                className="w-full bg-gray-800 border border-gray-600 rounded p-3 text-sm text-white focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
              />
            </div>
          </SectionCard>
        )}
      </div>

      {/* Print view */}
      <div className="hidden print:block p-8 text-black bg-white">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">التقرير اليومي لوضعية تشغيل المنظومة</h2>
          <p className="text-sm text-gray-600">منظومة سهل الجفارة – {form.date}</p>
          <div className="flex justify-between mt-2 text-sm">
            <span>إعداد: {form.preparedBy}</span>
            <span>مراجعة: {form.reviewedBy}</span>
          </div>
        </div>
        <table className="w-full border-collapse text-xs mt-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-right">المحطة</th>
              <th className="border p-2">الإنتاج م³/يوم</th>
              <th className="border p-2">عدد المضخات</th>
              <th className="border p-2">ضغط الخروج (bar)</th>
              <th className="border p-2">منسوب التوازن (م)</th>
            </tr>
          </thead>
          <tbody>
            {PUMP_STATION_CONFIG.map(cfg => (
              <tr key={cfg.id}>
                <td className="border p-2 font-medium">{cfg.nameEn} – {cfg.nameAr}</td>
                <td className="border p-2 text-center font-mono">
                  {form.pumpStations[cfg.id].wellFieldDailyFlow || '—'}
                </td>
                <td className="border p-2 text-center">{form.pumpStations[cfg.id].operatingPumps || '—'}</td>
                <td className="border p-2 text-center font-mono">{form.pumpStations[cfg.id].outletPressure || '—'}</td>
                <td className="border p-2 text-center">{form.pumpStations[cfg.id].forebayTankLevel || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {form.remarks && (
          <div className="mt-4">
            <h3 className="font-semibold">ملاحظات:</h3>
            <p className="text-sm mt-1">{form.remarks}</p>
          </div>
        )}
      </div>
    </div>
  );
}
