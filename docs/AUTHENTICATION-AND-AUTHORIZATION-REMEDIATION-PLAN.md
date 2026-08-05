# AUTHENTICATION AND AUTHORIZATION REMEDIATION PLAN

**Date:** 2026-07-21  
**Scope:** Authentication + Authorization only  
**Method:** Code-based assessment only (current repository state). No implementation changes applied.

## 1) Baseline and Source Notes

- The repository contains security-related implementation comments and hardening markers (P1/P2/P3/P4/P5) across auth/rbac files.
- This plan is derived strictly from current code paths in middleware, auth APIs, authorization helpers, token handling, and session helpers.
- This document classifies issues as:
  - **Open:** still risky in current code.
  - **Fixed (or Partially Fixed):** mitigation is present in current code, with evidence.

---

## 2) Issue Register (Current State)

## Issue 1

1. **Description**  
   Dev quick login endpoint issues privileged token without credential verification.
2. **Why it is dangerous**  
   If reachable in non-dev context, it creates immediate admin-level session material.
3. **Affected files**  
   - app/api/auth/dev-quick-login/route.ts
   - middleware.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Endpoint itself has no mandatory environment gate inside the route handler; protection is indirect and policy-dependent.
7. **Severity**  
   **Critical**
8. **Priority order**  
   **P1**

## Issue 2

1. **Description**  
   Admin login has fallback bootstrap password with default value in code path.
2. **Why it is dangerous**  
   Predictable fallback credentials can become an account-takeover vector if not overridden and tightly controlled.
3. **Affected files**  
   - app/api/auth/admin-login/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Backward-compatibility with bootstrap flow is still embedded in route logic.
7. **Severity**  
   **Critical**
8. **Priority order**  
   **P2**

## Issue 3

1. **Description**  
   Trust boundary flaw: middleware builds x-verified-* headers by decoding bearer payload without signature verification, and authorize() trusts those headers.
2. **Why it is dangerous**  
   Forged bearer payloads can inject tenant/role identity and pass authorization checks in routes relying on authorize().
3. **Affected files**  
   - middleware.ts
   - lib/authorize.ts
   - lib/auth-tenant-context.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Current design performs lightweight decode in middleware and expects later verification, but many routes consume the injected headers directly.
7. **Severity**  
   **Critical**
8. **Priority order**  
   **P3**

## Issue 4

1. **Description**  
   /api/auth/* is globally listed as public in middleware while many /api/auth/mobile/* handlers depend on authorize() + x-verified-* context.
2. **Why it is dangerous**  
   Public classification weakens central auth enforcement and increases exposure of mobile authz surfaces.
3. **Affected files**  
   - middleware.ts
   - app/api/auth/mobile/me/route.ts
   - app/api/auth/mobile/manager/route.ts
   - app/api/auth/mobile/notifications/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Public API list is broad by design and currently co-mingles truly public auth routes with protected mobile operational endpoints.
7. **Severity**  
   **Critical**
8. **Priority order**  
   **P4**

## Issue 5

1. **Description**  
   Bootstrap endpoint executes and persists onboarding data even when no valid auth token is provided.
2. **Why it is dangerous**  
   Unauthorized callers can mutate bootstrap state or trigger backend bootstrap forwarding attempts.
3. **Affected files**  
   - app/api/auth/bootstrap/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Route treats auth verification as best-effort, not mandatory gate.
7. **Severity**  
   **High**
8. **Priority order**  
   **P5**

## Issue 6

1. **Description**  
   Tokens have no explicit expiration claim enforcement in verifyAuthToken() logic.
2. **Why it is dangerous**  
   Long-lived replay risk increases when stolen tokens remain structurally valid indefinitely.
3. **Affected files**  
   - lib/auth-tokens.ts
   - app/api/auth/me/route.ts
   - app/api/auth/session/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Existing token format includes iat but no exp policy checked at verification time.
7. **Severity**  
   **High**
8. **Priority order**  
   **P6**

## Issue 7

1. **Description**  
   Secret management fallback risk: auth signing allows hardcoded development fallback secret when env secret is absent.
2. **Why it is dangerous**  
   Predictable default secret enables offline token forgery if deployed incorrectly.
3. **Affected files**  
   - lib/auth-tokens.ts
   - lib/owner-auth.ts
   - app/api/auth/admin-login/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Multiple token issuers/verifiers retain fallback constants for convenience.
7. **Severity**  
   **High**
8. **Priority order**  
   **P7**

## Issue 8

1. **Description**  
   Client session handling still stores bearer token in localStorage and writes client-side auth cookie.
2. **Why it is dangerous**  
   XSS impact is amplified when token material is script-accessible; cookie tampering risk remains for frontend-only guards.
3. **Affected files**  
   - lib/client-auth-session.ts
   - middleware.ts
4. **Fixed?**  
   **Partially fixed**
5. **If fixed, evidence**  
   - app/api/auth/session/route.ts sets httpOnly session cookies for server-side session signaling.
6. **If not fixed, blocker**  
   Transitional architecture still supports localStorage token pattern for existing client flows.
7. **Severity**  
   **High**
8. **Priority order**  
   **P8**

## Issue 9

1. **Description**  
   Account enumeration through differentiated responses in send-code / forgot-password request.
2. **Why it is dangerous**  
   Attackers can discover valid accounts for phishing or targeted brute-force workflows.
3. **Affected files**  
   - app/api/auth/send-code/route.ts
   - app/api/auth/forgot-password/request/route.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   UX currently favors explicit user feedback over indistinguishable response envelope.
7. **Severity**  
   **Medium**
8. **Priority order**  
   **P9**

## Issue 10

1. **Description**  
   Invite endpoint returns temporary password in API response payload.
2. **Why it is dangerous**  
   Sensitive credential material can leak via logs, browser traces, or intermediary systems.
3. **Affected files**  
   - app/api/auth/invite/route.ts
   - lib/user-store.ts
4. **Fixed?**  
   **No**
5. **If fixed, evidence**  
   N/A
6. **If not fixed, blocker**  
   Current invitation UX depends on direct return of bootstrap credentials.
7. **Severity**  
   **Medium**
8. **Priority order**  
   **P10**

## Issue 11

1. **Description**  
   Missing explicit anti-automation controls on certain sensitive auth routes (notably admin-login and reset request).
2. **Why it is dangerous**  
   Increases brute-force and abuse probability despite protections on other credential/mobile paths.
3. **Affected files**  
   - app/api/auth/admin-login/route.ts
   - app/api/auth/forgot-password/request/route.ts
4. **Fixed?**  
   **Partially fixed**
5. **If fixed, evidence**  
   - app/api/auth/login-credentials/route.ts implements lockout/attempt key flow.
   - app/api/auth/mobile/login/route.ts implements lockout flow.
6. **If not fixed, blocker**  
   Protection is uneven across auth surfaces; no single cross-route throttling policy.
7. **Severity**  
   **Medium**
8. **Priority order**  
   **P11**

## Issue 12

1. **Description**  
   Dashboard RBAC relies on cookie role/dept and explicitly skips RBAC for unknown roles.
2. **Why it is dangerous**  
   Cookie tampering and unknown-role bypass behavior can weaken frontend route governance (even if API may still block data ops).
3. **Affected files**  
   - middleware.ts
   - lib/rbac.ts
4. **Fixed?**  
   **Partially fixed**
5. **If fixed, evidence**  
   - middleware strips client-supplied x-verified-* headers before forwarding.
   - route-level RBAC matrix exists and is enforced for known roles.
6. **If not fixed, blocker**  
   Legacy-compatibility branch intentionally tolerates unknown roles.
7. **Severity**  
   **Medium**
8. **Priority order**  
   **P12**

---

## 3) Confirmed Hardening Already Implemented (From Current Code)

- Credential login lockout and retry windows exist.
- Mobile login lockout exists.
- Tenant-scoped credential lookup is enforced in login-credentials.
- Authorization helper + permission model + department domain mapping are present.
- Server-side session endpoint exists and sets httpOnly cookies.
- Middleware sanitizes inbound x-verified-* headers before forwarding.

These mitigations reduce risk but do not close the critical trust-boundary and endpoint-exposure gaps listed above.

---

## 4) Remediation Roadmap (Small Phases, 2-3 files each)

## Phase A: Authentication

**Goal:** Close immediate authentication bypass vectors.  
**Max file scope:** 3 files

- Files:
  - app/api/auth/dev-quick-login/route.ts
  - app/api/auth/admin-login/route.ts
  - lib/auth-tokens.ts
- Work package:
  - Hard-disable dev quick login outside explicit dev-safe mode.
  - Remove default bootstrap password fallback and require explicit secure secret configuration.
  - Introduce token expiration policy in token issue/verify path.
- Acceptance criteria:
  - Dev quick login returns forbidden unless strict dev guard is true.
  - Admin login cannot succeed via hardcoded default.
  - verifyAuthToken rejects expired tokens deterministically.

## Phase B: Authorization

**Goal:** Repair trust boundary between middleware identity extraction and route authorization.  
**Max file scope:** 3 files

- Files:
  - middleware.ts
  - lib/authorize.ts
  - lib/auth-tenant-context.ts
- Work package:
  - Ensure injected identity headers are derived from verified token path only.
  - Make authorize() require verifiable auth context (not decode-only context).
  - Remove/contain any assumptions that x-verified-* is always cryptographically verified.
- Acceptance criteria:
  - Forged bearer payload without valid signature cannot pass authorize().
  - Routes using authorize() fail closed (401/403) on unverifiable context.

## Phase C: Session Management

**Goal:** Eliminate script-accessible session/token dependencies.  
**Max file scope:** 3 files

- Files:
  - lib/client-auth-session.ts
  - app/api/auth/session/route.ts
  - components/auth/LoginPanel.tsx
- Work package:
  - Transition client flow to server-managed httpOnly session path.
  - Remove localStorage as authoritative auth source.
  - Keep only minimal non-sensitive client state.
- Acceptance criteria:
  - No bearer token persisted in localStorage in normal flow.
  - Session continuation works via httpOnly cookie path only.

## Phase D: API Security

**Goal:** Separate public auth endpoints from protected operational auth endpoints.  
**Max file scope:** 3 files

- Files:
  - middleware.ts
  - app/api/auth/bootstrap/route.ts
  - app/api/auth/forgot-password/request/route.ts
- Work package:
  - Narrow PUBLIC_API_PATHS to true-public endpoints only.
  - Enforce mandatory auth on bootstrap route.
  - Add abuse controls and generic response envelope for reset request.
- Acceptance criteria:
  - Protected /api/auth/mobile/* routes require verified auth context.
  - Bootstrap route cannot mutate state without valid authenticated principal.
  - Reset request does not leak account existence.

## Phase E: Audit Logging

**Goal:** Establish reliable security audit trail for auth/authz decisions.  
**Max file scope:** 3 files

- Files:
  - lib/security-audit-log.ts
  - app/api/auth/login-credentials/route.ts
  - app/api/auth/admin-login/route.ts
- Work package:
  - Log success/failure for high-risk auth actions with actor/tenant/request metadata.
  - Log lockouts and denied access decisions.
  - Ensure logs are consistent across credential and admin flows.
- Acceptance criteria:
  - Each failed/successful high-risk auth event is captured once with request context.
  - Lockout and forbidden events are queryable by tenant and actor.

## Phase F: Final Security Validation

**Goal:** Validate closure of critical and high findings before rollout.  
**Max file scope:** 3 files

- Files:
  - test-e2e-workflow.js
  - test-fault-code-integration.js
  - docs/AUTHENTICATION-AND-AUTHORIZATION-REMEDIATION-PLAN.md
- Work package:
  - Add/execute security-focused checks for: forged token rejection, dev/admin auth hardening, session invariants.
  - Update this plan with final evidence table (open/closed per issue).
- Acceptance criteria:
  - Critical findings (P1-P4) demonstrably closed by test evidence.
  - High findings have either closure evidence or approved exception record.
  - Final status table is updated and auditable.

---

## 5) Recommended Execution Order

1. Phase A (Authentication)  
2. Phase B (Authorization)  
3. Phase C (Session Management)  
4. Phase D (API Security)  
5. Phase E (Audit Logging)  
6. Phase F (Final Security Validation)

This sequence prioritizes immediate exploit-path closure first, then structural hardening, then auditability and final proof.
