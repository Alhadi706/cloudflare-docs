# DSF Gateway — Flutter Desktop Application

تطبيق سطح مكتب محلي لتطبيق Digital Satellite Fleet الرقمي، مكتوب بـ Flutter و Dart بدل WebView.

## المزايا على الويب

- ✅ **Native Performance** — تطبيق محلي حقيقي بدون متصفح
- ✅ **Offline Ready** — يعمل بدون اتصال إنترنت بعد التسجيل
- ✅ **Scope Isolation** — فصل آمن بين إدارات مختلفة
- ✅ **No SDK Required** — المستخدمون لا يحتاجون تثبيت أي أدوات
- ✅ **Direct Downloads** — ZIP أو MSI جاهز للتشغيل الفوري

## البناء والتطوير

### المتطلبات

```bash
# نظام Linux (لبناء Windows)
flutter --version  # >= 3.44.2
dart --version     # >= 3.12.2
```

### البناء المحلي على Windows

```powershell
cd flutter_dsf
.\scripts\build_windows_release.ps1
# النتيجة: dist\dsf_gateway_flutter-windows-x64.zip
```

### البناء على Linux (للأرشيفات)

```bash
cd flutter_dsf
./scripts/build_linux_release.sh
# النتيجة: dist/dsf_gateway_flutter-linux-x64.tar.gz
```

## التوزيع

### CI/CD Pipeline (GitHub Actions)

يعمل تلقائياً عند:
- دفع تغييرات إلى `flutter_dsf/` أو `.github/workflows/`
- تشغيل يدوي عبر GitHub Actions ➜ "Run workflow"

**المخرجات**: `dsf_gateway_flutter-windows-x64.zip` (GitHub Artifacts)

### التثبيت اليدوي على Windows

```
1. حمّل ZIP
2. استخرج → Extract All
3. انقر مزدوجاً على: START_APP.bat أو dsf_gateway_flutter.exe
```

## البنية

```
flutter_dsf/
├── lib/
│   ├── main.dart              # نقطة البداية
│   └── src/
│       ├── app.dart           # الحالة الرئيسية + التوجيه
│       ├── config/
│       │   └── env.dart       # متغيرات البيئة
│       ├── models/
│       │   └── auth_session.dart
│       ├── screens/
│       │   ├── login_screen.dart
│       │   ├── install_screen.dart      # اختيار الإدارة
│       │   └── scoped_home_screen.dart
│       └── services/
│           ├── auth_api.dart            # اتصال Server
│           └── session_store.dart       # التخزين المحلي
├── scripts/
│   ├── build_windows_release.ps1
│   └── build_linux_release.sh
└── pubspec.yaml               # Dart dependencies
```

## التدفق

```
[Login] → {check token}
   ↓
[Install/Scope] → {choose department}
   ↓
[Scoped Home] → {department-specific interface}
   ↓
[Logout] → back to Login
```

## API Integration

يتصل بـ Next.js backend عند:

```
POST /api/auth/login-credentials
  → Body: { tenant_code, username, password }
  → Response: { token, ... }

GET /api/auth/me
  → Header: Authorization: Bearer {token}
  → Response: { role, homeRoute, tenantCode, tenantId }
```

## التخزين المحلي

يحفظ في SharedPreferences:
- `auth_token` — Bearer token
- `user_role` — Role من API
- `tenant_code` — Department code
- `tenant_id` — Department ID
- `launch_app` — Current scope

## الخطوات التالية

- [ ] إضافة Pages داخل Flutter (replacement للـ React screens)
- [ ] Offline caching باستخدام Drift
- [ ] Notifications باستخدام local_notifications
- [ ] Deep linking (open `dsf://maintenance/workorders/123`)

## الملاحظات

- **Scope** في Flutter يجب أن يطابق ما في middleware.ts
- **API_BASE_URL** يُعرّف في build script بـ `--dart-define`
- **SessionStore** يتعامل مع clear-on-logout تلقائياً

