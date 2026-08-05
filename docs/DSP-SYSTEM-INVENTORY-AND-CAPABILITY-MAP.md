# DSP Core Architecture Discovery Report

Date: 2026-07-16
Mode: Discovery only (no implementation, no refactor, no new module creation)
Evidence Policy: Repository evidence only. Any unprovable point is marked exactly as: Cannot verify.

---

## PART 1 — Core Engines

| Engine | Purpose | Owner Module | Current Location | Who Uses It (Current) | Who Should Use It | Platform-wide Potential | Evidence |
|---|---|---|---|---|---|---|---|
| SignalValidationEngine | Validates EO signal observations and confidence | PIC intelligence pipeline | lib/svqe/engine.ts | PIC analyzer | Satellite and any EO change analytics requiring validation gates | Yes | lib/pic/analyzer.ts imports SignalValidationEngine |
| FeatureEngine | Extracts physical features from scene observations | PIC intelligence pipeline | lib/features/engine.ts | PIC analyzer | Satellite analytics and cross-center feature workflows | Yes | lib/pic/analyzer.ts imports FeatureEngine |
| ConstructionReasoningEngine | Builds construction intelligence from validated features | PIC intelligence pipeline | lib/reasoning/engine.ts | PIC analyzer | Alerts/governance modules requiring explainable construction state | Yes (domain-scoped) | lib/pic/analyzer.ts imports ConstructionReasoningEngine |
| WorkflowEngine | Governance workflow state and transitions | Governance core | lib/governance/core.ts | Governance and audit paths | Work-orders, approvals, and cross-center regulated flows | Yes | lib/governance/core.ts defines WorkflowEngine |
| ImmutableAuditService | Immutable audit event append service | Governance core | lib/governance/core.ts | Security audit and governance events | All regulated operational centers | Yes | lib/governance/core.ts, lib/security-audit-log.ts |
| GisEngine (state engine) | Shared GIS operational state orchestration | GIS state layer | store/gisEngine.ts | Command Center, Engineering Workspace, Satellite center components | All GIS-first centers | Yes | store/gisEngine.ts defines useGisEngine; multiple dashboard consumers |
| AreaIntelEngine | Area-level intelligence aggregation from satellite scene context | Satellite intelligence service layer | lib/areaIntelEngine.ts | Satellite Intelligence Center components | Centralized satellite analytics orchestrator | Yes, if centralized consumption enforced | Satellite center components import/use area intelligence flow |
| STAC engine (searchSTAC + indicators) | External scene discovery + normalized change indicators | Satellite data provider layer | lib/stac.ts | Satellite routes and derived analysis flows | PIC/MINERVA where EO acquisition normalization is needed | Yes | lib/stac.ts defines searchSTAC and computeChangeIndicators |
| WaterQualityEngine | Extracts/analyzes water quality workbook data | Water domain engines | lib/engines/waterQualityEngine.ts | Maintenance Preventive page and SCADA page | Shared water system service layer | Potentially | Two centers import directly |
| WellFieldsPumpEngine | Extracts well/pump operational data | Water domain engines | lib/engines/wellFieldsPumpEngine.ts | Maintenance Preventive page and SCADA page | Shared water system service layer | Potentially | Two centers import directly |

Notes:
- Radar-specific reusable engine in TypeScript layer: Cannot verify.
- Dedicated NotificationEngine as single shared engine (not scattered handlers): Cannot verify.

---

## PART 2 — Operational Centers

| Center | Mission (Observed) | Engines Consumed | Engines Owned | Duplicated Logic | Should It Mainly Orchestrate Shared Engines? | Evidence |
|---|---|---|---|---|---|---|
| Project Intelligence Center (PIC) | Project monitoring and intelligence from scene analysis | SignalValidationEngine, FeatureEngine, ConstructionReasoningEngine | PIC analysis composition | Low duplication observed in core path | Yes, and largely already follows that model | app/dashboard/gis-sovereignty/project-intelligence-center/page.tsx, lib/pic/analyzer.ts |
| Satellite Intelligence Center | Scene/area/workflow analysis across multiple analytical panels | AreaIntelEngine, satellite intel APIs, STAC-backed flows, GisEngine | UI-level orchestration shell | High UI-level repeated logic across many components | Yes | app/dashboard/gis-sovereignty/satellite-intelligence-center/components/SatelliteIntelLegacyShell.tsx |
| Engineering Workspace | Asset-layer operations, drawing, map workflows | GisEngine and GIS APIs | Workspace-specific orchestration logic | Moderate; map tooling duplicated in places | Yes | app/dashboard/gis-sovereignty/engineering-workspace/*, store/gisEngine.ts |
| Command Center | Aggregated operational situational view | GisEngine + center APIs | None clearly separate as engine | Low-moderate | Yes | app/dashboard/gis-sovereignty/command-center/page.tsx |
| MINERVA Center | Intelligence command interface and EO status bridge | Python MINERVA modules + API bridge | Python-side reasoning stack | Cannot verify duplication against TS engines without runtime coupling proof | Yes | app/dashboard/gis-sovereignty/minerva-center/command/CommandCenter.tsx, minerva/* |
| Maintenance Preventive Center | Water/maintenance analytics | Water domain engines (direct imports) | None | High with SCADA center (same imports + extraction pattern) | Yes | app/dashboard/admin-gateway/maintenance/preventive/page.tsx |
| Control Center SCADA | Operational SCADA analytics | Water domain engines (direct imports) | None | High with Preventive center | Yes | app/dashboard/control-center/scada/page.tsx |
| Remote Sensing Center | Legacy alias to satellite center | Redirect only | None | N/A | N/A | app/dashboard/gis-sovereignty/remote-sensing-center/page.tsx |

---

## PART 3 — Engine Usage Matrix

Legend: Uses / Owns / Should Use / Cannot verify

| Engine \ Center | PIC | Radar | Satellite | MINERVA | Survey | Engineering | Alerts | GIS | Command Center | Asset Management | Work Orders |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SignalValidationEngine | Uses | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify |
| FeatureEngine | Uses | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify |
| ConstructionReasoningEngine | Owns | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify |
| WorkflowEngine | Should Use | Cannot verify | Should Use | Cannot verify | Cannot verify | Should Use | Should Use | Should Use | Should Use | Should Use | Uses |
| ImmutableAuditService | Should Use | Cannot verify | Should Use | Cannot verify | Cannot verify | Should Use | Uses | Should Use | Should Use | Should Use | Should Use |
| GisEngine | Cannot verify | Cannot verify | Uses | Cannot verify | Cannot verify | Uses | Cannot verify | Owns | Uses | Uses | Uses |
| AreaIntelEngine | Cannot verify | Cannot verify | Owns | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Cannot verify |
| STAC engine | Should Use | Cannot verify | Uses | Should Use | Cannot verify | Cannot verify | Should Use | Should Use | Cannot verify | Cannot verify | Cannot verify |
| WaterQualityEngine | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify |
| WellFieldsPumpEngine | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Cannot verify | Should Use | Cannot verify | Cannot verify | Cannot verify | Cannot verify |

Matrix evidence baseline:
- lib/pic/analyzer.ts
- store/gisEngine.ts
- lib/governance/core.ts
- lib/security-audit-log.ts
- lib/stac.ts
- app/dashboard/admin-gateway/maintenance/preventive/page.tsx
- app/dashboard/control-center/scada/page.tsx

---

## PART 4 — Platform Layers (Observed Only)

1. External Providers
- Copernicus CDSE STAC, Element84 STAC, Open-Meteo, satellite providers used in routes/adapters.
- Evidence: lib/stac.ts, minerva/signals/adapters/weather.py, satellite routes.

2. Data Acquisition Layer
- STAC search and provider fetch adapters.
- Evidence: lib/stac.ts, minerva/signals/adapters/*.py.

3. Processing Layer
- Validation, feature extraction, domain-specific transforms.
- Evidence: lib/svqe/engine.ts, lib/features/engine.ts, water engines in lib/engines/*.

4. Shared Engines / Shared Services Layer
- WorkflowEngine, ImmutableAuditService, permission model, shared GIS state, backend tenant extraction.
- Evidence: lib/governance/core.ts, lib/permissions.ts, store/gisEngine.ts, lib/backendProxy.ts.

5. Intelligence Layer
- ConstructionReasoningEngine and MINERVA reasoning/evidence modules.
- Evidence: lib/reasoning/engine.ts, minerva/reasoning/*, minerva/evidence/*.

6. Operational Centers Layer
- PIC, Satellite Intelligence Center, Engineering Workspace, Command Center, MINERVA center, maintenance/control centers.
- Evidence: app/dashboard/gis-sovereignty/* and app/dashboard/admin-gateway/* center pages.

7. Presentation Layer
- Dashboard shells and panels orchestrating APIs/engines.
- Evidence: center shell components (e.g., SatelliteIntelLegacyShell).

8. API/Exposure Layer
- app/api/* route handlers providing center-facing services.
- Evidence: app/api/v1/pic/*, app/api/v1/satellite/*, app/api/gis/[...slug]/route.ts.

9. Reports/Audit Output Layer
- Governance audit events and security audit log stream.
- Evidence: lib/governance/core.ts, lib/security-audit-log.ts.

10. Government Users layer (explicit role-mapped users consuming dashboards/reports)
- Cannot verify.

---

## PART 5 — Duplication Analysis

1) Water engine duplication
- Where: app/dashboard/admin-gateway/maintenance/preventive/page.tsx and app/dashboard/control-center/scada/page.tsx.
- Why: both pages directly import identical water extraction engines.
- Impact: duplicated parsing/execution paths and maintenance burden.
- Evidence: same import set in both files.

2) Satellite analysis logic spread
- Where: multiple satellite center components plus SatelliteIntelLegacyShell.
- Why: component-level analysis orchestration rather than a single center-level coordinator.
- Impact: coupling and consistency risk.
- Evidence: app/dashboard/gis-sovereignty/satellite-intelligence-center/components/SatelliteIntelLegacyShell.tsx and related component imports.

3) Real/fallback scene summary dual path
- Where: lib/satelliteIntelAPI.ts.
- Why: fallback profile path exists alongside real path.
- Impact: governance traceability ambiguity if not explicitly flagged in all consuming views.
- Evidence: allowSceneFallback, WORKFLOW_FALLBACK_PROFILES, buildFallbackSceneSummary.

4) Timeline logic duplicated across platform domains as one shared timeline engine
- Cannot verify.

---

## PART 6 — Cross-Center Relationships

PIC
- Consumes: SVQE, feature extraction, reasoning, picDB.
- Produces: project scans/events/alerts/evidence outputs.
- Depends on: pic routes and archive scene access.
- Should never depend on: center-specific UI state engines.
- Shared engines used: yes (SVQE/Feature/Reasoning).
- Private logic: project-specific composition.
- Evidence: lib/pic/analyzer.ts, app/api/v1/pic/projects/[id]/route.ts.

Satellite Intelligence Center
- Consumes: AreaIntel, satellite APIs, GIS store.
- Produces: scene/workflow analytical outputs in UI/API responses.
- Depends on: STAC data and satellite API wrappers.
- Should never depend on: duplicated local analytic logic across many panels.
- Shared engines used: partial.
- Private logic: panel-specific orchestration.
- Evidence: SatelliteIntelLegacyShell + satellite APIs.

Engineering Workspace
- Consumes: GIS store and GIS service routes.
- Produces: layer/asset operations and map editing interactions.
- Depends on: GIS APIs and map state.
- Should never depend on: unrelated satellite workflow internals.
- Shared engines used: GisEngine.
- Private logic: workspace-specific editing orchestration.
- Evidence: engineering workspace components + store/gisEngine.ts.

Command Center
- Consumes: GIS store and center API outputs.
- Produces: consolidated operational picture (presentation level).
- Depends on: upstream work-order/asset/alert data.
- Should never depend on: deep domain extraction engines.
- Shared engines used: GisEngine.
- Private logic: KPI aggregation in UI.
- Evidence: app/dashboard/gis-sovereignty/command-center/page.tsx.

Maintenance Preventive + SCADA
- Consumes: same water engines directly.
- Produces: center-specific water operational views.
- Depends on: workbook extraction engine outputs.
- Should never depend on: duplicated direct engine imports in page shells.
- Shared engines used: yes, but duplicated consumption pattern.
- Private logic: page-level parsing/orchestration.
- Evidence: both page.tsx files under maintenance/preventive and control-center/scada.

MINERVA
- Consumes: Python evidence/reasoning/signal adapters + API bridge.
- Produces: intelligence/diagnostic outputs.
- Depends on: provider adapters and minerva stack.
- Should never depend on: ungoverned duplicate logic in TS center components.
- Shared engines used: Cannot verify cross-runtime shared-engine contract.
- Private logic: minerva Python stack.
- Evidence: minerva/* and minerva center command files.

---

## PART 7 — Architecture Boundary Check

Boundary principle checked: Centers orchestrate. Engines perform work. Shared services provide reusable capabilities.

Conforms (evidence-backed):
- PIC center: largely orchestrates reusable engines through analyzer composition.
- Governance/audit flow: service-level abstraction exists (WorkflowEngine + ImmutableAuditService).

Violations (evidence-backed):
- Maintenance Preventive and SCADA pages import and execute domain engines directly in page components.
- Satellite Intelligence Center has broad component-level analytical orchestration distribution.
- Mixed fallback/real data path in satellite intel API can blur boundary between production intelligence and fallback simulation traces if not uniformly surfaced.

Cannot verify:
- Full boundary conformity for Radar center and Survey center (explicit center-level architecture not proven from inspected evidence).

---

## PART 8 — Architecture Maturity

Scoring basis: Reuse, SoC, Scalability, Maintainability, Extensibility, Government Readiness, Evidence Traceability, Auditability, Multi-tenant Readiness.
Scale: 0-100.

Engine maturity
- SVQE/Feature/Reasoning (PIC chain): 72
  - Strong separation and explicit composition; multi-tenant engine-level contract not fully explicit.
- WorkflowEngine + ImmutableAuditService: 74
  - Good governance/audit basis; platform adoption breadth is incomplete.
- GisEngine: 61
  - High reuse; mixed concerns and broad state responsibilities.
- AreaIntelEngine + satellite intel API: 54
  - Reusable but operationally fragmented consumption and fallback path complexity.
- Water engines (quality/pump/branch/taz): 42
  - Reusable extraction logic exists, but duplicated center usage pattern reduces architecture quality.

Center maturity
- PIC Center: 76
- Satellite Intelligence Center: 49
- Engineering Workspace: 63
- Command Center: 64
- MINERVA Center: 58 (cross-runtime governance linkage: Cannot verify)
- Maintenance Preventive: 41
- SCADA Center: 41

Overall platform architecture maturity: 59
Justification:
- Strengths: reusable governance/audit services, clear PIC intelligence pipeline, shared GIS state usage.
- Weaknesses: repeated center-level domain logic imports, uneven orchestration boundaries, mixed fallback/real intelligence pathways, inconsistent explicit multi-tenant proof across all center-engine boundaries.

---

## PART 9 — Final Architecture (Text)

DSP Platform
├── External Providers
│   ├── Copernicus CDSE STAC
│   ├── Element84 STAC
│   ├── Open-Meteo
│   └── Other provider adapters in minerva signals
├── Shared Services
│   ├── WorkflowEngine
│   ├── ImmutableAuditService
│   ├── Permission model (role/permission provider)
│   ├── Tenant extraction (verified header path)
│   └── GIS shared state engine (useGisEngine)
├── Core Engines
│   ├── SignalValidationEngine
│   ├── FeatureEngine
│   ├── ConstructionReasoningEngine
│   ├── AreaIntelEngine
│   ├── STAC acquisition/indicator engine
│   └── Water domain extraction engines
├── Intelligence Engines
│   ├── PIC reasoning chain (SVQE -> Feature -> Reasoning)
│   └── MINERVA reasoning/evidence stack (Python)
├── Operational Centers
│   ├── Project Intelligence Center
│   ├── Satellite Intelligence Center
│   ├── Engineering Workspace
│   ├── Command Center
│   ├── MINERVA Center
│   ├── Maintenance Preventive Center
│   └── Control Center SCADA
├── Dashboards
│   └── app/dashboard/* center shells and panels
├── APIs
│   ├── /api/v1/pic/*
│   ├── /api/v1/satellite/*
│   ├── /api/gis/[...slug]
│   └── /api/minerva/*
├── Reports
│   ├── Governance audit events
│   └── Security audit log stream
└── Government Users
    └── Cannot verify

Architecture evidence base:
- lib/pic/analyzer.ts
- lib/governance/core.ts
- lib/security-audit-log.ts
- lib/stac.ts
- store/gisEngine.ts
- app/dashboard/gis-sovereignty/*
- app/api/v1/pic/*
- app/api/v1/satellite/*
- app/api/gis/[...slug]/route.ts
- minerva/*

---

## PART 10 — Final Executive Summary

1. Real core engines
- PIC intelligence chain (SignalValidationEngine, FeatureEngine, ConstructionReasoningEngine), WorkflowEngine/ImmutableAuditService, GisEngine, AreaIntelEngine, STAC acquisition/indicator engine, and water extraction engines.

2. Duplicated engines/logic
- Water extraction engine consumption duplicated across Maintenance Preventive and SCADA pages.
- Satellite center analytics orchestration duplicated/distributed across many components.

3. Centers containing logic that should belong to shared engines/services
- Maintenance Preventive and SCADA contain direct engine execution in page layer.
- Satellite center contains broad panel-level analytical orchestration that is not centralized.

4. Shared services already existing
- Governance workflow/audit services, permissions provider, tenant extraction path, shared GIS state, STAC data abstraction.

5. Correct architectural boundaries
- PIC mostly follows center-orchestrates/engine-performs model.
- Governance/audit services are separated from page-level logic.

6. Violated boundaries
- Page-level direct domain engine execution in water centers.
- Distributed analytic orchestration in satellite center.
- Mixed fallback/real intelligence path risk in shared satellite API path.

7. Suitability for long-term government expansion
- Partially suitable. Foundations exist (governance/audit + core intelligence engines), but boundary consistency and duplication patterns reduce long-term maintainability and traceability quality.

8. Overall architecture maturity (0-100)
- 59%.
- Rationale: solid engine/service nucleus with clear gaps in cross-center orchestration discipline, duplication control, and uniform architecture boundary enforcement.

---

## Explicit Cannot verify Register

- Radar center architecture, ownership, and shared-engine usage proof from inspected TS/Python surface: Cannot verify.
- Survey center architecture, ownership, and shared-engine usage proof from inspected TS/Python surface: Cannot verify.
- End-to-end government user role mapping from dashboards to audited report consumption across all centers: Cannot verify.
- Full cross-runtime (TypeScript <-> Python MINERVA) shared engine contract and enforcement boundary: Cannot verify.
