# SYSTEM CAPABILITY VALIDATION PLAN

Date: 2026-07-16
Scope: Government-readiness operational validation plan only (no implementation, no test execution).
Evidence rule: Any capability that cannot be proven from repository/runtime evidence must be marked exactly as: Cannot verify.

## 1) Monitoring Projects
- Service name: Project Intelligence Center (PIC) Monitoring
- Data type: Real satellite archive scenes + derived intelligence
- Required test data: Ground-truth project registry (project polygons, start/end dates, contractor logs), dated satellite scenes, verified event logs
- Test steps: (1) Select stratified sample of projects by type/region, (2) run project analysis window, (3) compare produced timeline/events vs audited field logs, (4) compute per-project and aggregate metrics
- Accuracy calculation: Event agreement rate = matched events / audited events; timeline date error in days
- Performance indicators: Accuracy, Precision, Recall (for event detection)
- Minimum acceptable threshold (government): Event Precision >= 0.90, Event Recall >= 0.85, median timeline date error <= 7 days
- Files/APIs used: lib/pic/analyzer.ts, lib/picDB.ts, app/api/v1/pic/projects/[id]/route.ts, app/api/v1/pic/dashboard/route.ts
- Current verifiability: Can verify

## 2) Construction Progress
- Service name: PIC Construction Progress Estimation
- Data type: Real scenes + model-derived estimate
- Required test data: Certified progress statements (monthly), site inspection photos with date/geotag, satellite scenes aligned to statement periods
- Test steps: (1) Run progress inference for each period, (2) compare reported progress_pct to certified progress, (3) analyze by project type
- Accuracy calculation: MAE = mean absolute error between inferred progress and certified progress
- Performance indicators: MAE, RMSE, bias
- Minimum acceptable threshold (government): MAE <= 10 percentage points, RMSE <= 12
- Files/APIs used: lib/pic/analyzer.ts, lib/reasoning/engine.ts, app/api/v1/pic/projects/[id]/route.ts
- Current verifiability: Can verify

## 3) Construction Stoppage Detection
- Service name: PIC Work Stoppage Detection
- Data type: Real scenes + rule-based/event inference
- Required test data: Official stoppage/resumption records, labor/equipment logs, weather interruption logs
- Test steps: (1) Run detection across known stoppage windows, (2) compare start/end stoppage dates, (3) evaluate false stoppage alarms
- Accuracy calculation: Stoppage F1 from TP/FP/FN; duration error = absolute day difference
- Performance indicators: Precision, Recall, F1
- Minimum acceptable threshold (government): F1 >= 0.88, median duration error <= 5 days
- Files/APIs used: lib/pic/analyzer.ts (detectEvents), app/api/v1/pic/projects/[id]/route.ts
- Current verifiability: Can verify

## 4) Change Detection
- Service name: GIS/Satellite Change Detection
- Data type: Mixed (real and fallback/estimated depending endpoint/source)
- Required test data: Curated before/after scene pairs, manually labeled change masks, cloud quality metadata
- Test steps: (1) Run change endpoint per AOI pair, (2) compare mask/object outputs to labeled truth, (3) separate real-source runs from fallback runs
- Accuracy calculation: IoU/F1 on changed pixels or polygons; object-level precision/recall where applicable
- Performance indicators: Accuracy, Precision, Recall, IoU
- Minimum acceptable threshold (government): Real-source IoU >= 0.75 and F1 >= 0.85; fallback outputs must be tagged non-decisive
- Files/APIs used: app/api/gis/[...slug]/route.ts, app/api/v1/satellite/scene-search/route.ts, lib/stac.ts
- Current verifiability: Can verify

## 5) New Buildings Detection
- Service name: Building Emergence Detection
- Data type: Mixed (real where high-resolution source available; otherwise estimated/limited)
- Required test data: Municipal building permit datasets, cadastral updates, high-resolution reference imagery, AOI labels
- Test steps: (1) Run building detection by period, (2) validate new-object candidates against permits and reference imagery, (3) classify true new buildings vs false positives
- Accuracy calculation: Object-level Precision/Recall/F1 for new buildings only
- Performance indicators: Precision, Recall
- Minimum acceptable threshold (government): Precision >= 0.90, Recall >= 0.80 for real high-resolution mode
- Files/APIs used: app/api/gis/[...slug]/route.ts (class_status/buildings note), app/api/v1/satellite/planet-detect/route.ts, app/api/v1/satellite/tile-detect/route.ts
- Current verifiability: Can verify

## 6) Road Monitoring
- Service name: Corridor and Pipeline Route Monitoring
- Data type: Mixed (real routing/terrain when providers available, fallback when unavailable)
- Required test data: Official road/corridor alignments, known obstruction incidents, DEM references
- Test steps: (1) Execute corridor/route analysis on known segments, (2) compare obstruction and path quality outputs against official records, (3) benchmark fallback vs provider-enabled runs
- Accuracy calculation: Detection accuracy for known incidents; route deviation error (meters/km)
- Performance indicators: Accuracy, Precision, Recall (for incidents)
- Minimum acceptable threshold (government): Incident Recall >= 0.85, route deviation <= 5% vs approved engineering path
- Files/APIs used: app/api/v1/satellite/corridor-monitor/route.ts, app/api/v1/satellite/pipeline-routes/route.ts, app/api/gis/[...slug]/route.ts
- Current verifiability: Can verify

## 7) Water Leak Detection
- Service name: Multi-evidence Water Leak Detector
- Data type: Real satellite indicators + contextual/fallback signals
- Required test data: Verified leak tickets with coordinates/timestamps, pressure telemetry, repair completion logs, weather history
- Test steps: (1) Run leak detector on historical leak windows and control windows, (2) compare hotspot outputs to confirmed leak points, (3) evaluate alert lead time
- Accuracy calculation: Spatial hit rate within radius R; Precision/Recall on confirmed leaks
- Performance indicators: Precision, Recall, lead-time (hours/days)
- Minimum acceptable threshold (government): Precision >= 0.88, Recall >= 0.85, median lead-time >= 24h before field confirmation
- Files/APIs used: app/api/v1/satellite/leak-detector/route.ts, app/api/v1/satellite/urban-leak-detector/route.ts, app/api/v1/satellite/water-anomaly-scanner/route.ts
- Current verifiability: Can verify

## 8) Oil Leak Detection
- Service name: Spill/Oil Leak Monitoring
- Data type: Real when source data available; otherwise cannot conclude
- Required test data: Confirmed spill incidents, shoreline/industrial polygons, cleanup logs, incident timestamps
- Test steps: (1) Replay known spill intervals, (2) evaluate detection outputs against incident catalog, (3) test non-incident periods for false alarms
- Accuracy calculation: Incident detection Precision/Recall; false alarm rate per month
- Performance indicators: Precision, Recall
- Minimum acceptable threshold (government): Precision >= 0.90, Recall >= 0.80, false alarm rate <= 2/month per monitored region
- Files/APIs used: app/api/v1/satellite/spill-monitor/route.ts, app/api/v1/satellite/gas-monitor/route.ts
- Current verifiability: Can verify

## 9) Ground Subsidence (InSAR)
- Service name: InSAR Subsidence Analysis
- Data type: Real SAR-driven when credentials/data available; unavailable otherwise
- Required test data: Ground benchmark measurements (GNSS/leveling), known subsidence zones, Sentinel-1 acquisition stack
- Test steps: (1) Run InSAR analysis over benchmark zones, (2) compare displacement rates with ground benchmarks, (3) evaluate temporal trend agreement
- Accuracy calculation: RMSE of displacement (mm/year) vs benchmark
- Performance indicators: RMSE, correlation coefficient
- Minimum acceptable threshold (government): RMSE <= 5 mm/year, correlation >= 0.80
- Files/APIs used: app/api/v1/satellite/insar-subsidence/route.ts
- Current verifiability: Can verify

## 10) Vegetation Monitoring
- Service name: Vegetation Change Monitoring
- Data type: Real index-based where spectral source available
- Required test data: Agricultural/vegetation survey plots, seasonal reference baselines, cloud-screened scenes
- Test steps: (1) Run NDVI/related monitoring by season, (2) compare trend classes to survey outcomes, (3) test drought and irrigation periods separately
- Accuracy calculation: Class agreement rate and Precision/Recall per vegetation state class
- Performance indicators: Accuracy, Precision, Recall
- Minimum acceptable threshold (government): Overall accuracy >= 0.85, class Recall >= 0.80
- Files/APIs used: app/api/v1/satellite/water-anomaly-scanner/route.ts, app/api/v1/satellite/multi-source/route.ts, lib/sentinel-hub.ts
- Current verifiability: Can verify

## 11) Flood Detection
- Service name: Flood/Water Expansion Detection
- Data type: Mixed (real indices when source available; estimated otherwise)
- Required test data: Historical flood extents (authoritative), gauge data, event timestamps, precipitation records
- Test steps: (1) Run flood detection on known events and dry controls, (2) compare predicted extents with authoritative flood maps, (3) quantify omission/commission errors
- Accuracy calculation: IoU with reference flood polygons; event detection recall
- Performance indicators: IoU, Recall
- Minimum acceptable threshold (government): IoU >= 0.70, event Recall >= 0.85
- Files/APIs used: app/api/v1/satellite/water-anomaly-scanner/route.ts, app/api/gis/[...slug]/route.ts
- Current verifiability: Can verify

## 12) Fire Detection
- Service name: Active Fire Detection and Archive
- Data type: Real (FIRMS/VIIRS/MODIS integration)
- Required test data: Civil defense fire incident logs, FIRMS reference feed snapshots, geocoded incident confirmations
- Test steps: (1) Run fire monitor and archive replay for same windows, (2) compare detections to incident logs, (3) evaluate latency and geolocation error
- Accuracy calculation: Precision/Recall on confirmed incidents; location error distance
- Performance indicators: Precision, Recall, detection latency
- Minimum acceptable threshold (government): Precision >= 0.92, Recall >= 0.88, median latency <= 3 hours
- Files/APIs used: app/api/v1/satellite/fire-monitor/route.ts, app/api/v1/satellite/fire-archive/route.ts, app/api/v1/satellite/fire-history/route.ts
- Current verifiability: Can verify

## 13) Thermal Analysis
- Service name: Thermal Monitoring
- Data type: Real thermal/surface indicators when provider paths available
- Required test data: Ground thermal sensor points, known hotspot assets, meteorological normalization data
- Test steps: (1) Execute thermal analysis over benchmark points, (2) compare detected anomalies with sensor records, (3) evaluate seasonally normalized thresholds
- Accuracy calculation: Hotspot classification Precision/Recall; temperature error vs sensors
- Performance indicators: Precision, Recall, MAE
- Minimum acceptable threshold (government): Precision >= 0.88, Recall >= 0.82, MAE <= 2.0 C on benchmark points
- Files/APIs used: app/api/v1/satellite/thermal-monitor/route.ts, app/api/v1/satellite/gas-monitor/route.ts
- Current verifiability: Can verify

## 14) Anomaly Detection
- Service name: Multi-signal Anomaly Detection
- Data type: Mixed by source and capability
- Required test data: Labeled anomaly incident dataset (true anomalies + normal controls), sensor corroboration where available
- Test steps: (1) Build labeled evaluation split by region/type, (2) run detector, (3) compute confusion matrix and threshold sensitivity
- Accuracy calculation: Precision/Recall/F1 at configured threshold; AUROC where score outputs exist
- Performance indicators: Precision, Recall, F1
- Minimum acceptable threshold (government): F1 >= 0.85 and Precision >= 0.90 for operational alert modes
- Files/APIs used: app/api/v1/satellite/leak-detector/route.ts, app/api/v1/satellite/multi-source/route.ts, app/api/gis/[...slug]/route.ts
- Current verifiability: Can verify

## 15) Alert Generation
- Service name: Operational Alert Generation (PIC + Satellite + GIS)
- Data type: Derived from monitored signals/events
- Required test data: Historical incident timelines, acknowledged alert logs, escalation response outcomes
- Test steps: (1) Replay historical windows, (2) compare generated alerts with true incidents and required escalation policies, (3) measure false alerts and missed alerts
- Accuracy calculation: Alert Precision/Recall + policy compliance rate
- Performance indicators: Precision, Recall, SLA compliance
- Minimum acceptable threshold (government): Precision >= 0.90, Recall >= 0.85, SLA compliance >= 0.95
- Files/APIs used: app/api/v1/pic/alerts/route.ts, app/api/v1/pic/dashboard/route.ts, app/api/v1/satellite/mobile-alerts/route.ts, app/api/gis/[...slug]/route.ts
- Current verifiability: Can verify

## 16) Forecasting
- Service name: Forecasting (cross-domain predictive outputs)
- Data type: Cannot verify
- Required test data: Cannot verify
- Test steps: Cannot verify
- Accuracy calculation: Cannot verify
- Performance indicators: Cannot verify
- Minimum acceptable threshold (government): Cannot verify
- Files/APIs used: Cannot verify
- Current verifiability: Cannot verify

## 17) Risk Assessment
- Service name: GIS/PIC Risk Assessment
- Data type: Mixed (real + modeled estimates)
- Required test data: Historical risk outcomes, incident severity records, exposure/vulnerability baselines
- Test steps: (1) Generate risk scores for historical windows, (2) compare high-risk predictions to actual incidents, (3) calibrate thresholds by asset class
- Accuracy calculation: Precision/Recall for high-risk class; Brier score for probabilistic outputs
- Performance indicators: Precision, Recall
- Minimum acceptable threshold (government): High-risk Precision >= 0.85, Recall >= 0.80
- Files/APIs used: app/api/gis/[...slug]/route.ts, app/api/v1/pic/dashboard/route.ts, lib/reasoning/engine.ts
- Current verifiability: Can verify

## 18) Asset Health
- Service name: Asset Health Scoring
- Data type: Mixed (derived from monitoring signals/events)
- Required test data: Asset maintenance history, failure events, inspection reports, performance telemetry
- Test steps: (1) Compute health over historical period, (2) compare low-health flags to observed failures/major incidents, (3) evaluate lead-time utility
- Accuracy calculation: Failure prediction Precision/Recall at health threshold; lead-time statistics
- Performance indicators: Precision, Recall
- Minimum acceptable threshold (government): Precision >= 0.85, Recall >= 0.80, median lead-time >= 14 days
- Files/APIs used: app/api/v1/pic/dashboard/route.ts, app/api/v1/satellite/registered-assets/route.ts, app/api/v1/satellite/multi-source/route.ts
- Current verifiability: Can verify

## 19) Asset Risk
- Service name: Asset Risk Classification
- Data type: Mixed (observational + modeled)
- Required test data: Asset criticality matrix, incident history by asset, exposure layers
- Test steps: (1) Produce risk class for each asset, (2) compare with incident/severity history, (3) review misclassified assets by class
- Accuracy calculation: Class-level Precision/Recall and weighted F1 by criticality
- Performance indicators: Precision, Recall
- Minimum acceptable threshold (government): Weighted F1 >= 0.82, critical-asset Recall >= 0.90
- Files/APIs used: app/api/v1/satellite/registered-assets/route.ts, app/api/gis/[...slug]/route.ts, app/api/v1/pic/dashboard/route.ts
- Current verifiability: Can verify

## 20) Satellite Intelligence
- Service name: Satellite Intelligence Center Capability Stack
- Data type: Mixed (real provider paths + explicit fallback paths)
- Required test data: Provider-available windows, provider-unavailable windows, labeled reference outcomes for both conditions
- Test steps: (1) Run standardized suite over all core satellite endpoints, (2) separate real vs fallback result sets, (3) validate decision eligibility gates for low-confidence/fallback outputs
- Accuracy calculation: Metric suite per capability (detection Precision/Recall, IoU, MAE) split by source mode
- Performance indicators: Accuracy, Precision, Recall (capability-dependent)
- Minimum acceptable threshold (government): Real-mode metrics meet each capability threshold; fallback-mode outputs cannot be used for hard operational decisions
- Files/APIs used: app/api/v1/satellite/*, lib/stac.ts, lib/satelliteIntelAPI.ts, lib/sentinel-hub.ts
- Current verifiability: Can verify

## 21) MINERVA Reasoning
- Service name: MINERVA Reasoning and Evidence Inference
- Data type: Mixed (depends on signal adapters and context)
- Required test data: Scenario benchmark set with known outcomes, replay logs, ground-truth incident labels
- Test steps: (1) Execute replay scenarios, (2) compare inferred diagnosis/reasoning outputs to known outcomes, (3) evaluate contradiction handling and uncertainty statements
- Accuracy calculation: Outcome classification Precision/Recall/F1; reasoning consistency score vs benchmark explanations
- Performance indicators: Precision, Recall, F1
- Minimum acceptable threshold (government): F1 >= 0.85 and no contradictory hard conclusions when evidence is insufficient
- Files/APIs used: minerva/lab/runner.py, minerva/lab/replay_eo.py, minerva/signals/adapters/*, minerva/evidence/*
- Current verifiability: Can verify

## 22) Radar Analysis
- Service name: Radar Analysis Center
- Data type: Cannot verify
- Required test data: Cannot verify
- Test steps: Cannot verify
- Accuracy calculation: Cannot verify
- Performance indicators: Cannot verify
- Minimum acceptable threshold (government): Cannot verify
- Files/APIs used: Cannot verify
- Current verifiability: Cannot verify

## 23) Reports
- Service name: Government Reporting and Decision Pack
- Data type: Mixed (depends on upstream validated capabilities)
- Required test data: Signed source evidence, traceability links (requirement -> evidence), approved templates
- Test steps: (1) Generate report from validated outputs only, (2) audit each claim against source evidence chain, (3) reject any claim without proof
- Accuracy calculation: Claim verifiability rate = verified claims / total claims
- Performance indicators: Verifiability rate, unresolved claim count
- Minimum acceptable threshold (government): Verifiability rate = 1.00 and unresolved claims = 0 for final approval report
- Files/APIs used: Cannot verify
- Current verifiability: Cannot verify

## Validation Governance Notes
- No capability may be marked operationally accepted without evidence-backed metric results from field or benchmark testing.
- Any test run that uses fallback/simulated paths must be labeled as non-decisive for government approval unless explicitly approved for that capability.
- Any contradictory conclusion (for example unknown state plus hard classified state) invalidates that test case until corrected.
