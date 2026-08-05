# DSP Execution Governance Playbook

## 1) Purpose
This playbook is the single execution reference for the Development Agent.
The target is government-grade readiness, not only technical completion.

Execution domains covered:
- Architecture
- Data Integrity
- Evidence
- Security
- Performance
- Scalability
- Maintainability
- Separation of Concerns
- Multi-tenant Isolation
- Government Readiness

Out of scope:
- UI-only cosmetic work unless it affects data correctness
- Feature expansion outside listed phases

---

## 2) Mandatory Rules
1. Execute strictly from this file. No off-plan work.
2. Work phase-by-phase in order. Do not start next phase before current acceptance is fully met.
3. Every completed item must have verifiable evidence (file paths, endpoint proof, test/log proof).
4. If evidence is missing or unverifiable, write exactly: Cannot verify.
5. Any PIC/Radar/MINERVA/GIS/Surveying cross-mixing without explicit architectural boundary is an Architecture Violation.
6. No hidden assumptions. No estimated claims without explicit labeling.
7. If Construction Phase is unknown, do not output a specific phase conclusion in the same decision report.
8. Decision language must use audit-safe wording only:
   - Evidence insufficient
   - Cannot determine
   - Confidence below threshold
   - Not enough observations

---

## 3) Execution Phases

## Phase 0: Baseline Lock
Status: Not Started
Duration target: 2-3 days

Objective:
- Freeze a verified baseline of current behavior and risk points.

In scope:
- Confirm current tenant-context flow on critical APIs.
- Confirm current evidence persistence locations and format.
- Confirm where fallback/simulated output can appear.

Required evidence:
- Baseline matrix mapping risk -> source file/path -> current state.
- Endpoint inventory for PIC/GIS/Satellite/Alerting.

Acceptance criteria:
- A baseline report exists with explicit verified/unverified items.
- Every unknown point is tagged Cannot verify.

---

## Phase 1: Multi-tenant Isolation Hardening
Status: Not Started
Duration target: 1-2 weeks

Objective:
- Enforce tenant isolation policy consistently across critical surfaces.

In scope:
- Remove/contain client-controlled tenant fallbacks on critical routes.
- Ensure tenant context comes from verified auth path only on sensitive flows.
- Validate access behavior for PIC, GIS, satellite intelligence, work-order critical paths.

Required evidence:
- Route-level tenant context matrix (before/after).
- Negative verification (cross-tenant access denied).
- Security check logs for key APIs.

Acceptance criteria:
- No critical endpoint accepts unverified tenant context.
- Cross-tenant access checks are proven with evidence.

---

## Phase 2: Unified Evidence Contract
Status: Not Started
Duration target: 2-3 weeks

Objective:
- Standardize evidence structure across modules, with audit-ready semantics.

In scope:
- Define shared evidence contract fields and mandatory labels.
- Ensure unknown/insufficient data is explicitly represented.
- Prevent unqualified decision statements when confidence is below threshold.

Required evidence:
- Contract mapping per module (PIC/Satellite/GIS/Alerts where relevant).
- Sample outputs demonstrating explicit uncertainty and evidence trace.

Acceptance criteria:
- Decision outputs contain explicit confidence and evidence sufficiency state.
- Unknown phase remains unknown (no contradictory hard phase output).

---

## Phase 3: Evidence Persistence and Auditability
Status: Not Started
Duration target: 1-2 weeks

Objective:
- Improve integrity and traceability of evidence persistence.

In scope:
- Align persistence approach with audit and retention expectations.
- Ensure evidence updates are traceable and non-ambiguous.
- Ensure missing fields remain explicit (not fabricated defaults).

Required evidence:
- Evidence persistence map (source, storage, trace fields).
- Before/after proof for one real project evidence bundle.

Acceptance criteria:
- Evidence bundle remains complete, explicit, and traceable.
- Missing values are explicit and not silently invented.

---

## Phase 4: Separation of Concerns Boundaries
Status: Not Started
Duration target: 2-4 weeks

Objective:
- Reduce cross-domain coupling in high-risk execution surfaces.

In scope:
- Identify and reduce overloaded route/service boundaries.
- Clarify module responsibilities without changing business meaning.

Required evidence:
- Boundary map before/after.
- Regression verification for key endpoints.

Acceptance criteria:
- Reduced architectural coupling is demonstrated.
- No domain-mixing violations in updated boundaries.

---

## Phase 5: Government Readiness Validation Pack
Status: Not Started
Duration target: 1-2 weeks

Objective:
- Produce final validation pack for readiness decision.

In scope:
- Consolidate evidence across security, integrity, architecture, performance.
- Produce Pass/Fail-ready decision trace.

Required evidence:
- Final traceability matrix from each playbook requirement to proof.
- Residual risk register with severity and ownership.

Acceptance criteria:
- Every requirement is either proven or marked Cannot verify.
- Final recommendation can be audited externally.

---

## 4) Required Report Template (Per Phase)
Use exactly this structure:

### Executive Summary
### Phase
### Pass / Fail
### Completed Items
### Evidence Collected
### Cannot verify
### Risks (Critical / High / Medium / Low)
### Architecture Violations
### Security Problems
### Performance Risks
### Decision: Move to next phase (Yes/No) + reason

---

## 5) Final Delivery Template
Use exactly this structure:

### Executive Summary
### Overall Pass / Fail
### Requirement-to-Evidence Traceability Matrix
### Critical Issues
### High
### Medium
### Low
### Architecture Violations
### Evidence Problems
### Security Problems
### Performance Risks
### Cannot verify
### Recommended Next Action

---

## 6) Prompts for Development Agent

### Prompt A: Kickoff (Runbook-controlled execution)
Read and execute only from docs/EXECUTION-GOVERNANCE-PLAYBOOK.md.
Treat this file as the single source of truth.
Start with Phase 0 only.
Do not implement any work outside phase scope.
Do not move to next phase until current phase acceptance criteria are fully satisfied.
At phase completion, submit a report using the exact phase report template in the playbook.
Any missing proof must be written exactly as: Cannot verify.

### Prompt B: Phase Execution Discipline
Execute the current phase only.
For every change, attach concrete evidence (files/endpoints/logs/tests).
If you detect architectural mixing between PIC/Radar/MINERVA/GIS/Surveying, record it as Architecture Violation.
If confidence is below threshold or data is insufficient, use only approved audit wording.
Never output a hard Construction Phase when phase is unknown.
When finished, provide the phase report and stop for approval.

### Prompt C: Final Closure
Produce the final delivery report strictly using the final template in the playbook.
Include a requirement-to-evidence traceability matrix covering all phases.
Any unproven statement must appear under Cannot verify.
Return final Pass/Fail with justification.
Do not add future feature proposals.

---

## 7) Prompt for Architecture & Audit Officer (Verification)
Use this prompt after receiving the Development Agent final report:

Review the attached final report against docs/EXECUTION-GOVERNANCE-PLAYBOOK.md as an independent Architecture and Audit reviewer.
Validate each requirement against provided evidence only.
If proof is missing, mark Cannot verify.
Output only:
- Executive Summary
- Pass / Fail
- Critical Issues
- High
- Medium
- Low
- Architecture Violations
- Evidence Problems
- Security Problems
- Performance Risks
- Recommended Next Action
No implementation details.
No code.
