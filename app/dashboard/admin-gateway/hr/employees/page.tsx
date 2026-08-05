'use client';
import { useState, useEffect, useRef } from 'react';
import { Users, Plus, Search, ChevronLeft, X, Loader2, MapPin, Upload } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import * as XLSX from 'xlsx';
import { getUserAuthHeaders } from '@/store/useUserStore';
import { useGisEngine } from '@/store/gisEngine';

interface Grade { id: number; grade_name: string; grade_name_ar: string; grade_level: number; base_salary_min: number; base_salary_max: number; }
interface Position { id: number; position_name: string; position_name_ar: string; department: string; mobile_role?: string; }
interface Employee {
  id: number;
  employee_number: string;
  name: string; name_ar: string;
  first_name: string; last_name: string;
  first_name_ar: string; last_name_ar: string;
  email: string; phone: string; national_id: string; gender: string;
  role: string; department: string;
  position_id: number; position_name: string; position_name_ar: string;
  grade_id: number; grade_name: string; grade_level: number;
  salary: number; base_salary_min: number; base_salary_max: number;
  employment_status: string; hire_date: string; created_at: string;
  project_id: number; site_id: string | number | null; is_active: boolean;
  annual_leave_balance: number; sick_leave_balance: number;
  latitude?: number | null; longitude?: number | null;
}

type ParsedEmployeeRow = {
  employee_number: string;
  first_name: string;
  last_name: string;
  first_name_ar: string;
  last_name_ar: string;
  email: string;
  phone: string;
  national_id: string;
  gender: string;
  position_id: number | null;
  grade_id: number | null;
  hire_date: string;
  employment_status: string;
  latitude: number | null;
  longitude: number | null;
  site_id: string | number | null;
  mobile_role: string;
};

type ImportSummary = {
  total: number;
  success: number;
  failed: number;
  errors: string[];
};

type GeoAnchor = {
  latitude: number;
  longitude: number;
  siteId: string | number | null;
  source: 'map' | 'asset' | 'manual';
};

const EMPTY_FORM = {
  employee_number: '',
  first_name: '', last_name: '', first_name_ar: '', last_name_ar: '',
  email: '', phone: '', national_id: '', gender: 'male',
  position_id: '', grade_id: '', hire_date: '',
  employment_status: 'active',
  latitude: '', longitude: '',
  mobile_role: '',
};

export default function EmployeesPage() {
  const searchParams = useSearchParams();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [grades, setGrades]       = useState<Grade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [showUnlinkedOnly, setShowUnlinkedOnly] = useState(false);
  const [showForm, setShowForm]   = useState(false);
  const [editId, setEditId]       = useState<number|null>(null);
  const [form, setForm]           = useState({...EMPTY_FORM});
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [geoAnchor, setGeoAnchor] = useState<GeoAnchor | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const requestMapLocation = useGisEngine(s => s.requestMapLocation);
  const cancelLocationPick  = useGisEngine(s => s.cancelLocationPick);
  const drawingMode         = useGisEngine(s => s.drawingMode);
  const refreshAll          = useGisEngine(s => s.refreshAll);
  const setLayerVisible     = useGisEngine(s => s.setLayerVisible);
  const setEntityRenderMode = useGisEngine(s => s.setEntityRenderMode);

  const API_BASE = '/api/v1';
  const headers = { 'Content-Type': 'application/json', ...getUserAuthHeaders() };

  useEffect(() => { fetchAll(); }, []);

  useEffect(() => {
    setLayerVisible('employees', true);
    setEntityRenderMode('icons');
    void refreshAll();
  }, [refreshAll, setEntityRenderMode, setLayerVisible]);

  useEffect(() => {
    const latRaw = searchParams.get('geo_lat');
    const lonRaw = searchParams.get('geo_lon');
    if (!latRaw || !lonRaw) return;

    const lat = Number(latRaw);
    const lon = Number(lonRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    const sourceParam = (searchParams.get('geo_source') || '').toLowerCase();
    const source: GeoAnchor['source'] = sourceParam === 'asset' ? 'asset' : sourceParam === 'manual' ? 'manual' : 'map';
    const siteIdRaw = (searchParams.get('geo_asset_id') || searchParams.get('site_id') || '').trim();
    const siteId = siteIdRaw || null;

    setGeoAnchor({
      latitude: Number(lat.toFixed(6)),
      longitude: Number(lon.toFixed(6)),
      siteId,
      source,
    });

    const action = searchParams.get('open');
    if (action === 'new') {
      setForm({
        ...EMPTY_FORM,
        latitude: String(Number(lat.toFixed(6))),
        longitude: String(Number(lon.toFixed(6))),
      });
      setEditId(null);
      setShowForm(true);
    }
  }, [searchParams]);

  useEffect(() => {
    const onGeoAnchor = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail ?? {};
      const lat = Number(detail.latitude);
      const lon = Number(detail.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const rawSiteId = String(detail.siteId ?? '').trim();
      const siteId = rawSiteId || null;
      const source: GeoAnchor['source'] = detail.source === 'asset' ? 'asset' : detail.source === 'manual' ? 'manual' : 'map';

      setGeoAnchor({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lon.toFixed(6)),
        siteId,
        source,
      });

      if (String(detail.action || '').toLowerCase() === 'single') {
        setForm({
          ...EMPTY_FORM,
          latitude: String(Number(lat.toFixed(6))),
          longitude: String(Number(lon.toFixed(6))),
        });
        setEditId(null);
        setShowForm(true);
      }
    };

    window.addEventListener('hr:employees-geo-anchor', onGeoAnchor as EventListener);
    return () => window.removeEventListener('hr:employees-geo-anchor', onGeoAnchor as EventListener);
  }, []);

  function normalizeHeader(value: string) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[\s_\-.()/\\]+/g, '');
  }

  function normalizeDate(value: unknown): string {
    if (value == null || value === '') return '';
    if (typeof value === 'number') {
      const parsed = XLSX.SSF.parse_date_code(value);
      if (!parsed) return '';
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }

    const raw = String(value).trim();
    if (!raw) return '';

    const iso = raw.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (iso) {
      const mm = iso[2].padStart(2, '0');
      const dd = iso[3].padStart(2, '0');
      return `${iso[1]}-${mm}-${dd}`;
    }

    const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmy) {
      const mm = dmy[2].padStart(2, '0');
      const dd = dmy[1].padStart(2, '0');
      return `${dmy[3]}-${mm}-${dd}`;
    }

    const parsedDate = new Date(raw);
    if (!Number.isNaN(parsedDate.getTime())) {
      return parsedDate.toISOString().slice(0, 10);
    }

    return '';
  }

  function normalizeGender(value: string): string {
    const v = value.trim().toLowerCase();
    if (['female', 'f', 'أنثى', 'انثى'].includes(v)) return 'female';
    return 'male';
  }

  function normalizeEmploymentStatus(value: string): string {
    const v = value.trim().toLowerCase();
    if (['inactive', 'غيرفعال', 'متوقف', 'موقوف'].includes(v)) return 'inactive';
    if (['on_leave', 'onleave', 'leave', 'إجازة', 'اجازة'].includes(v)) return 'on_leave';
    return 'active';
  }

  function firstNonEmpty(row: Record<string, unknown>, aliases: string[]): string {
    for (const alias of aliases) {
      const val = row[alias];
      if (val != null && String(val).trim() !== '') return String(val).trim();
    }
    return '';
  }

  function normalizeOptionalNationalId(value: string): string | null {
    const normalized = value
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .trim();

    if (!normalized || normalized === '0') return null;
    return normalized;
  }

  function resolvePositionId(rawValue: string): number | null {
    if (!rawValue) return null;
    const asNumber = Number(rawValue);
    if (!Number.isNaN(asNumber)) {
      const foundById = positions.find(p => p.id === asNumber);
      if (foundById) return foundById.id;
    }
    const normalized = rawValue.trim().toLowerCase();
    const foundByName = positions.find(
      p => (p.position_name_ar || '').trim().toLowerCase() === normalized
        || (p.position_name || '').trim().toLowerCase() === normalized
    );
    return foundByName?.id ?? null;
  }

  function resolveGradeId(rawValue: string): number | null {
    if (!rawValue) return null;
    const asNumber = Number(rawValue);
    if (!Number.isNaN(asNumber)) {
      const foundById = grades.find(g => g.id === asNumber || g.grade_level === asNumber);
      if (foundById) return foundById.id;
    }
    const normalized = rawValue.trim().toLowerCase();
    const foundByName = grades.find(
      g => (g.grade_name_ar || '').trim().toLowerCase() === normalized
        || (g.grade_name || '').trim().toLowerCase() === normalized
    );
    return foundByName?.id ?? null;
  }

  function parseEmployeeSheet(file: File): Promise<ParsedEmployeeRow[]> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = reader.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' }) as Record<string, unknown>[];

          const mapped = rows.map((raw) => {
            const row = Object.fromEntries(
              Object.entries(raw).map(([k, v]) => [normalizeHeader(String(k)), v])
            ) as Record<string, unknown>;

            const employeeNumber = firstNonEmpty(row, ['employeenumber', 'employeeno', 'employeecode', 'empno', 'employee_number', 'الرقمالوظيفي', 'رقموظيفي', 'رقم']);
            const firstNameAr = firstNonEmpty(row, ['firstnamear', 'first_name_ar', 'الاسمالاول', 'الاسمالأول']);
            const lastNameAr = firstNonEmpty(row, ['lastnamear', 'last_name_ar', 'اسمالعائلة', 'اللقب']);
            const firstName = firstNonEmpty(row, ['firstname', 'first_name']);
            const lastName = firstNonEmpty(row, ['lastname', 'last_name']);
            const fullNameAr = firstNonEmpty(row, ['namear', 'fullnamear', 'الاسمالرباعي', 'الاسم']);
            const fullNameEn = firstNonEmpty(row, ['name', 'fullname', 'full_name']);
            const positionRaw = firstNonEmpty(row, ['positionid', 'position', 'positionnamear', 'positionname', 'الوظيفة']);
            const gradeRaw = firstNonEmpty(row, ['gradeid', 'grade', 'gradenamear', 'gradename', 'الدرجة']);
            const genderRaw = firstNonEmpty(row, ['gender', 'الجنس']);
            const statusRaw = firstNonEmpty(row, ['employmentstatus', 'status', 'الحالة']);
            const latRaw = firstNonEmpty(row, ['latitude', 'lat', 'خطالعرض']);
            const lonRaw = firstNonEmpty(row, ['longitude', 'lng', 'lon', 'خطالطول']);

            let resolvedFirstNameAr = firstNameAr;
            let resolvedLastNameAr = lastNameAr;
            if ((!resolvedFirstNameAr || !resolvedLastNameAr) && fullNameAr) {
              const parts = fullNameAr.split(/\s+/).filter(Boolean);
              resolvedFirstNameAr ||= parts[0] || '';
              resolvedLastNameAr ||= parts.slice(1).join(' ') || '';
            }

            let resolvedFirstName = firstName;
            let resolvedLastName = lastName;
            if ((!resolvedFirstName || !resolvedLastName) && fullNameEn) {
              const parts = fullNameEn.split(/\s+/).filter(Boolean);
              resolvedFirstName ||= parts[0] || '';
              resolvedLastName ||= parts.slice(1).join(' ') || '';
            }

            return {
              employee_number: employeeNumber,
              first_name: resolvedFirstName,
              last_name: resolvedLastName,
              first_name_ar: resolvedFirstNameAr,
              last_name_ar: resolvedLastNameAr,
              email: firstNonEmpty(row, ['email', 'البريدالالكتروني', 'البريد']),
              phone: firstNonEmpty(row, ['phone', 'mobile', 'الهاتف', 'رقمالهاتف']),
              national_id: firstNonEmpty(row, ['nationalid', 'national_id', 'الرقمالوطني']),
              gender: normalizeGender(genderRaw),
              position_id: resolvePositionId(positionRaw),
              grade_id: resolveGradeId(gradeRaw),
              hire_date: normalizeDate(firstNonEmpty(row, ['hiredate', 'hire_date', 'تاريخالتعيين'])),
              employment_status: normalizeEmploymentStatus(statusRaw),
              latitude: latRaw ? Number(latRaw) : null,
              longitude: lonRaw ? Number(lonRaw) : null,
              site_id: (() => {
                const siteRaw = firstNonEmpty(row, ['siteid', 'site_id', 'assetid', 'asset_id', 'اصل', 'الأصل']);
                if (!siteRaw.trim()) return null;
                return /^\d+$/.test(siteRaw.trim()) ? Number(siteRaw.trim()) : siteRaw.trim();
              })(),
              mobile_role: firstNonEmpty(row, ['mobilerole', 'mobile_role', 'دورالتطبيق', 'role']),
            };
          });

          resolve(mapped.filter(r => r.employee_number));
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('فشل في قراءة الملف'));
      reader.readAsArrayBuffer(file);
    });
  }

  async function handleImportFile(file: File) {
    setImportSummary(null);
    setImporting(true);

    try {
      const rows = await parseEmployeeSheet(file);
      if (rows.length === 0) {
        alert('لم يتم العثور على صفوف صالحة. تأكد من وجود عمود الرقم الوظيفي.');
        return;
      }

      let success = 0;
      const errors: string[] = [];

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const employeeNumber = row.employee_number.trim();
        if (!employeeNumber) {
          errors.push(`الصف ${i + 2}: الرقم الوظيفي مفقود`);
          continue;
        }

        const userId = `emp-${employeeNumber}`;
        const existing = employees.find(e => (e.employee_number || '').trim() === employeeNumber);
        const url = existing ? `${API_BASE}/workspace/employees/${existing.id}` : `${API_BASE}/workspace/employees`;
        const method = existing ? 'PUT' : 'POST';

        const payload = {
          ...row,
          employee_number: employeeNumber,
          employeeNumber,
          employee_no: employeeNumber,
          employeeNo: employeeNumber,
          emp_no: employeeNumber,
          employeeCode: employeeNumber,
          user_id: userId,
          userId,
          national_id: normalizeOptionalNationalId(row.national_id),
          latitude: row.latitude != null && !Number.isNaN(row.latitude) ? row.latitude : (geoAnchor?.latitude ?? null),
          longitude: row.longitude != null && !Number.isNaN(row.longitude) ? row.longitude : (geoAnchor?.longitude ?? null),
          site_id: row.site_id ?? geoAnchor?.siteId ?? null,
        };

        const res = await fetch(url, {
          method,
          headers,
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          let message = 'خطأ غير معروف';
          try {
            const err = await res.json();
            message = err?.detail || err?.message || message;
          } catch {
            // Ignore parse error
          }
          errors.push(`الصف ${i + 2} (${employeeNumber}): ${message}`);
          continue;
        }

        if (row.mobile_role) {
          try {
            await fetch('/api/auth/mobile/set-role', {
              method: 'POST',
              headers,
              body: JSON.stringify({ employee_no: employeeNumber, mobile_role: row.mobile_role }),
            });
          } catch {
            // non-blocking
          }
        }

        success += 1;
      }

      setImportSummary({
        total: rows.length,
        success,
        failed: rows.length - success,
        errors: errors.slice(0, 10),
      });

      await fetchAll();
      await refreshAll();
    } catch {
      alert('تعذر استيراد الملف. تأكد أن الملف بصيغة Excel/CSV وبأسماء أعمدة صحيحة.');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function fetchAll() {
    setLoading(true);
    setLoadError(null);
    try {
      const [empRes, gradesRes, posRes] = await Promise.all([
        fetch(`${API_BASE}/workspace/employees`, { headers }),
        fetch(`${API_BASE}/hr-structure/grades`,        { headers }),
        fetch(`${API_BASE}/hr-structure/positions`,     { headers }),
      ]);

      if (!empRes.ok) {
        let details = '';
        try {
          const body = await empRes.json();
          details = body?.detail || body?.message || '';
        } catch {
          // Ignore non-JSON error body
        }
        setEmployees([]);
        setLoadError(details
          ? `تعذر تحميل الموظفين (${empRes.status}): ${details}`
          : `تعذر تحميل الموظفين (${empRes.status})`
        );
      } else {
        setEmployees(await empRes.json());
      }

      if (gradesRes.ok) setGrades(await gradesRes.json());
      if (posRes.ok)    setPositions(await posRes.json());
    } catch {
      setEmployees([]);
      setLoadError('حدث خطأ في الاتصال أثناء تحميل بيانات الموظفين');
    } finally { setLoading(false); }
  }

  function openNew() { setForm({...EMPTY_FORM}); setEditId(null); setShowForm(true); }
  function openEdit(e: Employee) {
    setForm({
      employee_number: e.employee_number || '',
      first_name: e.first_name || '', last_name: e.last_name || '',
      first_name_ar: e.first_name_ar || '', last_name_ar: e.last_name_ar || '',
      email: e.email || '', phone: e.phone || '',
      national_id: e.national_id || '', gender: e.gender || 'male',
      position_id: e.position_id?.toString() || '',
      grade_id: e.grade_id?.toString() || '',
      hire_date: e.hire_date ? e.hire_date.slice(0,10) : '',
      employment_status: e.employment_status || 'active',
      latitude:  e.latitude  != null ? String(e.latitude)  : '',
      longitude: e.longitude != null ? String(e.longitude) : '',
      mobile_role: (e as any).mobile_role || '',
    });
    setEditId(e.id); setShowForm(true);
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault(); setSaving(true);
    try {
      const employeeNumber = form.employee_number.trim();
      if (!employeeNumber) {
        alert('الرقم الوظيفي مطلوب');
        return;
      }

      const userId = `emp-${employeeNumber}`;

      // استخراج المعرفات المطلوبة لـ EmployeeCreate الباك-إند
      const payload = {
        ...form,
        employee_number: employeeNumber,
        employeeNumber,
        employee_no: employeeNumber,
        employeeNo: employeeNumber,
        emp_no: employeeNumber,
        employeeCode: employeeNumber,
        user_id: userId, // سيتم استخدامه للربط لاحقاً
        userId,
        national_id: normalizeOptionalNationalId(form.national_id),
        position_id: form.position_id ? parseInt(form.position_id) : null,
        grade_id:    form.grade_id    ? parseInt(form.grade_id)    : null,
        latitude:    form.latitude    ? parseFloat(form.latitude)  : (geoAnchor?.latitude ?? null),
        longitude:   form.longitude   ? parseFloat(form.longitude) : (geoAnchor?.longitude ?? null),
        site_id: geoAnchor?.siteId ?? null,
      };
      
      const url    = editId ? `${API_BASE}/workspace/employees/${editId}` : `${API_BASE}/workspace/employees`;
      const method = editId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers, body: JSON.stringify(payload) });
      if (res.ok) {
        // If mobile_role is set, sync it to the mobile auth system
        if (form.mobile_role) {
          try {
            await fetch('/api/auth/mobile/set-role', {
              method: 'POST',
              headers,
              body: JSON.stringify({ employee_no: employeeNumber, mobile_role: form.mobile_role }),
            });
          } catch {
            // non-blocking: role sync failure doesn't prevent employee save
          }
        }
        await fetchAll();
        setShowForm(false);
        await refreshAll();
      }
      else { const e = await res.json(); alert(e.detail || 'خطأ في الحفظ'); }
    } finally { setSaving(false); }
  }

  function isSpatiallyLinked(employee: Employee): boolean {
    const hasSiteLink = employee.site_id != null && String(employee.site_id).trim() !== '';
    const hasCoords = employee.latitude != null && employee.longitude != null;
    return hasSiteLink || hasCoords;
  }

  const filtered = employees.filter(e =>
    [e.name, e.name_ar, e.role, e.department, e.employee_number, e.national_id, e.email]
      .some(f => f?.toLowerCase().includes(search.toLowerCase()))
    && (!showUnlinkedOnly || !isSpatiallyLinked(e))
  );

  const unlinkedCount = employees.filter(e => !isSpatiallyLinked(e)).length;

  const stats = {
    total:   employees.length,
    active:  employees.filter(e => e.employment_status === 'active').length,
    depts:   new Set(employees.map(e => e.department).filter(Boolean)).size,
    grades:  new Set(employees.map(e => e.grade_id).filter(Boolean)).size,
  };

  return (
    <div className={`min-h-screen bg-transparent p-4 md:p-6 ${drawingMode === 'pick-location' ? 'pointer-events-none' : ''}`} dir="rtl">
      <div className="mx-auto max-w-7xl space-y-5 rounded-2xl border border-white/10 bg-slate-900/20 p-4 backdrop-blur-xl md:p-5">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Link href="/dashboard/admin-gateway" className="hover:text-slate-300">البوابة</Link>
          <ChevronLeft className="w-3 h-3" />
          <Link href="/dashboard/admin-gateway/hr" className="hover:text-slate-300">الموارد البشرية</Link>
          <ChevronLeft className="w-3 h-3" />
          <span className="text-slate-300">الموظفون</span>
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-blue-400/40 bg-blue-500/20 p-3 backdrop-blur-md">
              <Users className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">إدارة الموظفين</h1>
              <p className="text-xs text-slate-500">hr_core.employees — {employees.length} موظف</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="hr-employees-import-input"
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                void handleImportFile(file);
              }}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 rounded-xl border border-emerald-300/30 bg-emerald-500/20 px-4 py-2 text-sm text-emerald-100 backdrop-blur-md transition-colors hover:bg-emerald-500/30 disabled:opacity-60"
            >
              {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              <span>{importing ? 'جاري الاستيراد...' : 'استيراد من Excel/CSV'}</span>
            </button>
            <button onClick={openNew} className="flex items-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500/60 px-4 py-2 text-sm text-white backdrop-blur-md transition-colors hover:bg-blue-500/80">
              <Plus className="w-4 h-4" /><span>موظف جديد</span>
            </button>
          </div>
        </div>

        {importSummary && (
          <div className={`rounded-xl border p-3 text-sm ${importSummary.failed > 0 ? 'border-amber-400/30 bg-amber-500/10 text-amber-100' : 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100'}`}>
            <div className="font-medium">
              نتيجة الاستيراد: تم معالجة {importSummary.total} سجل | نجح {importSummary.success} | فشل {importSummary.failed}
            </div>
            {importSummary.errors.length > 0 && (
              <ul className="mt-2 list-disc space-y-1 pr-5 text-xs text-amber-200">
                {importSummary.errors.map((err, idx) => (
                  <li key={`${idx}-${err}`}>{err}</li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-slate-300">
              الأعمدة المدعومة تشمل: الرقم الوظيفي، الاسم، الاسم الأول/العائلة (عربي/إنجليزي)، البريد، الهاتف، الوظيفة، الدرجة، تاريخ التعيين، الحالة.
            </p>
          </div>
        )}

        {geoAnchor && (
          <div className="rounded-xl border border-cyan-400/30 bg-cyan-500/10 p-3 text-sm text-cyan-100">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">مرساة جغرافية مفعّلة (اختيارية)</p>
                <p className="text-xs text-cyan-200/90 mt-1">
                  {geoAnchor.source === 'asset' ? 'المصدر: أصل مكاني' : 'المصدر: نقطة من الخريطة'}
                  {' • '}
                  ({geoAnchor.latitude.toFixed(6)}, {geoAnchor.longitude.toFixed(6)})
                  {geoAnchor.siteId != null ? ` • site_id: ${geoAnchor.siteId}` : ''}
                </p>
                <p className="text-xs text-cyan-200/80 mt-1">تُستخدم فقط عند عدم تحديد إحداثيات للموظف يدوياً.</p>
              </div>
              <button
                type="button"
                onClick={() => setGeoAnchor(null)}
                className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-xs text-cyan-50 hover:bg-cyan-500/30"
              >
                إلغاء الربط الجغرافي
              </button>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: 'إجمالي', v: stats.total,  c: 'text-blue-400' },
            { l: 'فعّالون', v: stats.active, c: 'text-emerald-400' },
            { l: 'الأقسام', v: stats.depts,  c: 'text-violet-400' },
            { l: 'الدرجات', v: stats.grades, c: 'text-amber-400' },
          ].map(s => (
            <div key={s.l} className="rounded-xl border border-white/10 bg-slate-900/25 p-4 backdrop-blur-xl">
              <div className={`text-2xl font-bold ${s.c}`}>{s.v}</div>
              <div className="text-xs text-slate-500 mt-1">{s.l}</div>
            </div>
          ))}
        </div>

        {/* Search */}
        {loadError && (
          <div className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-sm text-rose-200">
            {loadError}
          </div>
        )}

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم الوظيفي أو الإدارة..."
            className="w-full rounded-xl border border-white/10 bg-slate-900/30 px-4 py-2.5 pr-10 text-sm text-slate-200 placeholder-slate-500 backdrop-blur-xl focus:outline-none focus:border-blue-400/60"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowUnlinkedOnly(v => !v)}
            className={`rounded-xl border px-3 py-2 text-xs transition-colors ${showUnlinkedOnly ? 'border-amber-400/40 bg-amber-500/15 text-amber-100' : 'border-white/10 bg-slate-900/25 text-slate-300 hover:bg-slate-900/35'}`}
          >
            {showUnlinkedOnly ? 'عرض كل الموظفين' : `غير المرتبطين مكانياً (${unlinkedCount})`}
          </button>
          <span className="text-xs text-slate-500">غير مرتبط مكانياً = بلا `site_id` وبلا إحداثيات.</span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900/25 backdrop-blur-xl">
          {loading ? (
            <div className="p-16 text-center text-slate-500 flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
              <span>جاري تحميل البيانات من hr_core...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 text-center">
              <Users className="w-12 h-12 text-slate-700 mx-auto mb-3" />
              <p className="text-slate-500">{search ? 'لا توجد نتائج مطابقة' : 'لا يوجد موظفون بعد — ابدأ بإضافة موظف'}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-800/50 text-slate-300 text-xs">
                  <tr>
                    <th className="px-4 py-3 text-right font-medium">رقم</th>
                    <th className="px-4 py-3 text-right font-medium">الاسم</th>
                    <th className="px-4 py-3 text-right font-medium">الوظيفة</th>
                    <th className="px-4 py-3 text-right font-medium">القسم</th>
                    <th className="px-4 py-3 text-right font-medium">الدرجة</th>
                    <th className="px-4 py-3 text-right font-medium">نطاق الراتب</th>
                    <th className="px-4 py-3 text-right font-medium">الحالة</th>
                    <th className="px-4 py-3 text-right font-medium">دور التطبيق</th>
                    <th className="px-4 py-3 text-right font-medium">تاريخ التعيين</th>
                    <th className="px-4 py-3 text-right font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {filtered.map(emp => (
                    <tr key={emp.id} className="transition-colors hover:bg-white/5">
                      <td className="px-4 py-3 font-mono text-slate-500 text-xs">{emp.employee_number || emp.id}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-200">{emp.name || '—'}</div>
                        {emp.name_ar && emp.name_ar !== emp.name && (
                          <div className="text-xs text-slate-500">{emp.name_ar}</div>
                        )}
                        {emp.email && <div className="text-xs text-slate-600">{emp.email}</div>}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{emp.position_name || emp.role || '—'}</td>
                      <td className="px-4 py-3 text-slate-400">{emp.department || '—'}</td>
                      <td className="px-4 py-3">
                        {emp.grade_name ? (
                          <span className="text-xs bg-violet-900/30 text-violet-400 border border-violet-700/30 px-2 py-0.5 rounded">
                            {emp.grade_name}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                        {emp.base_salary_min > 0 ? `${emp.base_salary_min.toLocaleString()} – ${emp.base_salary_max.toLocaleString()}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded border ${
                          emp.employment_status === 'active'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                            : 'bg-slate-700/40 text-slate-400 border-slate-500/40'
                        }`}>{emp.employment_status === 'active' ? 'فعّال' : emp.employment_status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {(emp as any).mobile_role ? (
                          <span className="text-xs px-2 py-0.5 rounded border bg-indigo-500/10 text-indigo-300 border-indigo-400/20">
                            {(emp as any).mobile_role === 'employee' ? 'موظف' : (emp as any).mobile_role === 'supervisor' ? 'مشرف' : (emp as any).mobile_role === 'section_manager' ? 'رئيس قسم' : (emp as any).mobile_role === 'dept_manager' ? 'مدير إدارة' : (emp as any).mobile_role === 'admin' ? 'مدير نظام' : (emp as any).mobile_role}
                          </span>
                        ) : <span className="text-slate-600 text-xs">—</span>}
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {emp.hire_date ? new Date(emp.hire_date).toLocaleDateString('ar-LY') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => openEdit(emp)} className="text-xs text-blue-400 hover:text-blue-300 transition-colors">تعديل</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Additional Sidebar (instead of centered modal) */}
      {showForm && (
        <div className="fixed inset-0 z-[60]" dir="rtl">
          <div
            className="absolute inset-0 bg-black/35"
            onClick={() => {
              cancelLocationPick();
              setShowForm(false);
            }}
          />
          <div className="absolute left-0 top-0 h-full w-full max-w-[420px] border-r border-white/10 bg-slate-900/80 shadow-2xl backdrop-blur-2xl md:left-[460px]">
            <div className="flex items-center justify-between border-b border-white/10 p-5">
              <h2 className="text-lg font-bold text-slate-100">{editId ? 'تعديل موظف' : 'إضافة موظف جديد'}</h2>
              <button
                onClick={() => {
                  cancelLocationPick();
                  setShowForm(false);
                }}
                className="text-slate-400 hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="h-[calc(100%-72px)] overflow-y-auto p-5 space-y-4">
              <div className="rounded-xl border border-blue-400/30 bg-blue-500/10 p-3">
                <p className="text-xs text-blue-200 leading-6">
                  دور الإدارة هنا: إدخال الرقم الوظيفي ورقم الهاتف بدقة فقط. تكوين فرق الرصد والتفعيل يتم لاحقا من الإدارة الفنية.
                </p>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">الرقم الوظيفي *</label>
                <input required value={form.employee_number} onChange={e => setForm({...form, employee_number: e.target.value})}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="EMP-1042" />
                <p className="mt-1 text-[11px] text-slate-500">هذا الرقم يستخدمه الموظف داخل البوت عند كتابة /start لتأكيد هويته.</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الاسم الأول (عربي)</label>
                  <input required value={form.first_name_ar} onChange={e => setForm({...form, first_name_ar: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="مثال: محمد" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم العائلة (عربي)</label>
                  <input required value={form.last_name_ar} onChange={e => setForm({...form, last_name_ar: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="مثال: الأحمد" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الاسم الأول (إنجليزي)</label>
                  <input value={form.first_name} onChange={e => setForm({...form, first_name: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="Mohammed" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">اسم العائلة (إنجليزي)</label>
                  <input value={form.last_name} onChange={e => setForm({...form, last_name: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="Al-Ahmad" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الجنس</label>
                  <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60">
                    <option value="male">ذكر</option>
                    <option value="female">أنثى</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الرقم الوطني</label>
                  <input value={form.national_id} onChange={e => setForm({...form, national_id: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="1234567890" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">البريد الإلكتروني</label>
                  <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="example@org.ly" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الهاتف</label>
                  <input value={form.phone} onChange={e => setForm({...form, phone: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" placeholder="+218..." />
                  <p className="mt-1 text-[11px] text-slate-500">رقم الهاتف يجب أن يكون الرقم الفعلي الذي يمتلكه الموظف لربطه بحسابه في البوت.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الوظيفة {positions.length === 0 && <span className="text-amber-500">(لا يوجد — أضف وظائف أولاً)</span>}</label>
                  <select value={form.position_id} onChange={e => {
                    const posId = e.target.value;
                    const selectedPos = positions.find(p => String(p.id) === posId);
                    setForm(f => ({
                      ...f,
                      position_id: posId,
                      // Auto-fill mobile_role from position if not manually overridden
                      mobile_role: selectedPos?.mobile_role || f.mobile_role || '',
                    }));
                  }}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60">
                    <option value="">— اختر الوظيفة —</option>
                    {positions.map(p => <option key={p.id} value={p.id}>{p.position_name_ar || p.position_name} — {p.department}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الدرجة الوظيفية {grades.length === 0 && <span className="text-amber-500">(لا يوجد — أضف درجات أولاً)</span>}</label>
                  <select value={form.grade_id} onChange={e => setForm({...form, grade_id: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60">
                    <option value="">— اختر الدرجة —</option>
                    {grades.map(g => <option key={g.id} value={g.id}>{g.grade_name_ar || g.grade_name} (م{g.grade_level}) — {g.base_salary_min.toLocaleString()}–{g.base_salary_max.toLocaleString()}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">دور التطبيق المحمول</label>
                <select value={form.mobile_role} onChange={e => setForm({...form, mobile_role: e.target.value})}
                  className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60">
                  <option value="">— موظف عادي (افتراضي) —</option>
                  <option value="employee">موظف عادي</option>
                  <option value="supervisor">مشرف</option>
                  <option value="section_manager">رئيس قسم</option>
                  <option value="dept_manager">مدير إدارة</option>
                  <option value="admin">مدير نظام</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-500">يُحدد الصلاحيات في التطبيق المحمول — يُملأ تلقائياً من الوظيفة ويمكن تعديله</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">تاريخ التعيين</label>
                  <input type="date" value={form.hire_date} onChange={e => setForm({...form, hire_date: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60" />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">الحالة الوظيفية</label>
                  <select value={form.employment_status} onChange={e => setForm({...form, employment_status: e.target.value})}
                    className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-2 text-sm text-slate-200 backdrop-blur-md focus:outline-none focus:border-blue-400/60">
                    <option value="active">فعّال</option>
                    <option value="on_leave">إجازة</option>
                    <option value="inactive">غير فعّال</option>
                  </select>
                </div>
              </div>

              {/* Location pick from map */}
              <div className="space-y-2 rounded-xl border border-white/10 bg-slate-900/30 p-3 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-slate-400 flex items-center gap-1.5"><MapPin className="w-3 h-3 text-emerald-400" />موقع الموظف على الخريطة</label>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      requestMapLocation((lon, lat) => {
                        setForm(f => ({ ...f, longitude: lon.toFixed(6), latitude: lat.toFixed(6) }));
                        setShowForm(true);
                      });
                    }}
                    className={`text-xs px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors ${
                      drawingMode === 'pick-location'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse'
                        : 'bg-slate-700/50 hover:bg-slate-600/70 text-slate-300 border border-white/10'
                    }`}
                  >
                    <MapPin className="w-3 h-3" />
                    {drawingMode === 'pick-location' ? 'انقر على الخريطة...' : 'اختر من الخريطة'}
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">خط الطول</label>
                    <input
                      type="number" step="0.000001" value={form.longitude}
                      onChange={e => setForm({...form, longitude: e.target.value})}
                      placeholder="13.19"
                      className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-md focus:outline-none focus:border-emerald-400/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">خط العرض</label>
                    <input
                      type="number" step="0.000001" value={form.latitude}
                      onChange={e => setForm({...form, latitude: e.target.value})}
                      placeholder="32.89"
                      className="w-full rounded-lg border border-white/10 bg-slate-900/35 px-3 py-1.5 text-xs font-mono text-slate-300 backdrop-blur-md focus:outline-none focus:border-emerald-400/60"
                    />
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={saving}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-blue-300/30 bg-blue-500/70 py-2.5 text-sm font-medium text-white backdrop-blur-md transition-colors hover:bg-blue-500/90 disabled:opacity-50">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {saving ? 'جاري الحفظ...' : (editId ? 'حفظ التعديلات' : 'إضافة الموظف')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    cancelLocationPick();
                    setShowForm(false);
                  }}
                  className="rounded-xl border border-white/10 bg-slate-700/50 px-6 py-2.5 text-sm text-slate-200 backdrop-blur-md transition-colors hover:bg-slate-700/70"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
