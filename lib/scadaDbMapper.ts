/**
 * scadaDbMapper.ts
 * Converts flat station readings (from /api/control-center/live-status)
 * into the nested engine format expected by SCADAMimicView.
 *
 * Station IDs match ctrl.stations: NEJHN, NEJHS, EJH, FEZZAN,
 * TARH, SIDSD, ABUA, PS1, PS2, ABUZY, SHWRM, AIRP, SISAI, QRBL, WADI, SHWRE
 */

export interface DBStation {
  id: string;
  name_ar: string;
  flow_m3_day?: number;
  pressure_bar?: number;
  pumps_running?: number;
  pumps_total?: number;
  tank_level_pct?: number;
}

/** Convert a 0-100 percentage to meters given a tank max level */
const pctToM = (pct: number | undefined | null, maxM: number): number | null =>
  pct != null ? (pct / 100) * maxM : null;

/** Build a well-field pump group reading */
function wellField(s: DBStation | null, tankMaxM = 10) {
  if (!s) return {};
  return {
    operatingPumps:       s.pumps_running   ?? null,
    wellFieldDailyFlow:   s.flow_m3_day     ?? null,
    outletPressure:       s.pressure_bar    ?? null,
    forebayTankLevel:     pctToM(s.tank_level_pct, tankMaxM),
    workingWells:         null,
  };
}

export interface EngineOutput {
  filename: string;
  sheetName: string;
  readings: Record<string, unknown>[];
}

export interface MappedEngines {
  e1: EngineOutput | null;
  e2: EngineOutput | null;
  e3: EngineOutput | null;
  e4: EngineOutput | null;
  totalProduction: number;
  totalConsumption?: number;
}

export function dbStationsToEngines(stations: DBStation[]): MappedEngines {
  const get = (id: string): DBStation | null =>
    stations.find(s => s.id === id) ?? null;

  const total = stations.reduce((s, st) => s + (st.flow_m3_day ?? 0), 0);

  /* ── Engine 1: Well Fields (حقول الآبار) ────────────────────────────────── */
  const fezzan = get('FEZZAN');
  const r1 = {
    nejhN:           wellField(get('NEJHN'), 10),
    nejhS:           wellField(get('NEJHS'), 10),
    ejh:             wellField(get('EJH'),   10),
    fezzanTankLevel: pctToM(fezzan?.tank_level_pct, 12),
  };

  /* ── Engine 2: Eastern Branch (الفرع الشرقي) ────────────────────────────── */
  const airp  = get('AIRP');
  const sisai = get('SISAI');
  const qrbl  = get('QRBL');
  const wadi  = get('WADI');
  const shwrm = get('SHWRM');
  const shwre = get('SHWRE');
  const r2 = {
    airport: airp ? {
      dailyFlow:      airp.flow_m3_day  ?? null,
      inletPressure:  null,
      outletPressure: airp.pressure_bar ?? null,
    } : {},
    sidiSaiah: sisai ? {
      dailyFlow: sisai.flow_m3_day ?? null,
      rtLevel:   pctToM(sisai.tank_level_pct, 15),
    } : {},
    garabulli: qrbl ? {
      dailyFlow: qrbl.flow_m3_day ?? null,
      rtLevel:   pctToM(qrbl.tank_level_pct, 15),
    } : {},
    wadiTumallah: wadi ? {
      dailyFlow: wadi.flow_m3_day ?? null,
      rtLevel:   pctToM(wadi.tank_level_pct, 15),
    } : {},
    ashShwayrifRtLevel: pctToM((shwrm ?? shwre)?.tank_level_pct, 15),
    ashShwayrifFcs: {
      dailyFlow: (shwrm ?? shwre)?.flow_m3_day ?? null,
    },
  };

  /* ── Engine 3: Central Branch (الخط الأوسط) ─────────────────────────────── */
  const tarh  = get('TARH');
  const sidsd = get('SIDSD');
  const r3 = {
    crossConnections: {
      totalFlow:      (tarh?.flow_m3_day ?? 0) + (sidsd?.flow_m3_day ?? 0) || null,
      inletPressure:  null,
      outletPressure: null,
    },
    sidiSied: sidsd ? {
      level:     pctToM(sidsd.tank_level_pct, 15),
      totalFlow: sidsd.flow_m3_day ?? null,
    } : {},
    tarhunah: tarh ? {
      level:           pctToM(tarh.tank_level_pct, 15),
      totalFlow:       tarh.flow_m3_day ?? null,
      noPumps:         tarh.pumps_running ?? null,
      outletPressure:  tarh.pressure_bar ?? null,
    } : {},
  };

  /* ── Engine 4: TAZ ────────────────────────────────────────────────────────── */
  const ps1   = get('PS1');
  const ps2   = get('PS2');
  const abuzy = get('ABUZY');
  const r4 = {
    ps1: ps1 ? {
      activePumpNo:         ps1.pumps_running ?? null,
      inletPressure:        null,
      outletPressure:       ps1.pressure_bar  ?? null,
      pumpingVolume:        ps1.flow_m3_day   ?? null,
      totalOperationHours:  null,
    } : {},
    ps2: ps2 ? {
      activePumpNo:         ps2.pumps_running ?? null,
      inletPressure:        null,
      outletPressure:       ps2.pressure_bar  ?? null,
      pumpingToTank:        ps2.flow_m3_day   ?? null,
      totalOperationHours:  null,
    } : {},
    tankLevel: abuzy ? {
      /* Single station → map to cellA; B-E stay null until dedicated stations added */
      cellA: pctToM(abuzy.tank_level_pct, 15),
      cellB: null, cellC: null, cellD: null, cellE: null,
    } : {},
    gharyanConsumption: null,
  };

  const makeEng = (r: Record<string, unknown>, name: string): EngineOutput => ({
    filename: 'live_db',
    sheetName: name,
    readings: [r],
  });

  return {
    e1: makeEng(r1, 'حقول الآبار'),
    e2: makeEng(r2, 'الفرع الشرقي'),
    e3: makeEng(r3, 'الخط الأوسط'),
    e4: makeEng(r4, 'TAZ'),
    totalProduction:  total,
    totalConsumption: undefined,
  };
}
