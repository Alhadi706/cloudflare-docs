# تدقيق شامل: بنية الهوية / المؤسسات / الأدوار / الصلاحيات — DSP
**نوع الوثيقة:** تدقيق اكتشاف فقط (Discovery & Architecture Audit) — لا يحتوي على أي إصلاح.
**المنهجية:** كل ملاحظة مبنية على دليل فعلي: قراءة كود المصدر + استعلامات قراءة فقط (`SELECT`) مباشرة على قاعدة البيانات الحقيقية `digital_employees` (PostgreSQL على `localhost:5433`). لم يتم تعديل أي ملف أو أي سطر في قاعدة البيانات أثناء هذا التدقيق.
**كل نتيجة تحمل إما دليلاً محدداً (ملف/سطر/جدول/عدد صفوف) أو تصنيف صريح "CANNOT CONFIRM" حيث لا يوجد دليل كافٍ.**

---

## 1. الملخص التنفيذي (Executive Summary)

النظام مبني فعلياً على **ثلاثة أنظمة هوية متوازية غير متصالحة** تعمل في نفس الوقت:
1. نظام JSON محلي (`.data/*.json`) — `lib/user-store.ts` + `lib/tenant-store.ts`.
2. نظام Postgres "مسطّح" بدون علاقات مرجعية حقيقية بين جداوله — `public.auth_users` + `public.auth_tenants` (هذا هو النظام **الحي فعلياً**، فيه 231 مستخدم و15 مؤسسة).
3. نظام Postgres "علائقي" كامل بمفاتيح خارجية حقيقية — `public.users` + `public.tenants` + `public.roles` + `public.permissions` + `public.user_roles` — **مصمم بشكل سليم لكنه غير مستخدم فعلياً** من قبل أي مسار تفويض حي في الكود (`lib/authorize.ts`, `lib/permissions.ts` لا يستعلمان عنه إطلاقاً).

**أخطر اكتشاف واحد (يفسر أصل مشكلة "الإدارة كمنصة مستقلة"):**
جداول هيكل الإدارات/الأقسام الحقيقية في قاعدة البيانات (`workspace.departments`, `admin_core.departments`) تحتوي على بيانات **لمؤسسة واحدة فقط** من أصل ما لا يقل عن 13 مؤسسة موجودة فعلياً في `auth_users` (`tenant_id = aaaaaaaa-0000-4000-a000-000000000001`، أي "dsf/INFRA_OPS"). لكل مؤسسة أخرى — **صفر سجلات إدارات، صفر سجلات أقسام** في قاعدة البيانات. هيكل الإدارات/الأقسام الذي يراه المستخدم فعلياً في كل الحالات الأخرى يأتي من مصفوفة ثابتة في الكود (`DEPT_STRUCTURE` في مسار الموافقة على طلب التأسيس) تُستخدم فقط لإدخال صفوف مستخدمين في `auth_users` — ولا تُنشئ أي سجل إدارة/قسم حقيقي مرتبط بالمؤسسة الجديدة. هذا هو السبب الجذري لعدم قدرة كل إدارة على الظهور كمنصة مستقلة ذات هيكل خاص بها.

**ثاني أخطر اكتشاف:** لا يوجد أي حماية Row-Level Security (RLS) مفعّلة على أي جدول من جداول الهوية/المؤسسات في قاعدة البيانات بأكملها (تم التحقق من 22 جدولاً — كل قيمة `rowsecurity = false`). العزل بين المؤسسات يعتمد 100% على انضباط الكود في كتابة `WHERE tenant_id = ...`، وتم إثبات أن هذا الانضباط **مفقود فعلياً** في مسار حي واحد على الأقل (`app/api/org/departments/route.ts`).

**ثالث اكتشاف خطير:** كلمة مرور احتياطية ثابتة في الكود المصدري (`SovereignAdmin2026!` في `app/api/auth/admin-login/route.ts`) تمنح صلاحية `super_admin` لأي شخص يعرفها، بغض النظر عن البريد الإلكتروني أو المؤسسة.

---

## 2. البنية الحالية للمصادقة (Authentication Architecture)

| العنصر | الملف | الدليل |
|---|---|---|
| توليد/تحقق التوكن الرئيسي | `lib/auth-tokens.ts` | `makeAuthToken()`/`verifyAuthToken()` — base64url JSON + HMAC-SHA256، السر `AUTH_SECRET` مع احتياطي ثابت بالكود `'sovereign-dev-secret-change-in-production'` |
| توكن مالك المنصة (منفصل تماماً) | `lib/owner-auth.ts` | `verifyOwnerToken()` — نفس آلية HMAC لكن سر احتياطي مختلف الصياغة: `'sovereign-dev-secret'` (وليس `'sovereign-dev-secret-change-in-production'`) — **قيمتان احتياطيتان مختلفتان لنفس الغرض في ملفين مختلفين** |
| توكن admin-login (تطبيق ثالث لنفس الفكرة) | `app/api/auth/admin-login/route.ts` سطر 12-16 | `makeToken()` محلي داخل نفس الملف — تطبيق HMAC ثالث مستقل بنفس المنطق تقريباً، بدل استدعاء `lib/auth-tokens.ts` |
| التحقق في الوسيط (middleware) | `middleware.ts` | `buildVerifiedHeaders()` يفك ترميز الـ payload من الـ Bearer token **بدون التحقق الكامل من التوقيع HMAC** (تعليق صريح بالكود: "We do a payload-only decode here"). `buildCookieVerifiedHeaders()` بديل يعتمد على كوكيز خام (`tenant_id`, `user_role`, ...) |
| تفويض الطلبات (authorize) | `lib/authorize.ts` | يثق بالكامل بـ headers `x-verified-*` التي وضعها middleware، **لا يعيد التحقق من التوقيع** بشكل مستقل — سلسلة الثقة بأكملها تعتمد على أن middleware قام بالتحقق مرة واحدة فقط |

**مشكلة:** ثلاث تطبيقات مستقلة لنفس آلية HMAC signing (`lib/auth-tokens.ts`, `lib/owner-auth.ts`, `admin-login/route.ts` محلياً) بدل تطبيق واحد مُعاد استخدامه. أي تغيير مستقبلي في منطق التوقيع يجب أن يُطبّق يدوياً في 3 أماكن.

---

## 3. البنية الحالية للمؤسسة/المستأجر (Organization/Tenant Architecture)

### الدليل من قاعدة البيانات الفعلية (وليس تخميناً):

يوجد **جدولان منفصلان تماماً** يمثلان "المؤسسة" في نفس قاعدة البيانات، وهما **غير متقاطعين إطلاقاً**:

| الجدول | PK | نوع PK | عدد الصفوف | من يستخدمه فعلياً |
|---|---|---|---|---|
| `public.auth_tenants` | `id` | `text` | **15** | `lib/tenant-store.ts` (JSON عادةً) + كل مسارات auth الحية (`login-credentials`, `tenant-requests/approve`) عبر `auth_users.tenant_id` |
| `public.tenants` | `tenant_id` | `uuid` | **3** (`MAIN_ORG`, `demo-company-2026`, `DEMO_001`) | مرجع لـ `workspace.departments.tenant_id`, `public.users`, `public.roles`, `public.user_roles` عبر مفاتيح خارجية حقيقية — نظام RBAC علائقي كامل **غير مستخدم في مسار التفويض الحي** |

**دليل قاطع على الانفصال:** تم أخذ عينة من `auth_users.tenant_id` (مثال: `c2c3bdef-0f73-48a0-a507-74132b392afb` وهو tenant_code=`mobile-qa-tenant-a`) — هذه القيمة موجودة في `auth_tenants.id` لكنها **غير موجودة إطلاقاً** في `public.tenants.tenant_id`. بمعنى آخر: عندما يسجّل مستخدم دخول عبر `/api/auth/login-credentials`، فإن `tenant_id` الخاص به لا علاقة له بجدول `public.tenants` المرتبط فعلياً بجداول الأقسام/الأدوار العلائقية.

**نتيجة:** "المؤسسة" في هذا النظام لها **تعريفان منفصلان لا يعرف أحدهما بوجود الآخر**. أي كود يفترض أن `tenant_id` من الجلسة يمكن ربطه بـ `public.tenants` (لجلب أقسام أو أدوار علائقية) سيفشل بصمت لأن كل المستخدمين الحقيقيين مرتبطون بـ `auth_tenants` فقط.

### طبقة JSON إضافية (`lib/tenant-store.ts`)
ملفات: `.data/tenants.json`, `.data/tenant_requests.json`, `.data/tenant_department_links.json`, `.data/tenant_join_requests.json`. هذه بنية **رابعة** موازية تصف نفس المفاهيم (Tenant, TenantRequest, TenantDepartmentLink, TenantJoinRequest) بمعزل عن أي من جدولي `auth_tenants`/`tenants` في قاعدة البيانات، وتُقرأ/تُكتب حصراً كملفات على القرص ما لم يُفعّل `AUTH_STORE_BACKEND=pg` (وهو **غير مضبوط في `.env.local`**، فالقيمة الفعلية الافتراضية هي `'json'` — تم التحقق: `lib/auth-store-backend.ts` سطر 20: `AUTH_BACKEND = process.env.AUTH_STORE_BACKEND || 'json'`).

**تناقض إضافي:** رغم أن الافتراضي هو `'json'`، فإن مسارات حية فعلية (`login-credentials/route.ts`, `admin-login/route.ts`, `onboarding/tenant-requests/[id]/approve/route.ts`) **تتجاوز طبقة `auth-store-backend.ts` بالكامل** وتستعلم مباشرة عبر `pgPool` من `auth_users`/الجداول المرتبطة — بغض النظر عن قيمة `AUTH_STORE_BACKEND`. هذا يعني أن مبدل الخلفية (json/pg) **ميت فعلياً** لهذه المسارات تحديداً — طبقة تجريد غير مستخدمة باستمرار.

---

## 4. تدفق التسجيل الحالي (Registration Flow)

مسارات مكتشفة:
- `app/api/onboarding/tenant-request/route.ts` (تقديم طلب تأسيس مؤسسة جديدة)
- `app/api/onboarding/tenant-requests/route.ts` (قائمة الطلبات لمالك المنصة)
- `app/api/onboarding/tenant-requests/[id]/approve/route.ts` (الموافقة)

**دليل من `approve/route.ts`:** عند الموافقة، الكود يحتوي على مصفوفة ثابتة بالكامل `DEPT_STRUCTURE` (7 إدارات × 3-4 أقسام لكل إدارة = ما مجموعه نحو 26 قسماً) مكتوبة حرفياً في هذا الملف. دالة `insertUser()` (سطر ~100) تُدرج مباشرة في `auth_users` فقط — **لا يوجد أي `INSERT INTO workspace.departments` أو `admin_core.sections` أو أي جدول أقسام/إدارات** في مسار الموافقة بأكمله.

**الدليل الكمي القاطع (من قاعدة البيانات الفعلية):**
```
workspace.departments  → tenant_id واحد فقط: aaaaaaaa-0000-4000-a000-000000000001 (15 صف)
admin_core.departments → نفس tenant_id فقط                                        (5 صف)
admin_core.sections    → 0 صف على الإطلاق (فارغ تماماً لكل المؤسسات)
hr_core.departments    → 0 صف على الإطلاق
```
بينما `auth_users` يحتوي على مستخدمين لـ 13+ مؤسسة مختلفة (`ORG-I47FQJ`, `ORG-0EG2ZN`, `mobile-qa-tenant-a/b/c`, `21-6`, `20-6`, ...إلخ).

**الخلاصة الحاسمة:** الموافقة على مؤسسة جديدة تُنشئ **مستخدمين لديهم `department_code` كنص فقط** — لا تُنشئ أي سجل إدارة/قسم فعلي في أي جدول علائقي. الهيكل التنظيمي "المستقل" لكل مؤسسة غير موجود في قاعدة البيانات إطلاقاً باستثناء المؤسسة الاختبارية الوحيدة (dsf/INFRA_OPS) التي يبدو أنها زُرعت يدوياً وليس عبر تدفق الموافقة البرمجي.

---

## 5. تدفق الموافقة (Approval Flow)

- المصادقة على مسار الموافقة تتم عبر `verifyOwnerToken()` فقط (نظام "مالك المنصة" المنفصل، انظر القسم 6) — **لا علاقة له بنظام RBAC العادي** (`lib/rbac.ts`/`lib/authorize.ts`).
- لا يوجد أي تحقق من `authorize()` أو فحص صلاحية `tenant.approve` (المعرّفة في `lib/permissions.ts`) في هذا المسار — الاعتماد الوحيد هو ملكية توكن `owner`.
- CANNOT CONFIRM: هل هناك حد أقصى لعدد المحاولات/تدقيق (audit log) لعمليات الموافقة؟ لم يُعثر على أي استدعاء لتسجيل تدقيق (`admin_audit_log`, `governance_audit_events`) داخل ملف الموافقة نفسه.

---

## 6. مالك المنصة مقابل مدير المؤسسة (Platform Admin vs Organization Admin)

تم اكتشاف **ثلاثة مستويات إدارية منفصلة تماماً بآليات مصادقة مختلفة**:

| المستوى | آلية التوكن | الملف | ملاحظة |
|---|---|---|---|
| **مالك المنصة (Owner)** | `verifyOwnerToken()` — HMAC خاص | `lib/owner-auth.ts` | مفاتيح localStorage: `platform_owner_token`, `platform_owner_email` (من `app/owner/page.tsx`) |
| **super_admin (نظام Bootstrap)** | `makeToken()` محلي في نفس الملف | `app/api/auth/admin-login/route.ts` | **يقبل كلمة مرور احتياطية ثابتة بالكود** `SovereignAdmin2026!` إذا فشل مسار قاعدة البيانات أو لم يُرسل بريد إلكتروني (انظر القسم 12 للتفاصيل الأمنية) |
| **founder/admin (مستوى المؤسسة العادي)** | `lib/auth-tokens.ts` عبر `auth_session` | `middleware.ts` + `lib/rbac.ts` | هذا هو المسار "العادي" المغطى بـ RBAC الكامل (`ROLE_LEVEL`, `ROUTE_RULES`) |

**مشكلة معمارية:** لا يوجد نموذج تفويض موحّد؛ كل مستوى له بوابة مصادقة مستقلة بمنطق HMAC مكرر (3 نسخ من نفس الفكرة، انظر القسم 2). لا يوجد جدول أو مصفوفة واحدة تحدد "من هو فوق من" بين Owner وsuper_admin وfounder — العلاقة الهرمية بينها **غير موثقة في الكود، فقط مُستنتجة من التسمية**.

**دليل إضافي خطير:** الدور `super_admin` الصادر من `admin-login` **غير موجود إطلاقاً** في `ROLE_LEVEL` بـ `lib/rbac.ts` (القيم المعروفة: founder:100, admin:90, dept_manager:60, section_manager:40, supervisor:30, employee:20, member:10). لم يتم العثور على معالجة صريحة لقيمة `super_admin` هذه في `canAccessRoute()` — **CANNOT CONFIRM** ماذا يحدث فعلياً عند تمرير دور غير معروف لدالة تعتمد على خريطة ثابتة (قد يُرجع `undefined`، ما قد يسبب سلوكاً غير متوقع في المقارنات العددية)؛ يتطلب تتبع تنفيذ فعلي لتأكيده.

---

## 7. بنية الإدارة/القسم (Department/Section Architecture)

عدد نسخ هيكل "الإدارة/القسم" المكتشفة في هذا النظام: **6 نسخ منفصلة**، لا واحدة منها مصدر حقيقة وحيد:

| # | المصدر | النوع | الحالة الفعلية (بيانات) |
|---|---|---|---|
| 1 | `workspace.departments` (+ `parent_id` للأقسام الفرعية القديمة) | جدول Postgres | 15 صف — لمؤسسة واحدة فقط |
| 2 | `admin_core.departments` + `admin_core.sections` | جدولا Postgres (المصدر "الأساسي" حسب التعليق بالكود) | departments: 5 صف (لنفس المؤسسة الواحدة) / sections: **0 صف مطلقاً** |
| 3 | `hr_core.departments` | جدول Postgres | **0 صف مطلقاً** |
| 4 | `.data/org-roles.json`, `.data/org-sections.json` | ملفات JSON محلية | تُدمج يدوياً مع نتائج قاعدة البيانات في `app/api/org/departments/route.ts` (متغير `source: 'local'`) |
| 5 | `DEPT_STRUCTURE` (مصفوفة ثابتة بالكود) | كود مصدري صرف | `app/api/onboarding/tenant-requests/[id]/approve/route.ts` — 7 إدارات، ~26 قسماً، لا تُكتب أبداً لأي جدول |
| 6 | `DEPT_DASHBOARD` + `lib/appScope.ts` (7 نطاقات appScope) | كود مصدري صرف | يحدد المسار الافتراضي/الرؤية لكل إدارة بشكل مطابق نسبياً لأكواد `DEPT_STRUCTURE` (CORR, MAINT, HR, FIN, ASSET, IT, GIS) |

**مشكلة الدليل الحاسمة:** `app/api/org/departments/route.ts` (GET) يدمج **3 مصادر مختلفة في استجابة واحدة** (`admin_core.sections` + `workspace.departments` (legacy sub-depts) + JSON محلي) بمنطق دمج يدوي (`dbIds`/`uniqueJson`) — عرضة لتضارب الأكواد (`code`) بين المصادر الثلاثة بصمت.

**خطأ حرج إضافي (تعزيز لقسم 13):** استعلامات هذا الملف (`workspace.departments`, `admin_core.sections`) **لا تحتوي على `WHERE tenant_id = ...` إطلاقاً** رغم أن كلا الجدولين لديهما عمود `tenant_id NOT NULL`. الاستدلال ليس افتراضياً — الاستعلام الحرفي المقروء هو:
```sql
SELECT id::text, code, name_ar, ... FROM workspace.departments
WHERE (parent_id IS NULL OR parent_id = 0)
ORDER BY name_ar
```
لا شرط على `tenant_id` في أي مكان بالدالة `GET`.

---

## 8. بنية المستخدم/العضوية (User/Membership Architecture)

- **لا يوجد مفهوم "عضوية" (Membership) منفصل بمعنى علاقة N:M بين مستخدم ومؤسسة.** كل مستخدم في `lib/user-store.ts` (JSON) وفي `auth_users` (Postgres) له عمود مباشر واحد `tenant_id`/`tenant_code` — أي **نموذج مستخدم واحد لكل مؤسسة واحدة فقط (1:1)**. لا يمكن لمستخدم أن ينتمي لأكثر من مؤسسة بنفس الحساب.
- الاستثناء الوحيد المكتشف لعلاقة عضوية حقيقية N:M هو `workspace.project_memberships` و`workspace.site_memberships` (بمفاتيح `employee_id`/`project_id`/`site_id`) — لكن هذه **فارغة تماماً (0 صف)** وتخص عضوية مشروع/موقع، وليست عضوية مؤسسة/إدارة.
- ثلاث نُسخ متوازية لكيان "المستخدم": `lib/user-store.ts` (JSON)، `public.auth_users` (Postgres، **231 صف — الأكثر استخداماً فعلياً**)، و`public.users` (Postgres، 13 صف، مرتبط بـ FK حقيقي بـ `public.tenants`/`public.roles` لكن **غير مستخدم من أي مسار مصادقة حي** تم العثور عليه في الكود).

---

## 9. بنية الأدوار/الصلاحيات (Role/Permission Architecture)

- **المسار الحي الفعلي بالكامل مُشفّر ثابتاً بالكود (hardcoded)**: `lib/permissions.ts` → `ROLE_PERMISSIONS` (خريطة ثابتة لكل دور)، `PERMISSION_DOMAIN_DEPTS` (تقييد إضافي حسب الإدارة). لا استدعاء واحد لقاعدة بيانات من داخل `hasPermission()`.
- بالمقابل، توجد بنية RBAC علائقية **كاملة وسليمة التصميم** في قاعدة البيانات غير مستخدمة إطلاقاً في مسار التفويض الحي:
  - `public.roles` — 21 صف، بها `role_code`, `permissions jsonb`, `parent_role_id` (تسلسل هرمي!), `tenant_id` (FK حقيقي لـ `public.tenants`)
  - `public.permissions` — 27 صف، بها `permission_code`, `module`, `resource`, `action`
  - `public.user_roles` — 21 صف، تربط `user_id`↔`role_id`↔`tenant_id` بمفاتيح خارجية حقيقية (`ON DELETE CASCADE`)
  - نسخ إضافية معزولة تماماً: `admin_core.user_roles` (0 صف)، `governance.user_roles` (1 صف فقط) — بمخطط أعمدة مختلف تماماً عن `public.user_roles` (لا `role_id`، بل عمود نصي `role`)
- **الأثر:** أي تغيير على صلاحيات دور معيّن يتطلب تعديل كود المصدر (`lib/permissions.ts`) وإعادة نشر التطبيق بالكامل — الجداول الموجودة فعلياً بقاعدة البيانات لإدارة الصلاحيات ديناميكياً (`roles`/`permissions`/`user_roles`) **معطّلة فعلياً وغير موصولة بأي واجهة API مكتشفة**. `PermissionProvider` interface في `lib/permissions.ts` يؤكد أن نسخة DB-backed كانت مخططة ("P3") لكنها لم تُنفَّذ قط.

---

## 10. بنية التنقل/الوحدات/الأيقونات (Navigation/Module/Icon Architecture)

- `public.platform_department_catalog` — جدول Postgres مصمم ليكون كتالوج مركزي للإدارات (بحقول `ui_icon`, `ui_color`, `frontend_route`, `display_order`) — لكن يحتوي على **صف واحد فقط** حالياً. غير مستخدم فعلياً كمصدر رئيسي — الكود يعتمد بدلاً منه على `DEPT_DASHBOARD` (خريطة ثابتة في `lib/rbac.ts`) و`lib/appScope.ts` (7 نطاقات ثابتة بالكود مطابقة تقريباً، وليس فعلياً، لأكواد `DEPT_STRUCTURE`).
- `isDepartmentVisibleForScope()` في `lib/appScope.ts` تعتمد على **مطابقة نصية استدلالية (heuristic string-matching)** على اسم/كود الإدارة — وليس على معرف صريح مرتبط بجدول — هشة أمام أي اختلاف تسمية.
- `public.tenant_department_activations` (الجدول المصمم لتفعيل إدارة مختارة لكل مؤسسة) — **0 صف مطلقاً**. لا استدعاء واحد لاسم هذا الجدول عُثر عليه في كود التطبيق بأكمله (`grep` لعبارة `tenant_department_activations` رجع صفر نتائج في كود المصدر) — الجدول موجود بالمخطط لكنه **غير موصول بأي مسار API** في هذا المستودع. أي استدعاء أمامي لمسار مشابه (`/api/v1/catalog/tenant/{id}/activated-departments`) يُمرَّر عبر البروكسي العام (انظر القسم 12) إلى خدمة خلفية منفصلة (`http://localhost:7860`) **خارج نطاق هذا المستودع** — CANNOT CONFIRM ما إذا كانت تلك الخدمة الخارجية تستخدم هذا الجدول تحديداً أو تعتمد آلية أخرى بالكامل.

---

## 11. بنية قاعدة البيانات (Database Architecture) — دليل فعلي مباشر من القاعدة

**لا يوجد أي ملف `.sql` أو مجلد migrations في هذا المستودع** (`file_search **/*.sql` أرجع صفر نتائج). المخطط بأكمله مُنشأ ومُدار خارج تتبع الكود (يدوياً أو بأدوات خارج هذا المستودع). كل ما يلي مأخوذ مباشرة من `information_schema` و`pg_catalog` عبر استعلامات قراءة فقط تمت في هذه الجلسة.

**عدد المخططات (schemas) المكتشفة في القاعدة: ~45 مخططاً**، من ضمنها مخططات هوية/مؤسسات متعددة متداخلة: `public`, `erp_core`, `admin_core`, `hr_core`, `workspace`, `governance`.

### جدول مقارنة الجداول المتنافسة على تمثيل "الهوية" (بيانات فعلية):

| الجدول | Schema | المفتاح الأساسي | عدد الصفوف | RLS مفعّل؟ | FK حقيقي؟ |
|---|---|---|---|---|---|
| `auth_users` | public | `id text` | **231** | ❌ لا | ❌ لا FK لـ tenant |
| `auth_tenants` | public | `id text` | **15** | ❌ لا | — |
| `users` | public | `user_id uuid` | 13 | ❌ لا | ✅ → `tenants.tenant_id` |
| `tenants` | public | `tenant_id uuid` | 3 | ❌ لا | — |
| `erp_core.users` | erp_core | `id serial` | 0 | ❌ لا | — |
| `erp_core.tenants` | erp_core | `id serial` | 0 | ❌ لا | — |
| `roles` | public | `role_id uuid` | 21 | ❌ لا | ✅ → `tenants` |
| `permissions` | public | `permission_id uuid` | 27 | ❌ لا | — (غير مربوطة بـ FK لـ roles) |
| `user_roles` | public | `user_role_id uuid` | 21 | ❌ لا | ✅ → `users`, `roles`, `tenants` |
| `admin_core.user_roles` | admin_core | `id serial` | 0 | ❌ لا | ❌ (عمود `tenant_id uuid NOT NULL` بدون FK) |
| `governance.user_roles` | governance | `id serial` | 1 | ❌ لا | ❌ |
| `workspace.departments` | workspace | `id serial` | 15 (مؤسسة واحدة) | ❌ لا | ✅ → `tenants.tenant_id` |
| `admin_core.departments` | admin_core | `id serial` | 5 (نفس المؤسسة) | ❌ لا | ❌ (لا FK لـ tenant) |
| `admin_core.sections` | admin_core | `id serial` | 0 | ❌ لا | ✅ → `admin_core.departments` فقط |
| `hr_core.departments` | hr_core | `id serial` | 0 | ❌ لا | ❌ (`tenant_id text` بقيمة افتراضية ثابتة بالمخطط!) |
| `hr_core.employees` | hr_core | `id serial` | 13 | ❌ لا | ❌ |
| `institution_registry` | public | `registry_id uuid` | **0** | ❌ لا | — |
| `institution_relationships` | public | `relationship_id uuid` | **0** | ❌ لا | — |
| `tenant_department_activations` | public | `activation_id serial` | **0** | ❌ لا | — |
| `platform_department_catalog` | public | `catalog_id serial` | 1 | ❌ لا | — |

**ملاحظة تصميمية مهمة مكتشفة:** عمود `hr_core.departments.tenant_id` من النوع `text`، وقيمته الافتراضية بمستوى المخطط نفسه هي `'310b09e7-1176-42cf-9265-3a93f8d92a18'::text` (مكتوبة داخل تعريف العمود بقاعدة البيانات ذاتها، وليس بالكود). هذا يعني أن أي إدراج بدون تحديد `tenant_id` صراحة سيُنسب تلقائياً لمؤسسة محددة سلفاً — خطر إسناد بيانات لمؤسسة خاطئة بصمت.

**تناقض النوع (Type Mismatch):** `tenants.tenant_id` من نوع `uuid`، بينما `auth_users.tenant_id` و`hr_core.departments.tenant_id` و`workspace.employees.tenant_id` من نوع `text`. لا يمكن ربطها مباشرة بمفتاح خارجي حتى لو أراد أحد إصلاح ذلك لاحقاً دون تحويل نوع.

**مصادقة الاتصال بقاعدة البيانات:** أكواد الاتصال بها بيانات اعتماد افتراضية مكتوبة صراحة كـ fallback في حال غياب متغيرات البيئة:
- `lib/db-pg.ts`: `user: 'alhadi'`, `password: 'alhadi2026'` (افتراضي، سطر ~27)
- `app/api/org/departments/route.ts` (وملفات أخرى مشابهة): `user: 'digital'`, `password: 'DigitalPass2026!'` (افتراضي، سطر ~22)

هذان مستخدمان مختلفان بكلمتي مرور مختلفتين لنفس قاعدة البيانات، **مكتوبتان صراحة في الكود المصدري** كقيم احتياطية — تم التحقق فعلياً أن ملف `.env.local` **لا يحتوي على** `PG_PASSWORD`/`DB_PASSWORD`/`DATABASE_URL` — أي أن هاتين كلمتي المرور الثابتتين بالكود هما فعلياً **ما يُستخدم حالياً في بيئة هذا المشروع**.

---

## 12. تقييم عزل المؤسسات (Tenant Isolation Assessment)

### 12.1 غياب RLS (مؤكد)
تم فحص `pg_tables.rowsecurity` لكل جدول هوية/مؤسسة/إدارة/دور مذكور أعلاه (22 جدولاً) — **القيمة `false` في كل واحد منها بلا استثناء**. لا يوجد أي `CREATE POLICY` في قاعدة البيانات لهذه الجداول (البحث عن `ENABLE ROW LEVEL SECURITY`/`CREATE POLICY` في كود المصدر أرجع نتيجة واحدة فقط، داخل ملف توثيق `docs/MINERVA-Learning-Feedback-Architecture.md`، وليس كوداً حياً).

### 12.2 تسرّب فعلي مؤكد بالدليل: استعلام بلا فلترة مؤسسة
`app/api/org/departments/route.ts` — دالة `GET` — الاستعلامات على `workspace.departments` و`admin_core.sections` **لا تحتوي شرط `tenant_id`** رغم امتلاك كلا الجدولين عمود `tenant_id NOT NULL`. أي مستخدم مُصرَّح له بصلاحية `user.review` (بغض النظر عن مؤسسته) سيستقبل **قائمة إدارات/أقسام كل المؤسسات مجتمعة** (حالياً بيانات مؤسسة واحدة فقط لأن البقية فارغة، لكن المشكلة بنيوية وستتفاقم فور تعبئة البيانات لمؤسسات إضافية).

### 12.3 خطر عالي: بروكسي API العام يثق بترويسة المؤسسة القادمة من المتصفح
`app/api/[...path]/route.ts` (البروكسي الذي يمرر كل طلبات `/api/*` غير المطابقة لمسار آخر إلى خدمة خلفية خارجية على `http://localhost:7860`):
```ts
function resolveTenantId(request: Request): string {
  const headerTenant = (request.headers.get('X-Tenant-ID') || '').trim();
  if (UUID_LIKE.test(headerTenant)) return headerTenant;
  const cookieTenant = getCookieValue(request, 'tenant_id');
  ...
}
function tenantHeaders(request: Request): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Tenant-Code': request.headers.get('X-Tenant-Code') || 'INFRA_OPS',
    'X-Staff-Api-Key': STAFF_API_KEY,
    'X-User-Role': 'super_admin',   // ← ثابت دائماً!
  };
  ...
}
```
- الدور المُرسَل للخدمة الخلفية هو **`super_admin` ثابت دائماً** بصرف النظر عن الدور الحقيقي للمستخدم المُصادَق عليه — بتعليق بالكود يبرر ذلك بافتراض أن `middleware.ts` تحقق مسبقاً من JWT وأن `STAFF_API_KEY` سرّي (خادم فقط).
- لكن `resolveTenantId()` تقرأ `X-Tenant-ID` **مباشرة من ترويسة الطلب القادمة من المتصفح** (أو كوكيز `tenant_id`) **دون مقارنتها بـ `x-verified-tenant-id`** التي وضعها middleware من التوكن الموقّع فعلياً. بما أن الواجهة الأمامية (`TenantFetchGuard.tsx` — مذكور في جلسات سابقة) تقرأ `tenant_id` من `localStorage` وترسله كترويسة `X-Tenant-ID` على كل طلب — **يمكن نظرياً لمستخدم مصادَق عليه بمؤسسته الحقيقية أن يغيّر قيمة `tenant_id` في `localStorage` بمتصفحه إلى مؤسسة أخرى**، فيستقبل البروكسي هذه القيمة ويرسلها للخدمة الخلفية مصحوبة بدور `super_admin` ثابت.
- **CANNOT CONFIRM** ما إذا كانت الخدمة الخلفية على `:7860` (كودها خارج هذا المستودع في `/home/alhadi/digital_employees/backend`) تعيد التحقق من `X-Tenant-ID` مقابل توكن موقّع بشكل مستقل، أو تثق بها كما هي بمجرد وجود `X-Staff-Api-Key` صحيح. تم التأكد أن هذه الخدمة **تعمل فعلياً** (استجابت بـ 401 عند فحصها بدون مصادقة، ما يدل على وجود طبقة تحقق ما بها) — لكن منطقها الداخلي غير قابل للتفتيش من هذا المستودع.
- **التصنيف:** هذا خطر معماري مؤكّد جزئياً (طبقة البروكسي في هذا المستودع لا تربط `X-Tenant-ID` بالجلسة المُتحقق منها فعلياً) وغير مؤكد جزئياً (سلوك الخدمة الخلفية).

### 12.4 ثغرة توثيق ثابتة بالكود (Hardcoded Backdoor Credential)
`app/api/auth/admin-login/route.ts`:
```ts
const ADMIN_PASSWORD = process.env.ADMIN_BOOTSTRAP_PASSWORD || 'SovereignAdmin2026!';
...
if (password === ADMIN_PASSWORD) {
  const token = makeToken(email || 'admin@system', 'super_admin');
  return NextResponse.json({ token, role: 'super_admin' });
}
```
إذا لم يُضبط `ADMIN_BOOTSTRAP_PASSWORD` في بيئة الإنتاج (وتم التأكد أنه **غير موجود في `.env.local`** لهذه البيئة)، فإن كلمة المرور الحرفية `SovereignAdmin2026!` الموجودة في الكود المصدري تمنح توكن `super_admin` كامل الصلاحيات لأي شخص يعرفها أو يقرأ الكود — **بغض النظر عن البريد الإلكتروني، وبدون أي ربط بمؤسسة معينة**. هذا تصنّف CRITICAL بامتياز حسب OWASP (A07:2021 – Identification and Authentication Failures / بيانات اعتماد افتراضية مكشوفة في الشيفرة المصدرية).

---

## 13. المشاكل المكتشفة (مُصنّفة حسب الخطورة)

### 🔴 CRITICAL
1. **كلمة مرور super_admin ثابتة بالكود** (`SovereignAdmin2026!`) — `app/api/auth/admin-login/route.ts`. اختراق كامل محتمل لأي مؤسسة.
2. **استعلام إدارات/أقسام بلا فلترة `tenant_id`** — `app/api/org/departments/route.ts` — تسرّب بيانات بين المؤسسات (سيتفاقم فور تعدد المؤسسات المزوّدة ببيانات).
3. **البروكسي العام يثق بـ `X-Tenant-ID` القادم من العميل، ويضيف `X-User-Role: super_admin` ثابتاً** — `app/api/[...path]/route.ts` — مسار محتمل لتصعيد امتيازات عابر للمؤسسات نحو خدمة خلفية خارجية.
4. **غياب RLS بالكامل** على جميع جداول الهوية/المؤسسات (22 جدولاً تم فحصها، كلها `rowsecurity=false`) — العزل بين المؤسسات يعتمد فقط على انضباط برمجي غير مضمون، وقد ثبت غيابه فعلياً (البند 2 أعلاه).
5. **موافقة تأسيس مؤسسة جديدة لا تُنشئ أي سجل إدارة/قسم حقيقي** — `DEPT_STRUCTURE` بالكود فقط، لا `INSERT` لأي جدول أقسام — يفسّر السبب الجذري لمشكلة "كل إدارة كمنصة مستقلة".
6. **كلمتا مرور قاعدة بيانات مختلفتان مكتوبتان صراحة كافتراضي بالكود** (`alhadi2026`, `DigitalPass2026!`) وهما فعلياً الحالة النشطة (`.env.local` لا يحتوي بدائل).

### 🟠 HIGH
7. **ثلاث تطبيقات مستقلة لتوقيع HMAC** (`lib/auth-tokens.ts`, `lib/owner-auth.ts`, داخل `admin-login/route.ts`) بأسرار احتياطية مختلفة الصياغة — خطر عدم اتساق عند التبديل بين البيئات.
8. **قفل محاولات الدخول الفاشلة في الذاكرة فقط** (غير دائم) — يُعاد تصفيره عند إعادة تشغيل الخادم، مذكور سابقاً في `login-credentials/route.ts`.
9. **نظام صلاحيات علائقي كامل بالقاعدة (`roles`/`permissions`/`user_roles`) غير مستخدم إطلاقاً**، بينما النظام الفعلي مُشفّر ثابتاً بالكود — أي تغيير صلاحيات يتطلب نشر كود جديد، ويُهدر تصميماً سليماً موجوداً فعلاً.
10. **دور `super_admin` غير معرّف في `ROLE_LEVEL`** بـ `lib/rbac.ts` — سلوك غير مؤكد عند مقارنته الرقمية.
11. **`hr_core.departments.tenant_id`** له قيمة افتراضية ثابتة على مستوى عمود قاعدة البيانات نفسها — خطر إسناد صامت لمؤسسة خاطئة عند أي إدراج ناقص.

### 🟡 MEDIUM
12. ست نسخ متوازية لهيكل "الإدارة/القسم" (القسم 7) بمنطق دمج يدوي عرضة للتضارب.
13. ثلاث نُسخ متوازية لكيان "المستخدم" (JSON + `auth_users` + `public.users`) غير متصالحة.
14. جدولا مؤسسة منفصلان تماماً (`tenants` uuid بـ3 صفوف، `auth_tenants` text بـ15 صفاً) بلا أي جسر بينهما.
15. طبقة تجريد `AUTH_STORE_BACKEND` (json/pg) غير مطبّقة باتساق — مسارات حية تتجاوزها بالكامل.
16. `platform_department_catalog` و`tenant_department_activations` مصمَّمان لحل مشكلة كتالوج/تفعيل الإدارات لكنهما فارغان تقريباً وغير موصولين بمسار API حي داخل هذا المستودع.

### 🟢 LOW
17. `institution_registry`/`institution_relationships` (المصمّمان بالضبط لنمذجة علاقة "إدارة مستقلة ظاهرياً لكن مرتبطة داخلياً" عبر عمود `management_mode`) **فارغان تماماً (0 صف)** وغير مستخدمين في أي كود حي غير التعليقات التوضيحية — فكرة صحيحة معمارياً لكنها لم تُفعَّل قط.

---

## 14. التكرارات والتعارضات (Duplications/Conflicts) — خلاصة مجمّعة

| المفهوم | عدد النسخ المتوازية | المصدر الحي فعلياً |
|---|---|---|
| المستخدم (User) | 3 (JSON, `auth_users`, `public.users`) | `auth_users` (231 صف) |
| المؤسسة (Tenant) | 3-4 (JSON tenant-store, `auth_tenants`, `public.tenants`, `erp_core.tenants`) | `auth_tenants` (15 صف) عبر JSON غالباً |
| الإدارة/القسم | 6 (انظر القسم 7) | لا يوجد مصدر حقيقة وحيد — بيانات فعلية لمؤسسة واحدة فقط |
| الدور/الصلاحية | 2 (hardcoded بالكود، وDB علائقي) | الكود الثابت (`lib/permissions.ts`) فقط |
| توقيع التوكن (HMAC) | 3 تطبيقات كود منفصلة | كل مسار يستخدم نسخته الخاصة |
| تفعيل إدارة لمؤسسة | 2 (`auth_tenant_department_links` 22 صف حي، و`tenant_department_activations` 0 صف ميت) | `auth_tenant_department_links` |

---

## 15. البنية المستهدفة الموصى بها (Recommended Target Architecture)

> ملاحظة: هذا القسم عرض مفاهيمي رفيع المستوى فقط بناءً على طلب المستخدم، **وليس خطة تنفيذ ولا كوداً**. لا شيء هنا نُفّذ أو سيُنفَّذ في هذه الجلسة.

1. **مصدر حقيقة وحيد للمؤسسة (Tenant)**: توحيد `auth_tenants` و`public.tenants` في جدول واحد بمفتاح UUID متسق، مع تصحيح كل الإشارات (`workspace.departments.tenant_id` وغيرها) لتشير لنفس الجدول.
2. **مصدر حقيقة وحيد للمستخدم**: تفعيل `public.users`+`user_roles`+`roles` العلائقي فعلياً (بدل الاعتماد على `auth_users` المسطّح)، أو دمج `auth_users` داخل نفس المخطط العلائقي بمفاتيح خارجية حقيقية.
3. **مصدر حقيقة وحيد للإدارة/القسم لكل مؤسسة**: جدول واحد (`admin_core.departments`/`sections` مثلاً) يُنشأ فيه سجل فعلي لكل مؤسسة عند الموافقة على طلب التأسيس (بدل الاكتفاء بإدراج مستخدمين فقط) — هذا هو الإصلاح الجذري لمشكلة "الإدارة كمنصة مستقلة".
4. **تفعيل RLS** على كل جدول به `tenant_id` لضمان عزل فعلي على مستوى القاعدة، وليس فقط على مستوى الكود.
5. **توحيد آلية توقيع التوكن** في تطبيق واحد (`lib/auth-tokens.ts`) يُعاد استخدامه من `owner-auth.ts` و`admin-login`.
6. **إزالة كل بيانات الاعتماد الافتراضية المكتوبة بالكود** (كلمات مرور DB، كلمة مرور bootstrap) واستبدالها بمتغيرات بيئة إلزامية بلا قيمة احتياطية في الإنتاج.
7. **ربط `X-Tenant-ID` في البروكسي العام بالتوكن المُتحقق منه فعلياً** (`x-verified-tenant-id` من middleware) بدل الثقة بترويسة/كوكيز قادمة مباشرة من المتصفح.

---

## 16. ترتيب الإصلاح الموصى به (Recommended Fix Order)

> عرض أولويات فقط — القرار النهائي بالتنفيذ متروك للمستخدم كما طُلب صراحة.

1. إزالة كلمة مرور super_admin الثابتة بالكود (إصلاح فوري بسيط جداً، خطورة قصوى).
2. إضافة فلترة `tenant_id` لاستعلامات `app/api/org/departments/route.ts`.
3. ربط البروكسي العام (`X-Tenant-ID`) بالتوكن المُتحقق منه بدل ترويسة العميل.
4. توحيد جدولي المؤسسة (`auth_tenants`/`tenants`) وتفعيل RLS تدريجياً.
5. بناء تدفق فعلي لإنشاء إدارات/أقسام حقيقية لكل مؤسسة عند الموافقة على طلب التأسيس (بدل الإدراج المباشر بـ`auth_users` فقط).
6. توحيد نظام الأدوار/الصلاحيات (اختيار مسار واحد: إما تفعيل الجداول العلائقية بالكامل، أو حذفها والاكتفاء بالنظام الثابت بالكود مع توثيق ذلك رسمياً).
7. توحيد تطبيقات توقيع HMAC الثلاثة في مكان واحد.

---

**نهاية التقرير — تم الاكتشاف والتوثيق فقط. بانتظار قرارك بترتيب الأولويات قبل أي تنفيذ.**
