// ─────────────────────────────────────────────────────────────
// Daily Operations Report – Type Definitions
// التقرير اليومي لوضعية تشغيل منظومة سهل الجفارة
// ─────────────────────────────────────────────────────────────

export interface PumpStationData {
  dailyFlowPump: string;      // m³/day – إنتاج المضخة اليومي
  operatingPumps: string;     // عدد المضخات العاملة
  outletPressure: string;     // bar – ضغط الخروج
  forebayTankLevel: string;   // m – منسوب خزان التوازن
  wellFieldDailyFlow: string; // m³/day – إنتاج حقل الآبار
  workingWells: string;       // عدد الآبار العاملة
}

export interface FlowControlData {
  dailyFlow: string;           // m³/day – الكمية اليومية
  valveOpenings: string[];     // % – نسبة فتح كل صمام
  outletPressure: string;      // bar – ضغط الخروج
  inletPressure: string;       // bar – ضغط الدخول
  level: string;               // m – المنسوب (للخزانات)
  operatingPumps: string;      // عدد المضخات (للمحطات الضخ)
}

export interface DailyFormData {
  date: string;          // YYYY-MM-DD
  preparedBy: string;
  reviewedBy: string;

  // ─── محطات الضخ وحقول الآبار
  pumpStations: {
    nejh_n: PumpStationData;
    nejh_s: PumpStationData;
    ejh: PumpStationData;
    fezzanLevel: string; // m
  };

  // ─── الفرع الشرقي
  easternBranch: {
    ashShwayrifFCS: FlowControlData; // 4 valve positions
    sidiSaiahFCS: FlowControlData;   // 3 valve positions
    garabulliFT: FlowControlData;    // tank only
    wadiTumallahFCS: FlowControlData;// 3 valve positions
    airportFCV: FlowControlData;     // 1 valve position
  };

  // ─── الفرع الأوسطى
  centralBranch: {
    crossConnections: FlowControlData;    // 3 valve positions
    sidiSiedRT: FlowControlData;         // tank only
    tarhunah: FlowControlData;           // tank + pumps
    ashShwayrifCentral: FlowControlData; // 4 valve positions
  };

  // ─── جودة المياه
  waterQuality: {
    tdsActual: string;       // ملجم/لتر
    saltConcActual: string;  // جهد التوصيل الكهربائي
  };

  // ─── الاستهلاك: areaId → m³
  consumption: Record<string, string>;

  remarks: string;
}

export type TabId =
  | 'schematic'
  | 'pump_stations'
  | 'eastern_branch'
  | 'central_branch'
  | 'consumption'
  | 'water_quality'
  | 'remarks';
