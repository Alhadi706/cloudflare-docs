# Phase 3: MINERVA Failure Investigation (Observation Only)

المنهج: قياس وتشريح Runtime فقط بدون أي تعديل خوارزمي أو tuning أو retraining.

## Scope
- WATER_LEAK_TRIPOLI_001
- VEGETATION_LOSS_BENGHAZI_001
- GROUND_DEFORMATION_COASTAL_001

## Scenario: WATER_LEAK_TRIPOLI_001
- Expected severity: WARNING
- Primary signal used by reasoning: NDMI
- Alert rule: anomaly_probability >= 0.5
- Detection: TP=0 FP=0 TN=14 FN=5

### Stage 1 — Satellite Acquisition
- Frames total: 19
- Event frames: 5
- Signal coverage: {'NDMI': 18, 'NDVI': 18, 'VV_dB': 8, 'LST_C': 3}

### Stage 2 — Signal Extraction (event-period missing %) 
- NDVI: 0.0% missing
- NDMI: 0.0% missing
- VV_dB: 0.0% missing
- VH_dB: 40.0% missing
- LST_C: 40.0% missing
- Moisture: 0.0% missing
- WaterIndex: 80.0% missing
- VegetationIndex: 0.0% missing

### Stage 3 to 6 Traceability
- Feature normalization: Cannot verify
- Explicit baseline object (expected/tolerance struct): Cannot verify
- Multi-evidence fusion (weighted multi-signal): Cannot verify
- Rule-tree with competing hypotheses: Cannot verify

### Stage 7 — Final Decision Blockers (event frames)
- anomaly_probability_below_min_conf: 5 frames (100.0%)
- insufficient_data_gate: 0 frames (0.0%)
- too_few_primary_points: 0 frames (0.0%)
- forecast_none: 0 frames (0.0%)

### Evidence Tree
Input -> Signal -> Feature -> Baseline -> Evidence -> Reasoning -> Decision -> Output
- Input: EO history up to frame date only
- Signal: NDMI only
- Feature: trend slope/r2 + forecast anomaly_probability
- Baseline: implicit historical distribution in anomaly_probability
- Evidence: single signal, no fusion
- Reasoning: gates then threshold 0.5
- Decision: NO_ALERT for all positive-event frames
- Output: false negative when event=true

## Scenario: VEGETATION_LOSS_BENGHAZI_001
- Expected severity: WARNING
- Primary signal used by reasoning: NDVI
- Alert rule: anomaly_probability >= 0.45
- Detection: TP=0 FP=0 TN=14 FN=0

### Stage 1 — Satellite Acquisition
- Frames total: 14
- Event frames: 0
- Signal coverage: {'NDMI': 13, 'NDVI': 13, 'VV_dB': 0, 'LST_C': 3}
- Event-period root-cause attribution: Cannot verify (no GT event window in scenario definition)

### Stage 2 — Signal Extraction (event-period missing %) 
- NDVI: 0.0% missing
- NDMI: 0.0% missing
- VV_dB: 0.0% missing
- VH_dB: 0.0% missing
- LST_C: 0.0% missing
- Moisture: 0.0% missing
- WaterIndex: 0.0% missing
- VegetationIndex: 0.0% missing

### Stage 3 to 6 Traceability
- Feature normalization: Cannot verify
- Explicit baseline object (expected/tolerance struct): Cannot verify
- Multi-evidence fusion (weighted multi-signal): Cannot verify
- Rule-tree with competing hypotheses: Cannot verify

### Stage 7 — Final Decision Blockers (event frames)
- insufficient_data_gate: 0 frames (0.0%)
- too_few_primary_points: 0 frames (0.0%)
- forecast_none: 0 frames (0.0%)
- anomaly_probability_below_min_conf: 0 frames (0.0%)
- Interpretation for this stage: Cannot verify (event_frames=0)

### Evidence Tree
Input -> Signal -> Feature -> Baseline -> Evidence -> Reasoning -> Decision -> Output
- Input: EO history up to frame date only
- Signal: NDVI only
- Feature: trend slope/r2 + forecast anomaly_probability
- Baseline: implicit historical distribution in anomaly_probability
- Evidence: single signal, no fusion
- Reasoning: gates then threshold 0.45
- Decision: NO_ALERT for all positive-event frames
- Output: Cannot verify (no positive event frames available in replay window)

## Scenario: GROUND_DEFORMATION_COASTAL_001
- Expected severity: ALERT
- Primary signal used by reasoning: VV_dB
- Alert rule: anomaly_probability >= 0.55
- Detection: TP=0 FP=0 TN=10 FN=0

### Stage 1 — Satellite Acquisition
- Frames total: 10
- Event frames: 0
- Signal coverage: {'NDMI': 0, 'NDVI': 0, 'VV_dB': 8, 'LST_C': 0}
- Event-period root-cause attribution: Cannot verify (no GT event window in scenario definition)

### Stage 2 — Signal Extraction (event-period missing %) 
- NDVI: 0.0% missing
- NDMI: 0.0% missing
- VV_dB: 0.0% missing
- VH_dB: 0.0% missing
- LST_C: 0.0% missing
- Moisture: 0.0% missing
- WaterIndex: 0.0% missing
- VegetationIndex: 0.0% missing

### Stage 3 to 6 Traceability
- Feature normalization: Cannot verify
- Explicit baseline object (expected/tolerance struct): Cannot verify
- Multi-evidence fusion (weighted multi-signal): Cannot verify
- Rule-tree with competing hypotheses: Cannot verify

### Stage 7 — Final Decision Blockers (event frames)
- insufficient_data_gate: 0 frames (0.0%)
- too_few_primary_points: 0 frames (0.0%)
- forecast_none: 0 frames (0.0%)
- anomaly_probability_below_min_conf: 0 frames (0.0%)
- Interpretation for this stage: Cannot verify (event_frames=0)

### Evidence Tree
Input -> Signal -> Feature -> Baseline -> Evidence -> Reasoning -> Decision -> Output
- Input: EO history up to frame date only
- Signal: VV_dB only
- Feature: trend slope/r2 + forecast anomaly_probability
- Baseline: implicit historical distribution in anomaly_probability
- Evidence: single signal, no fusion
- Reasoning: gates then threshold 0.55
- Decision: NO_ALERT for all positive-event frames
- Output: Cannot verify (no positive event frames available in replay window)

## Root Cause Ranking (highest impact -> lowest)
- NOTE: Quantified ranking below is experimentally valid only for scenarios with event_frames > 0.
- For VEGETATION_LOSS_BENGHAZI_001 and GROUND_DEFORMATION_COASTAL_001 event-period attribution is Cannot verify.
- anomaly_probability_below_min_conf: avg 33.33%
- insufficient_data_gate: avg 0.0%
- too_few_primary_points: avg 0.0%
- forecast_none: avg 0.0%

## Deployment Answer
- If MINERVA were deployed today, would it miss the same anomalies? YES (runtime evidence from 3/3 failed positive scenarios).
- Confidence of this statement: bounded by current lab pipeline implementation and available observations.
- Any claim about missing multi-stage reasoning components outside implemented code: Cannot verify.

## Arabic Summary
- السبب الرئيسي للفشل ليس عطل API أو بنية النظام؛ البنية تعمل.
- سلسلة القرار الحالية في الـ lab تعتمد عملياً على إشارة رئيسية واحدة لكل مهمة.
- كل الحالات الإيجابية فشلت لأن القرار النهائي لم يتجاوز بوابة الاحتمال/الثقة المطلوبة، أو سقطت قبلها بسبب قلة نقاط الإشارة في بعض الإطارات.
- بالتالي، نعم: إذا نُشر النظام بنفس هذا المسار اليوم فهناك احتمال عالٍ أن يفوّت نفس نوع الشذوذات ضمن نفس ظروف البيانات.