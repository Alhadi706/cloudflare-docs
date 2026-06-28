'use client';

import React, { useState } from 'react';
import { ChevronDown, Calculator, Zap, Gauge, Clock } from 'lucide-react';
import {
  calculatePotentialShift,
  calculateIrDropCompensation,
  calculateCorrosionRateFaraday,
  calculateRemainingLife,
  PotentialShiftResult,
  IrDropResult,
  CorrosionRateResult,
  RemainingLifeResult,
} from '@/lib/engineering/corrosion-calculations';

export function AdvancedEngineeringModule() {
  const [expandedSection, setExpandedSection] = useState<string | null>('potential');
  const [results, setResults] = useState<{
    potential?: PotentialShiftResult;
    irDrop?: IrDropResult;
    corrosion?: CorrosionRateResult;
    remainingLife?: RemainingLifeResult;
  }>({});

  // ── Section 1: Potential Shift ──────────────────────────────────────
  const [potentialInputs, setPotentialInputs] = useState({
    nativeVoltage: -600,
    polarizedVoltage: -900,
  });

  const handlePotentialCalc = () => {
    const result = calculatePotentialShift({
      nativeVoltage: potentialInputs.nativeVoltage,
      polarizedVoltage: potentialInputs.polarizedVoltage,
    });
    setResults((prev) => ({ ...prev, potential: result }));
  };

  // ── Section 2: IR Drop ──────────────────────────────────────────────
  const [irDropInputs, setIrDropInputs] = useState({
    measuredVoltage: -750,
    appliedCurrent: 50,
    soilResistance: 2000,
    measurementDistance: 5,
  });

  const handleIrDropCalc = () => {
    const result = calculateIrDropCompensation({
      measuredVoltage: irDropInputs.measuredVoltage,
      appliedCurrent: irDropInputs.appliedCurrent,
      soilResistance: irDropInputs.soilResistance,
      measurementDistance: irDropInputs.measurementDistance,
    });
    setResults((prev) => ({ ...prev, irDrop: result }));
  };

  // ── Section 3: Corrosion Rate ──────────────────────────────────────
  const [corrosionInputs, setCorrosionInputs] = useState({
    method: 'faraday' as 'faraday' | 'tafel',
    corrosionCurrent: 8,
    metalDensity: 7.85,
    atomicWeight: 55.85,
  });

  const handleCorrosionCalc = () => {
    const result = calculateCorrosionRateFaraday({
      method: corrosionInputs.method,
      corrosionCurrent: corrosionInputs.corrosionCurrent,
      metalDensity: corrosionInputs.metalDensity,
      atomicWeight: corrosionInputs.atomicWeight,
    });
    setResults((prev) => ({ ...prev, corrosion: result }));
  };

  // ── Section 4: Remaining Life ──────────────────────────────────────
  const [remainingLifeInputs, setRemainingLifeInputs] = useState({
    originalWallThickness: 12.7,
    currentWallThickness: 10.5,
    corrosionRate: 0.25,
    minAllowableThickness: 4.0,
    operatingPressure: 80,
    pipelineYieldStrength: 450,
    defectType: 'general' as 'general' | 'localized' | 'pit',
  });

  const handleRemainingLifeCalc = () => {
    const result = calculateRemainingLife({
      originalWallThickness: remainingLifeInputs.originalWallThickness,
      currentWallThickness: remainingLifeInputs.currentWallThickness,
      corrosionRate: remainingLifeInputs.corrosionRate,
      minAllowableThickness: remainingLifeInputs.minAllowableThickness,
      operatingPressure: remainingLifeInputs.operatingPressure,
      pipelineYieldStrength: remainingLifeInputs.pipelineYieldStrength,
      defectType: remainingLifeInputs.defectType,
    });
    setResults((prev) => ({ ...prev, remainingLife: result }));
  };

  return (
    <div className="space-y-4 p-4 bg-slate-900 rounded-lg border border-slate-700" dir="rtl">
      <div className="flex items-center gap-2 mb-6">
        <Calculator className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-slate-100">وحدة الحسابات الهندسية المتقدمة</h2>
        <span className="text-xs bg-blue-600 px-2 py-1 rounded text-white">Tier-1 Engineering</span>
      </div>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SECTION 1: POTENTIAL SHIFT CALCULATOR */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'potential' ? null : 'potential')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-yellow-400" />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-slate-100">حاسبة الإزاحة الكهروكيميائية</h3>
              <p className="text-xs text-slate-400">Potential Shift Calculator</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${expandedSection === 'potential' ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedSection === 'potential' && (
          <div className="p-4 border-t border-slate-700 space-y-4 bg-slate-850">
            <p className="text-sm text-slate-300">
              حساب الفرق بين الجهد الطبيعي والمستقطب لتقييم فعالية نظام الحماية الكاثودية وفق معيار
              NACE SP0169
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الجهد الطبيعي (Native Voltage) - mV
                </label>
                <input
                  type="number"
                  value={potentialInputs.nativeVoltage}
                  onChange={(e) =>
                    setPotentialInputs((prev) => ({
                      ...prev,
                      nativeVoltage: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الجهد المستقطب (Polarized) - mV
                </label>
                <input
                  type="number"
                  value={potentialInputs.polarizedVoltage}
                  onChange={(e) =>
                    setPotentialInputs((prev) => ({
                      ...prev,
                      polarizedVoltage: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handlePotentialCalc}
              className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2 rounded transition-colors"
            >
              حساب الإزاحة
            </button>

            {results.potential && (
              <div className="mt-4 p-3 bg-slate-700 rounded border border-slate-600">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">إزاحة الجهد</p>
                    <p className="text-xl font-bold text-blue-300">
                      {results.potential.potentialShift.toFixed(2)} mV
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">النسبة المئوية</p>
                    <p className="text-xl font-bold text-blue-300">
                      {results.potential.shiftPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">التصنيف</p>
                    <p
                      className={`text-lg font-bold ${
                        results.potential.classification === 'PROTECTED'
                          ? 'text-green-400'
                          : results.potential.classification === 'MARGINAL'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                    >
                      {results.potential.classification === 'PROTECTED'
                        ? '✅ حماية كاملة'
                        : results.potential.classification === 'MARGINAL'
                          ? '⚠️ حماية هامشية'
                          : '❌ لا توجد حماية'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">التوضيح</p>
                    <p className="text-slate-200">{results.potential.explanation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SECTION 2: IR DROP COMPENSATION */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'irDrop' ? null : 'irDrop')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Gauge className="w-5 h-5 text-cyan-400" />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-slate-100">تصحيح هبوط الجهد</h3>
              <p className="text-xs text-slate-400">IR Drop Compensation</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${expandedSection === 'irDrop' ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedSection === 'irDrop' && (
          <div className="p-4 border-t border-slate-700 space-y-4 bg-slate-850">
            <p className="text-sm text-slate-300">
              حساب القراءة الحقيقية لجهد سطح المعدن بناءً على مقاومة التربة والتيار المطبوع
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الجهد المقاس - mV
                </label>
                <input
                  type="number"
                  value={irDropInputs.measuredVoltage}
                  onChange={(e) =>
                    setIrDropInputs((prev) => ({
                      ...prev,
                      measuredVoltage: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  التيار المطبوع - mA
                </label>
                <input
                  type="number"
                  value={irDropInputs.appliedCurrent}
                  onChange={(e) =>
                    setIrDropInputs((prev) => ({
                      ...prev,
                      appliedCurrent: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  مقاومة التربة - Ω·cm
                </label>
                <input
                  type="number"
                  value={irDropInputs.soilResistance}
                  onChange={(e) =>
                    setIrDropInputs((prev) => ({
                      ...prev,
                      soilResistance: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  مسافة القياس - m
                </label>
                <input
                  type="number"
                  value={irDropInputs.measurementDistance}
                  onChange={(e) =>
                    setIrDropInputs((prev) => ({
                      ...prev,
                      measurementDistance: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleIrDropCalc}
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-2 rounded transition-colors"
            >
              حساب التصحيح
            </button>

            {results.irDrop && (
              <div className="mt-4 p-3 bg-slate-700 rounded border border-slate-600 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">هبوط الجهد المقدر</p>
                    <p className="text-xl font-bold text-cyan-300">
                      {results.irDrop.irDropEstimated.toFixed(2)} mV
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">الجهد الحقيقي للمعدن</p>
                    <p className="text-xl font-bold text-cyan-300">
                      {results.irDrop.trueMetalVoltage.toFixed(2)} mV
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">الموثوقية</p>
                    <p
                      className={`text-sm font-semibold ${
                        results.irDrop.reliability === 'high'
                          ? 'text-green-400'
                          : results.irDrop.reliability === 'medium'
                            ? 'text-yellow-400'
                            : 'text-red-400'
                      }`}
                    >
                      {results.irDrop.reliability === 'high'
                        ? '✅ عالية'
                        : results.irDrop.reliability === 'medium'
                          ? '⚠️ متوسطة'
                          : '❌ منخفضة'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">التوصية</p>
                    <p className="text-slate-200 text-sm">{results.irDrop.recommendation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SECTION 3: CORROSION RATE */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() => setExpandedSection(expandedSection === 'corrosion' ? null : 'corrosion')}
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Zap className="w-5 h-5 text-orange-400" />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-slate-100">تقدير معدل التآكل</h3>
              <p className="text-xs text-slate-400">Corrosion Rate Estimation</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${expandedSection === 'corrosion' ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedSection === 'corrosion' && (
          <div className="p-4 border-t border-slate-700 space-y-4 bg-slate-850">
            <p className="text-sm text-slate-300">
              حساب معدل التآكل بناءً على قانون فاراداي أو استقراء Tafel لتحويل قراءات الجهد والتيار
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  كثافة التيار - μA/cm²
                </label>
                <input
                  type="number"
                  value={corrosionInputs.corrosionCurrent}
                  onChange={(e) =>
                    setCorrosionInputs((prev) => ({
                      ...prev,
                      corrosionCurrent: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  كثافة المعدن - g/cm³
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={corrosionInputs.metalDensity}
                  onChange={(e) =>
                    setCorrosionInputs((prev) => ({
                      ...prev,
                      metalDensity: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الوزن الذري - g/mol
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={corrosionInputs.atomicWeight}
                  onChange={(e) =>
                    setCorrosionInputs((prev) => ({
                      ...prev,
                      atomicWeight: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleCorrosionCalc}
              className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold py-2 rounded transition-colors"
            >
              حساب معدل التآكل
            </button>

            {results.corrosion && (
              <div className="mt-4 p-3 bg-slate-700 rounded border border-slate-600 space-y-2">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">معدل التآكل</p>
                    <p className="text-xl font-bold text-orange-300">
                      {results.corrosion.corrosionRateMmYear.toFixed(4)} mm/year
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">بوحدة mpy</p>
                    <p className="text-xl font-bold text-orange-300">
                      {results.corrosion.corrosionRateMpy.toFixed(4)} mpy
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">في 3 سنوات</p>
                    <p className="text-lg font-bold text-orange-300">
                      {results.corrosion.mmYear3Years.toFixed(3)} mm
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">في 10 سنوات</p>
                    <p className="text-lg font-bold text-orange-300">
                      {results.corrosion.mmYear10Years.toFixed(3)} mm
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">الشدة</p>
                    <p
                      className={`text-lg font-bold ${
                        results.corrosion.severity === 'CRITICAL'
                          ? 'text-red-400'
                          : results.corrosion.severity === 'HIGH'
                            ? 'text-orange-400'
                            : results.corrosion.severity === 'MODERATE'
                              ? 'text-yellow-400'
                              : 'text-green-400'
                      }`}
                    >
                      {results.corrosion.severity}
                    </p>
                  </div>
                  {results.corrosion.timeToFailure && (
                    <div className="col-span-2">
                      <p className="text-slate-400">العمر المتبقي (حتى 6mm)</p>
                      <p className="text-lg font-bold text-blue-300">
                        {results.corrosion.timeToFailure.toFixed(2)} سنة
                      </p>
                    </div>
                  )}
                  <div className="col-span-2">
                    <p className="text-slate-400">التوصية</p>
                    <p className="text-slate-200 text-sm">{results.corrosion.recommendation}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ────────────────────────────────────────────────────────────── */}
      {/* SECTION 4: REMAINING LIFE */}
      {/* ────────────────────────────────────────────────────────────── */}
      <section className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
        <button
          onClick={() =>
            setExpandedSection(expandedSection === 'remainingLife' ? null : 'remainingLife')
          }
          className="w-full p-4 flex items-center justify-between hover:bg-slate-700 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Clock className="w-5 h-5 text-purple-400" />
            <div className="text-right">
              <h3 className="text-lg font-semibold text-slate-100">تحليل العمر المتبقي</h3>
              <p className="text-xs text-slate-400">ASME B31G Remaining Life</p>
            </div>
          </div>
          <ChevronDown
            className={`w-5 h-5 transition-transform ${expandedSection === 'remainingLife' ? 'rotate-180' : ''}`}
          />
        </button>

        {expandedSection === 'remainingLife' && (
          <div className="p-4 border-t border-slate-700 space-y-4 bg-slate-850">
            <p className="text-sm text-slate-300">
              تقييم العمر المتبقي للخط بناءً على معايير ASME B31G وحالة التآكل
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  السمك الأصلي - mm
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={remainingLifeInputs.originalWallThickness}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      originalWallThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  السمك الحالي - mm
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={remainingLifeInputs.currentWallThickness}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      currentWallThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  معدل التآكل - mm/year
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={remainingLifeInputs.corrosionRate}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      corrosionRate: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الحد الأدنى المسموح - mm
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={remainingLifeInputs.minAllowableThickness}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      minAllowableThickness: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  الضغط التشغيلي - bar
                </label>
                <input
                  type="number"
                  value={remainingLifeInputs.operatingPressure}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      operatingPressure: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  حد الخضوع - MPa
                </label>
                <input
                  type="number"
                  value={remainingLifeInputs.pipelineYieldStrength}
                  onChange={(e) =>
                    setRemainingLifeInputs((prev) => ({
                      ...prev,
                      pipelineYieldStrength: parseFloat(e.target.value),
                    }))
                  }
                  className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded text-slate-100 text-sm"
                />
              </div>
            </div>

            <button
              onClick={handleRemainingLifeCalc}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 rounded transition-colors"
            >
              حساب العمر المتبقي
            </button>

            {results.remainingLife && (
              <div className="mt-4 p-3 bg-slate-700 rounded border border-slate-600 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-slate-400">فقدان السمك</p>
                    <p className="text-xl font-bold text-purple-300">
                      {results.remainingLife.wallLoss.toFixed(2)} mm
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">النسبة المئوية</p>
                    <p className="text-xl font-bold text-purple-300">
                      {results.remainingLife.wallLossPercentage.toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">معامل الأمان</p>
                    <p className="text-xl font-bold text-purple-300">
                      {results.remainingLife.safetyFactor.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-400">السنوات المتبقية</p>
                    <p className="text-xl font-bold text-purple-300">
                      {results.remainingLife.estimatedYearsRemaining.toFixed(2)} سنة
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">درجة الحرجية</p>
                    <p
                      className={`text-lg font-bold ${
                        results.remainingLife.criticality === 'IMMEDIATE'
                          ? 'text-red-400'
                          : results.remainingLife.criticality === 'HIGH'
                            ? 'text-orange-400'
                            : results.remainingLife.criticality === 'MEDIUM'
                              ? 'text-yellow-400'
                              : 'text-green-400'
                      }`}
                    >
                      {results.remainingLife.criticality === 'IMMEDIATE'
                        ? '🚨 فوري'
                        : results.remainingLife.criticality === 'HIGH'
                          ? '⚠️ عالي'
                          : results.remainingLife.criticality === 'MEDIUM'
                            ? '📋 متوسط'
                            : '✅ منخفض'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">توافق ASME B31G</p>
                    <p
                      className={`text-sm font-semibold ${results.remainingLife.asmeB31gCompliance ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {results.remainingLife.asmeB31gCompliance ? '✅ متوافق' : '❌ غير متوافق'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400">جدول الفحص القادم</p>
                    <p className="text-lg font-bold text-blue-300">
                      {results.remainingLife.nextInspectionSchedule}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-slate-400 mb-2">الإجراءات الموصى بها</p>
                    <ul className="space-y-1">
                      {results.remainingLife.recommendedActions.map((action, idx) => (
                        <li key={idx} className="text-slate-200 text-sm">
                          • {action}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
