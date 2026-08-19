# DSP — Phase 0: Security & Identity Foundation Remediation
**Report date:** 2026-08 (session continuation of `DSP_IDENTITY_ORGANIZATION_AUDIT.md`)
**Scope:** Security + Identity Foundation ONLY. No Departments/Sections/Navigation/Icons/Provisioning work was performed, per explicit instruction. **STOP condition honored — this phase is complete and the agent has stopped.**

All claims below are backed by either (a) direct code citation, (b) a live `curl`/DB test executed against the running dev server, or explicitly marked `CANNOT CONFIRM` where proof was not obtainable in this repo/environment.

---

## 1. Findings Verified

### Finding A — Hardcoded super_admin bootstrap password
- **FILE:** [app/api/auth/admin-login/route.ts](app/api/auth/admin-login/route.ts)
- **FUNCTION/ROUTE:** `POST /api/auth/admin-login`
- **EVIDENCE (before fix):** `const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'SovereignAdmin2026!';` — confirmed live/reachable via `.env.local` grep: `ADMIN_BOOTSTRAP_PASSWORD` was **not set**, so the hardcoded string was the active credential. Confirmed exploitable with a live `curl` test before the fix (200 OK + valid `super_admin` token returned for password `SovereignAdmin2026!`).
- **SECURITY IMPACT:** Critical — full unauthenticated `super_admin` takeover, reachable from any environment (no `NODE_ENV` gate existed).
- **REMEDIATION:** Fixed. See Section 3.

### Finding B — API proxy trusts a client-controlled tenant header
- **FILE:** [app/api/[...path]/route.ts](app/api/%5B...path%5D/route.ts)
- **FUNCTION/ROUTE:** `resolveTenantId()` / `tenantHeaders()`, used by the catch-all `GET/POST/PATCH/PUT/DELETE /api/*` proxy.
- **EVIDENCE (before fix):** `resolveTenantId()` read `request.headers.get('X-Tenant-ID')` (raw client header) or the `tenant_id` cookie directly, with only a UUID-shape regex check — no ownership/membership validation. Confirmed exploitable: `curl -H "X-Tenant-ID: <any-uuid>"` was forwarded verbatim to the downstream backend.
- **SECURITY IMPACT:** Critical — any authenticated (or even unauthenticated, since the proxy did not itself require auth) request could select an arbitrary tenant.
- **REMEDIATION:** Fixed. See Section 3.

### Finding C — Static super_admin role injection into downstream service
- **FILE:** [app/api/[...path]/route.ts](app/api/%5B...path%5D/route.ts)
- **FUNCTION/ROUTE:** `tenantHeaders()` in the same catch-all proxy.
- **EVIDENCE (before fix):** `'X-User-Role': 'super_admin'` was hardcoded unconditionally for **every** proxied request, regardless of the caller's real role.
- **SECURITY IMPACT:** Critical — combined with Finding B, any request through this proxy reached the external backend as `super_admin` for an attacker-chosen tenant.
- **REMEDIATION:** Fixed. See Section 3.

### Finding D — Identity tables without RLS
- **VERIFIED (re-confirmed via live DB query this session, consistent with prior audit):** `SELECT relname, relrowsecurity FROM pg_class WHERE relname IN (...)` — all 22 previously-identified identity/org tables still have `relrowsecurity = false`.
- **SECURITY IMPACT:** High — zero DB-level tenant isolation; all isolation currently depends entirely on the application layer (which Findings A–C show was itself broken).
- **REMEDIATION:** Not implemented in Phase 0 per explicit instruction ("do not blindly add RLS... implement only policies that can be proven correct"). See Section 8 and Section 12.

### Finding E — Multiple parallel user systems
- **VERIFIED (re-confirmed):** `lib/user-store.ts` (JSON file), `public.auth_users` (231 rows, live/authoritative), `public.users` (13 rows, has real FKs, unused by any live auth path).
- **SECURITY/CORRECTNESS IMPACT:** High — inconsistent identity source of truth; a future feature could accidentally read/write the wrong store.
- **REMEDIATION:** Not consolidated in Phase 0 (explicitly deferred — "do not delete legacy tables yet"). Documented in Section 6 (Identity Model) and Section 12.

### Finding F — Multiple organization/tenant representations
- **VERIFIED (re-confirmed):** `public.auth_tenants` (text id, 15 rows — what `auth_users.tenant_id` actually references) vs. `public.tenants` (uuid id, 3 rows) — no bridge/overlap between them.
- **SECURITY/CORRECTNESS IMPACT:** High — any code path written against `public.tenants` silently operates on a near-empty, disconnected table.
- **REMEDIATION:** Not merged in Phase 0. Documented in Section 6.

### Finding G (new, discovered this session) — `dev-quick-login` unauthenticated admin-token backdoor
- **FILE:** [app/api/auth/dev-quick-login/route.ts](app/api/auth/dev-quick-login/route.ts)
- **FUNCTION/ROUTE:** `POST /api/auth/dev-quick-login`
- **EVIDENCE (before fix):** Handler unconditionally called `makeAuthToken('dev@dsf.local', 'admin', { tenant_id: 'aaaaaaaa-...', is_founder: true, ... })` with **no password, no auth check, no environment gate**. This path sits under the middleware's blanket-public `/api/auth/` prefix, so it was reachable with zero authentication in any environment, including production.
- **SECURITY IMPACT:** Critical — worse than Finding A, since it required no password at all (`curl -X POST /api/auth/dev-quick-login` with no body).
- **REMEDIATION:** Fixed. See Section 3.

### Finding H (new, discovered this session) — Bearer token signature never verified in middleware (root trust-boundary bypass)
- **FILE:** [middleware.ts](middleware.ts)
- **FUNCTION/ROUTE:** `buildVerifiedHeaders()`
- **EVIDENCE (before fix):** The function `atob()`-decoded only the JWT *payload* and accepted **any** string after the last `.` as a valid "signature" — the HMAC was never actually checked. Any of the 24+ routes using `lib/authorize.ts` or `lib/auth-tenant-context.ts` (which trust `x-verified-*` headers set by this function) were fully bypassable with a self-forged token: `base64url(JSON.stringify({tenant_id:'X', role:'founder', ...})) + '.garbage'`.
- **SECURITY IMPACT:** Critical — this was the single root cause enabling privilege escalation and cross-tenant access across the entire authenticated API surface, independent of Findings A/B/C.
- **REMEDIATION:** Fixed. See Section 3. (Fixing required solving a second, previously-undocumented bug — see Section 5, "Edge Runtime crypto pitfall".)

### Finding I (new, discovered this session) — Systemic client-controlled tenant-header trust across ~41 individual API routes
- **EVIDENCE:** `grep -rlE "headers.get\('x-tenant-id'\)|headers.get\('X-Tenant-ID'\)" app/api` matches **41 distinct route files** (HR, finance, corrosion, material-requests, intelligence, workspace, internal-mail, etc.) that read the raw client `x-tenant-id`/`X-Tenant-ID` header **directly**, independent of `middleware.ts` and independent of the now-fixed `x-verified-tenant-id`. A few (`degradation-zones`, `high-risk-assets`, `urgent-actions`, `archive-stats`) already prefer `x-verified-tenant-id` first with a client-header fallback; most do not check the verified header at all.
- **SECURITY IMPACT:** Critical, and **larger in scope than the original 6-finding list** — even with middleware, `authorize.ts`, and the catch-all proxy fixed, these 41 routes remain independently vulnerable to client-supplied tenant-header spoofing.
- **REMEDIATION:** **Not fixed in Phase 0** — fixing all 41 files individually is a large, wide-blast-radius change that would violate the "incremental, do not start a broad rewrite" instruction and could not be safely tested one-by-one within this phase. This is the **top recommended Phase 1 priority** (Section 12).

### Finding J (new, discovered this session) — `.env.local` (containing real secrets) is git-tracked and already pushed to a remote
- **EVIDENCE:** `.gitignore` had no `.env*` entry. `git log --oneline -- .env.local` shows multiple historical commits. `git merge-base --is-ancestor <last .env.local commit> origin/feat/flutter-windows-ci` returned true — **confirmed already pushed** to `https://github.com/Alhadi706/cloudflare-docs.git`. Tracked secrets include `STAFF_API_KEY`, `PLANET_API_KEY`, `BACKEND_URL`.
- **SECURITY IMPACT:** Critical, out-of-band of the identity/auth system itself — these secrets must be treated as **already compromised** if that remote/branch is not strictly private and access-controlled.
- **REMEDIATION (partial):** `.env.local` added to `.gitignore` and untracked going forward via `git rm --cached` (safe, reversible, no history rewrite, nothing pushed). **Full remediation (secret rotation, possible git-history rewrite) requires the user's decision** — not performed here since history rewriting is destructive and rotating `STAFF_API_KEY`/`PLANET_API_KEY` may affect the external backend/Planet integration in ways this agent cannot verify. **CANNOT CONFIRM** repo visibility (public/private) without checking GitHub directly.

## 2. Findings Disproved / Refined
- The prior audit's/remediation-plan's claim that "middleware sanitizes inbound x-verified-* headers" was **partially true, partially misleading**: header *names* were indeed always overwritten (a client cannot literally name a header `x-verified-tenant-id` and have it survive), but the *values* placed into those headers were themselves attacker-forgeable (Finding H) or, in the fallback path, sourced from a client header (Finding B-equivalent inside `middleware.ts`'s `buildCookieVerifiedHeaders()`). This distinction is why the vulnerability existed despite that claim.
- `app/api/auth/session/route.ts` was suspected as a possible weak point; on inspection it was **already correctly implemented** (full `verifyAuthToken()` check before setting httpOnly cookies) and required no change.

## 3. Files Changed
| File | Change |
|---|---|
| [middleware.ts](middleware.ts) | `buildVerifiedHeaders()` now cryptographically verifies the Bearer token via `verifyAuthTokenEdge()` instead of decoding the payload only; `middleware()` is now `async`. `buildCookieVerifiedHeaders()` no longer falls back to the client `X-Tenant-ID` header when the `tenant_id` cookie is absent (fails closed instead). |
| [lib/auth-tokens.ts](lib/auth-tokens.ts) | Removed hardcoded fallback secret (`getSecret()` now throws if `AUTH_SECRET` unset). Added `verifyAuthTokenEdge()` — a Web-Crypto-API (`crypto.subtle`) based verifier for use in Edge Runtime (middleware), alongside the existing Node-`crypto`-based `verifyAuthToken()` used by the 22 existing Node-runtime route handlers (left unchanged to minimize blast radius). |
| [lib/owner-auth.ts](lib/owner-auth.ts) | Removed its own different hardcoded fallback secret (`'sovereign-dev-secret'`); now requires the same `AUTH_SECRET` as `lib/auth-tokens.ts` (previously two different fallback strings existed for the same purpose — now unified). |
| [app/api/auth/admin-login/route.ts](app/api/auth/admin-login/route.ts) | Removed hardcoded bootstrap password fallback; removed the route's own duplicate HMAC token-minting function (`makeToken`) in favor of the shared `makeAuthToken()` from `lib/auth-tokens.ts`. Bootstrap-password branch is now a no-op unless an operator explicitly sets `ADMIN_BOOTSTRAP_PASSWORD` (no default value, no replacement backdoor). |
| [app/api/auth/dev-quick-login/route.ts](app/api/auth/dev-quick-login/route.ts) | Added an explicit `process.env.DEV_PORTAL_ENABLED === '1'` gate (reusing the existing dev-portal convention) — returns 403 otherwise. |
| [app/api/[...path]/route.ts](app/api/%5B...path%5D/route.ts) | `resolveTenantId()`/hardcoded-role logic replaced with `resolveVerifiedTenantId()`/`resolveVerifiedRole()`, which read **only** the middleware-verified `x-verified-tenant-id`/`x-verified-role` headers. Added an explicit 401 guard when no verified tenant is present. The GET handler's `x-user-id`/`x-user-role` client-header passthrough (with insecure `'system'`/`'admin'` defaults) was also replaced with verified values. |
| `.env.local` | Added a real, randomly-generated `AUTH_SECRET` (48 random bytes, base64url) so removing the hardcoded fallback doesn't break this dev environment. |
| `.gitignore` | Added `.env.local` / `.env*.local` (previously untracked-but-should-have-been; see Finding J). |
| (git index) | `.env.local` untracked via `git rm --cached` (working file untouched, nothing committed/pushed). |

**Not changed (explicitly, by design):** `app/api/org/departments/route.ts` (confirmed cross-tenant leak, Finding from prior audit) was left untouched — fixing it means editing Departments-domain query logic, which is explicitly out of Phase 0 scope per the user's own STOP condition. Documented as top Phase 1 priority instead of silently fixed.

## 4. Database Migrations Created
**None.** Per explicit instruction not to blindly add RLS. See Section 8.

## 5. Security Changes (detailed evidence)

### Change 1 — `dev-quick-login` gate
- FILE: `app/api/auth/dev-quick-login/route.ts` / FUNCTION: `POST`
- BEFORE: unconditionally minted an `admin`/founder token.
- AFTER: `if (process.env.DEV_PORTAL_ENABLED !== '1') return 403`.
- REASON: closes an unauthenticated privilege-escalation backdoor (Finding G).
- SECURITY IMPACT: Critical → closed.
- TEST: `curl -X POST /api/auth/dev-quick-login` → **403** `{"detail":"dev_quick_login_disabled"}` (previously 200 + valid admin token). **RESULT: PASS.**

### Change 2 — Admin bootstrap password
- FILE: `app/api/auth/admin-login/route.ts` / FUNCTION: `POST`
- BEFORE: `ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'SovereignAdmin2026!'`.
- AFTER: `ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || ''`, and the bootstrap branch only runs `if (ADMIN_PASSWORD && password === ADMIN_PASSWORD)`.
- REASON: eliminates the hardcoded credential without introducing a new one; operator can still configure a real bootstrap secret out-of-band if genuinely needed.
- SECURITY IMPACT: Critical → closed.
- TEST: `curl -d '{"password":"SovereignAdmin2026!"}' /api/auth/admin-login` → **401** `"كلمة مرور غير صحيحة"` (previously 200 + `super_admin` token). **RESULT: PASS.**

### Change 3 — Middleware Bearer signature verification (root fix)
- FILE: `middleware.ts` / FUNCTION: `buildVerifiedHeaders()`
- BEFORE: payload-only `atob()` decode, no signature check.
- AFTER: `await verifyAuthTokenEdge(token)` — full HMAC-SHA256 verification via Web Crypto; returns `null` (untrusted) on any signature mismatch.
- REASON: establishes middleware as the single authoritative point that produces `x-verified-*` headers, closing Finding H for all 24+ downstream consumers at once.
- SECURITY IMPACT: Critical → closed.
- TEST: forged token `base64url({tenant_id:B, role:'founder',...}) + '.not-a-real-signature'` sent to `/api/org/departments` → **401** `unauthorized` (previously would have been trusted). A correctly-signed token for a real tenant/user → `x-verified-tenant-id`/`x-verified-role` correctly populated, then normal RBAC applies (403 for insufficient permission, not a trust bypass). **RESULT: PASS** (10 distinct curl-based tests executed; see Section 9/10).

### Change 4 — Edge Runtime crypto pitfall (blocking bug found & fixed while implementing Change 3)
- FILE: `lib/auth-tokens.ts` / FUNCTION: `verifyAuthTokenEdge()` (new)
- BEFORE (first attempt): used `crypto.createHmac()` — inherited from the module-level `import crypto from 'crypto'`. This **shadowed** the global Web Crypto `crypto` object, so `crypto.subtle` inside this function actually resolved to Node's `crypto` module namespace, which Next.js's Edge Runtime explicitly blocks (`Error: The edge runtime does not support Node.js 'crypto' module`) — confirmed by direct diagnostic test.
- AFTER: uses `globalThis.crypto.subtle` explicitly, bypassing the shadowing import, guaranteeing the real Web Crypto API is used.
- REASON: without this, a signature-verifying middleware fix would have **silently rejected every valid token** (fail-closed but functionality-breaking) — this was caught by testing before shipping, not assumed.
- SECURITY IMPACT: N/A (correctness fix required to make Change 3 actually work in production, not just in `next dev`'s Node-runtime route handlers).
- TEST: before this fix, a validly-signed token verified correctly in a Node-runtime debug route but returned `null` when the identical check ran inside middleware (Edge runtime) — isolated via a temporary diagnostic route (removed after use). After the fix, both paths agree. **RESULT: PASS.**

### Change 5 — Cookie-based tenant fallback removed (fail closed)
- FILE: `middleware.ts` / FUNCTION: `buildCookieVerifiedHeaders()`
- BEFORE: if the `tenant_id` cookie was absent, fell back to the client-supplied `X-Tenant-ID` request header (validated only by UUID shape, not ownership).
- AFTER: returns `null` (no verified headers set) if `tenant_id` cookie is absent — no header fallback.
- REASON: tenant context must never be client-suppliable (explicit Phase 0 rule).
- SECURITY IMPACT: Critical → closed.
- TEST: `auth_session` cookie present, `tenant_id` cookie absent, `X-Tenant-ID: <attacker-tenant>` header sent → **401** (previously would have leaked the attacker-chosen tenant into `x-verified-tenant-id`). **RESULT: PASS.**

### Change 6 — API proxy tenant/role resolution
- FILE: `app/api/[...path]/route.ts` / FUNCTIONS: `resolveTenantId()`→`resolveVerifiedTenantId()`, `tenantHeaders()`
- BEFORE: `X-Tenant-ID` client header/cookie trusted directly; `'X-User-Role': 'super_admin'` hardcoded always.
- AFTER: reads only `x-verified-tenant-id`/`x-verified-role` (middleware-verified); 401 if no verified tenant.
- REASON: proxy must never manufacture elevated privileges or trust client-chosen tenants (Findings B & C).
- SECURITY IMPACT: Critical → closed for this proxy. **CANNOT CONFIRM** how the external backend (source code outside this repo, at `~/digital_employees/backend`) behaves when it receives a real (non-`super_admin`) role — flagged as a residual risk (Section 11).
- TEST: unauthenticated request with forged `X-Tenant-ID` header to an unmatched `/api/*` path → **401** (previously would have been forwarded with `super_admin` + attacker tenant). Authenticated request with a valid tenant-A token + forged `X-Tenant-ID: B` header → resolves to tenant A (verified header), reaches the backend, gets a normal 404 for the made-up path (proving it passed the auth gate using the *correct* tenant, not the attacker's). **RESULT: PASS**, with the backend-compatibility caveat above.

### Change 7 — Shared-secret consolidation
- FILES: `lib/auth-tokens.ts`, `lib/owner-auth.ts`, `app/api/auth/admin-login/route.ts`
- BEFORE: three independent HMAC implementations with two different hardcoded fallback secret strings (`'sovereign-dev-secret-change-in-production'` vs `'sovereign-dev-secret'`) plus a third ad-hoc implementation inline in `admin-login`.
- AFTER: all three now require the same `AUTH_SECRET` (no fallback); `admin-login` reuses `makeAuthToken()` instead of its own duplicate signer.
- REASON: "establish one authoritative source of authenticated identity" (Phase 0 Objective 3).
- SECURITY IMPACT: Medium (defense-in-depth / consistency) → improved.
- TEST: `admin-login` → `makeAuthToken()` → `/api/auth/session` → `verifyAuthToken()` round-trip confirmed working end-to-end (Test 7/9 below). **RESULT: PASS.**

## 6. Identity Model Established
Per instruction, **no new parallel identity model was created**. The canonical model, based on the existing database, is defined as:

```
User  (public.auth_users — 231 rows, LIVE/authoritative)
  │
  ├─ email + role + hashed_password/password_salt (credentials)
  │
  └─ Membership  (public.auth_users.tenant_id — currently a 1:1 embedded FK,
       not a separate join table)
        │
        └─ Organization/Tenant  (public.auth_tenants — 15 rows, text id;
             THIS is the table auth_users.tenant_id actually references)
```

- **Canonical entity for "tenant/organization":** `public.auth_tenants` (NOT `public.tenants`, which is a disconnected, 3-row, uuid-keyed table with no live consumers).
- **Canonical identifier:** `auth_tenants.id` (text), referenced by `auth_users.tenant_id`.
- **Relationship:** currently embedded 1:1 (`auth_users.tenant_id` is a direct FK-like column, not a join/membership table) — there is **no real many-to-many Membership table yet**. `public.user_roles` exists with proper FKs (21 rows) but is unused by any live code path and could become this Membership table's foundation.
- **Migration strategy (proposed, not executed):** (1) do not touch `public.tenants`/`public.users`/`public.roles`/`public.user_roles` yet; (2) introduce a real `membership` concept only when department/section provisioning (a future phase) needs many-to-many user↔tenant↔department relationships; (3) `public.tenants` and `public.auth_tenants` should NOT be merged/deleted until every consumer of `public.tenants` (if any exist — none were found live) is confirmed absent.

## 7. Tenant Resolution Mechanism (after Phase 0)
Single authoritative flow, enforced entirely inside `middleware.ts`:
1. If `Authorization: Bearer <token>` is present → `verifyAuthTokenEdge(token)` (real HMAC-SHA256 check via Web Crypto) → `x-verified-tenant-id` set **only** from the verified token's `tenant_id` claim.
2. Else, if `auth_session` httpOnly cookie is present → `x-verified-tenant-id` set **only** from the httpOnly `tenant_id` cookie (itself only ever set by `/api/auth/session` after independently verifying a Bearer token) — no client-header fallback.
3. Otherwise → no `x-verified-*` headers are set; `authorize()`/`resolveAuthTenantContext()`/the API proxy all reject with 401 when `tenantId`/`role` are missing.
All 24+ routes using `lib/authorize.ts`, `lib/auth-tenant-context.ts`, and the catch-all proxy now transitively benefit from this single choke point without per-route changes.
**Known gap (Finding I):** 41 route files bypass this mechanism entirely by reading `x-tenant-id` directly — see Section 11/12.

## 8. RLS Changes
**None implemented.** Per instruction, RLS was not blindly added. Analysis performed (not yet actioned):
- All 22 previously-identified tables remain **tenant-scoped** in intent (each has a `tenant_id` column) but have `rowsecurity = false`.
- Implementing correct RLS requires the application to `SET LOCAL app.tenant_id = <verified tenant>` per request (e.g., in `lib/db-pg.ts`'s connection/query wrapper) so policies can reference `current_setting('app.tenant_id')`. **This wiring does not currently exist anywhere in the codebase** (confirmed via grep — no `SET LOCAL app.` pattern found). Enabling RLS without this wiring first would break 100% of existing queries (they'd see zero rows, since no session variable would ever be set), which violates "preserve existing functionality."
- **Recommendation (Phase 1):** (1) add the `SET LOCAL` session-variable wiring first, in isolation, with its own tests; (2) only then enable RLS table-by-table, starting with the lowest-traffic tables, each with its own before/after row-count test.

## 9. Tests Executed
All tests were executed as live `curl` requests against a running `next dev` instance (port 3001) plus one live-DB read query, after the fixes above and after removing all temporary diagnostic code. Mapped to the user's requested 10 scenarios:

| # | Scenario | Executed? | Method |
|---|---|---|---|
| 1 | Normal authenticated user login | Yes | Minted a validly-signed token for a real DB user (`qa.assets.user.1781093068@d-me.ly`, role `member`, tenant `INFRA_OPS`) → `POST /api/auth/session` → cookies set → protected route reached with correct identity. |
| 2 | Platform admin authentication | Partial | Verified the bootstrap-password branch is now disabled by default (Test 2). The DB-backed `founder`/`admin` password path was **not** exercised end-to-end — **CANNOT CONFIRM** without a real admin/founder password, which was not available/guessed. |
| 3 | Organization admin authentication | Partial | Same mechanism as #2 (role-based, not org-specific in this codebase) — **CANNOT CONFIRM** for the same reason. |
| 4 | User A cannot access Tenant B | Partial | Confirmed the *mechanism* now prevents it (verified-tenant-only resolution) via forged-token and header-override tests. Did **not** find/construct a real, currently-tenant-isolated data endpoint to prove an actual cross-tenant data read is blocked end-to-end, since the one concrete example found (`org/departments`) is **known to leak cross-tenant** (Finding I / prior audit) and was left unfixed (Departments domain, out of Phase 0 scope). **Marked CANNOT FULLY CONFIRM — see Section 11.** |
| 5 | JWT(A) + tenant_id(B) is denied | Yes | Forged token with `tenant_id=B`, garbage signature → 401 on a protected route. |
| 6 | JWT(A) + organization_id(B) is denied | N/A | This codebase has no separate `organization_id` claim distinct from `tenant_id` — same test as #5 covers this. |
| 7 | Client-supplied tenant headers cannot override membership | Yes | `X-Tenant-ID: <fake>` header sent alongside a valid tenant-A session/token → verified header remained tenant A; alone (no session) → 401. |
| 8 | Client cannot obtain super_admin via headers/params/body/cookies/localStorage | Yes | `dev-quick-login` blocked (403); hardcoded admin password rejected (401); proxy no longer hardcodes `X-User-Role: super_admin` (forwards real verified role, confirmed `member` in test). |
| 9 | Unauthorized users cannot access privileged routes | Yes | Forged/missing token → 401; valid token with insufficient role → 403 (`لا تملك صلاحية: user.review`). |
| 10 | API and DB enforce the same authorization model | No — **confirmed FAIL, by design/scope** | RLS is disabled on all 22 tables (Finding D, unresolved). Only the API layer enforces authorization; the database enforces none. This is an accurate, honest gap, not an oversight — seeSection 8. |

## 10. Test Results (raw)
```
T1  dev-quick-login blocked (no DEV_PORTAL_ENABLED):        403  PASS
T2  admin-login rejects old hardcoded password:             401  PASS
T3  forged/unsigned Bearer token on protected route:         401  PASS
T4  valid signed token, role=member, lacks permission:       403  PASS (proves tenant/role WERE resolved correctly, then correctly denied by RBAC)
T5  /api/auth/session accepts a real valid token:            200  PASS (httpOnly cookies set correctly)
T6  /api/auth/session rejects forged token:                  401  PASS ("invalid_token")
T7  catch-all proxy, no verified tenant, forged header:      401  PASS (attacker header ignored)
T8  cookie-based path, tenant_id cookie missing + forged
    X-Tenant-ID header (previously the exact leak path):     401  PASS (fails closed)
T9  cookie-based session (real) reaches same protected
    route with correct role enforcement:                     403  PASS (same as T4, via cookie path not Bearer)
T10 production build (`next build`) — Edge Runtime bundling
    of the new middleware code:                          SUCCESS  PASS (Middleware: 49.6 kB, no edge-runtime errors, all routes compiled)
```

## 11. Remaining Risks
1. **Finding I (41 routes)** — client `x-tenant-id` header trust remains live and exploitable in ~41 individual route files outside the choke points fixed in Phase 0. **This is the single largest remaining risk.**
2. **`org/departments` cross-tenant leak** — confirmed, unresolved, explicitly left alone (Departments domain, out of scope).
3. **RLS absent DB-wide** — API is the only enforcement layer; a bug in any of the 41+ routes above is a full bypass with no DB-level backstop.
4. **External backend compatibility** — `CANNOT CONFIRM` whether the backend at `~/digital_employees/backend` (source outside this repo) behaves safely now that it receives real, non-`super_admin` roles via the proxy; needs monitoring/testing against that service directly by someone with access to its source.
5. **`.env.local` secret exposure (Finding J)** — `STAFF_API_KEY`, `PLANET_API_KEY`, and the newly-added `AUTH_SECRET` are in a file that has already been pushed to a remote GitHub repo in its history. **Recommend immediate action by the user**: rotate `STAFF_API_KEY`/`PLANET_API_KEY` (and prevent the new `AUTH_SECRET` from ever being pushed — it currently only exists in the untracked working copy), and decide whether git history rewriting is warranted (destructive, not performed here).
5b. Because `AUTH_SECRET` is new, all sessions signed before this change (if any existed on the old hardcoded fallback) are now invalid — expected/secure, but note if any real users had active sessions in this dev environment, they will need to log in again.
6. **Bootstrap DB-based admin/founder login was not end-to-end tested** (no test credentials available) — logic was read-verified but not live-tested; marked `CANNOT CONFIRM` rather than assumed working.
7. **Three parallel user stores and two tenant tables remain un-consolidated** (Findings E/F) — by design, deferred.
8. A minor scope note: `app_scope` in `/api/auth/session` is still read from the request body rather than verified claims (low risk — UI-scoping preference only, not an identity/permission boundary) — flagged, not changed, since it was outside the specific list of critical findings and touching it wasn't necessary to close any of A–J.

## 12. Recommended Phase 1
Priority order:
1. **Close Finding I**: migrate the 41 routes reading `x-tenant-id`/`X-Tenant-ID` directly to use `x-verified-tenant-id` instead, one domain at a time (e.g., HR routes together, then finance, then corrosion...), each with its own before/after test — this is the largest real remaining attack surface.
2. **Fix the `org/departments` cross-tenant leak** (add `WHERE tenant_id = $1` using the verified tenant) — small, isolated, high-value fix, but intentionally deferred here since it is Departments-domain per the user's own scope boundary.
3. **RLS session-variable wiring**: add `SET LOCAL app.tenant_id` (or equivalent) to the shared DB query path, with its own tests, as a prerequisite before any table gets real RLS policies.
4. **Rotate exposed secrets** (`STAFF_API_KEY`, `PLANET_API_KEY`) and decide on git-history remediation (Finding J) — this is time-sensitive and independent of the Departments/Sections roadmap.
5. Consolidate `public.auth_tenants` vs `public.tenants` and the three user stores, once a real Membership table design is needed for Department/Section provisioning (the next planned phase after this).
6. Add automated regression tests (the 10 curl-based tests in Section 9 as a permanent `tsx` script) so future changes to `middleware.ts`/`lib/authorize.ts` can be re-verified in seconds.

---

## Side question (Arabic) — is the current login system appropriate, or overly complex?

الجواب الصريح: **النظام الحالي أعقد مما ينبغي، وهذا التعقيد هو نفسه ما سمح بالثغرات الحرجة التي تم إصلاحها في هذه المرحلة.** الأسباب المحددة:

1. **ثلاثة تطبيقات مستقلة لتوقيع HMAC** كانت موجودة لنفس الغرض بالضبط (`lib/auth-tokens.ts`, `lib/owner-auth.ts`, ودالة محلية داخل `admin-login`) — بأسرار احتياطية مختلفة الصياغة. هذا التكرار هو بالضبط نوع التعقيد الذي يؤدي إلى ثغرات (تم توحيدها جزئياً في هذه المرحلة).
2. **طبقتان للتحقق من الهوية** (`x-verified-*` عبر middleware، ثم فحص مباشر لـ `x-tenant-id`/`X-Tenant-ID` في 41 ملف route منفصل) — بدل نقطة تحقق واحدة موثوقة، النظام يحتوي فعلياً على عشرات نقاط الثقة المستقلة، وهذا يجعل من المستحيل تقريباً التأكد من أمان النظام ككل دفعة واحدة.
3. **مخزنان منفصلان للمستأجرين (tenants)** و**ثلاثة مخازن للمستخدمين** — تعقيد بنيوي غير ضروري نتج على الأرجح من تطور تدريجي غير مخطط له، وليس من تصميم مقصود.
4. **الاعتماد على middleware يعمل في Edge Runtime** مع مكتبة تشفير مبنية أساساً على `crypto` الخاص بـ Node — هذا تسبب فعلياً في خطأ صامت (تم اكتشافه وإصلاحه في هذه الجلسة) كان سيجعل الإصلاح الأمني نفسه يفشل بصمت لولا الاختبار المباشر.

**البديل الأبسط الموصى به (لمرحلة لاحقة، ليس الآن):** آلية توقيع واحدة (JWT قياسي أو نفس آلية HMAC الحالية لكن نسخة واحدة فقط)، تُستخدم من نقطة تحقق واحدة فقط (middleware)، مع RLS على مستوى قاعدة البيانات كخط دفاع ثانٍ حقيقي (وليس نظرياً كما هو الآن)، وجدول Membership حقيقي واحد بدل الاعتماد المباشر على عمود `tenant_id` داخل جدول المستخدمين. هذا التبسيط ليس ترفاً معمارياً — بل هو ما كان سيمنع معظم الثغرات المكتشفة في هذه المرحلة من الأساس.
