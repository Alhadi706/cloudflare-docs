/**
 * Sovereign User Store — persistent JSON-file storage
 * Single source of truth for all registered user accounts.
 * Replace with a proper relational database in production.
 */
import fs     from 'fs';
import path   from 'path';
import crypto from 'crypto';

export type UserStatus = 'pending_verification' | 'verified' | 'suspended' | 'invited';

/**
 * الهرم الوظيفي الكامل:
 *   founder         → المؤسس/السوبر أدمن — إعداد المنصة مرة واحدة
 *   admin           → أدمن نظام — صلاحيات كاملة
 *   dept_manager    → مدير إدارة — يرى ويدير إدارته فقط
 *   section_manager → مدير قسم — يرى ويدير قسمه فقط
 *   supervisor      → مشرف — يدير فريقه
 *   employee        → موظف عادي — ملفه الشخصي فقط
 *   member          → (legacy) عضو عام
 */
export type UserRole =
  | 'founder'
  | 'admin'
  | 'dept_manager'
  | 'section_manager'
  | 'supervisor'
  | 'employee'
  | 'member';

export type OrgType = 'government' | 'military' | 'municipality' | 'corporation' | 'ngo' | 'other';

/** رموز الإدارات المعيارية */
export type DepartmentCode =
  | 'HR'    // الموارد البشرية
  | 'FIN'   // المالية
  | 'GIS'   // الجغرافيا والمعلومات
  | 'MAINT' // الصيانة والبنية التحتية
  | 'PROC'  // المشتريات
  | 'ASSET' // الأصول
  | 'IT'    // تقنية المعلومات
  | 'LEGAL' // الشؤون القانونية
  | 'OPS'   // العمليات
  | 'CTRL'  // إدارة التحكم (ضغوط + إنتاج + توزيع)
  | 'ENG'   // الهندسة والدعم الفني
  | 'PROJ'  // إدارة المشاريع
  | 'CORR'  // إدارة مكافحة التآكل
  | string; // أي رمز مخصص

export interface SovereignUser {
  id:                string;
  full_name:         string;
  email:             string;
  tenant_id?:        string;
  tenant_code?:      string;
  phone_number:      string;
  organization_name: string;
  organization_type?: OrgType;
  country?:          string;
  job_title?:        string;
  status:            UserStatus;
  role:              UserRole;
  is_founder:        boolean;
  onboarding_complete?: boolean;  // تم إكمال معالج الإعداد الأولي
  is_first_admin?:   boolean;     // مسؤول المؤسسة الأول
  // ── Organizational hierarchy ──────────────────────────────────
  department_code?:      DepartmentCode;  // إدارة المستخدم
  section_id?:           string;          // قسم المستخدم
  invited_by?:           string;          // بريد من دعاه
  // ── Credential-based login (for invited managers/employees) ──
  username?:             string;          // اسم المستخدم
  hashed_password?:      string;          // PBKDF2-SHA256
  password_salt?:        string;          // random salt
  must_change_password?: boolean;         // يجب تغيير كلمة المرور أول مرة
  // ── Section manager access codes ─────────────────────────────
  section_code?:         string;          // رمز الوصول للقسم
  section_password?:     string;          // كلمة مرور القسم (plaintext for display)
  // ── Verification (for OTP-based login) ───────────────────────
  activation_token:  string;
  activation_otp:    string;
  otp_expires:       number;
  token_expires:     number;
  otp_attempts:      number;
  resend_count:      number;
  last_resend:       number;
  // ── Timestamps ───────────────────────────────────────────────
  created_at:        number;
  verified_at?:      number;
  last_login?:       number;
}

const DATA_DIR  = path.join(process.cwd(), '.data');
const USER_FILE = path.join(DATA_DIR, 'users.json');

function ensureDir(): void {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readAll(): SovereignUser[] {
  ensureDir();
  if (!fs.existsSync(USER_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(USER_FILE, 'utf8')) as SovereignUser[];
  } catch {
    return [];
  }
}

function writeAll(users: SovereignUser[]): void {
  ensureDir();
  // Atomic write via temp file to prevent corruption
  const tmp = USER_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(users, null, 2), 'utf8');
  fs.renameSync(tmp, USER_FILE);
}

export function findByEmail(email: string): SovereignUser | undefined {
  return readAll().find(u => u.email === email.toLowerCase().trim());
}

export function findByUsername(username: string): SovereignUser | undefined {
  return readAll().find(u => u.username === username.toLowerCase().trim());
}

export function findByUsernameScoped(
  username: string,
  tenant?: { tenant_id?: string | null; tenant_code?: string | null }
): SovereignUser | undefined {
  const normalized = username.toLowerCase().trim();
  return readAll().find(u => {
    if (u.username !== normalized) return false;
    if (!tenant?.tenant_id && !tenant?.tenant_code) return true;
    if (tenant.tenant_id && u.tenant_id === tenant.tenant_id) return true;
    if (tenant.tenant_code && u.tenant_code === tenant.tenant_code) return true;
    return false;
  });
}

function normalizeUsernamePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\u0600-\u06ff]/g, '')
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 24);
}

export function buildEmployeeUsername(tenantCode: string, employeeNo: string): string {
  const t = normalizeUsernamePart(tenantCode) || 'tenant';
  const e = normalizeUsernamePart(employeeNo) || 'employee';
  return `emp.${t}.${e}`;
}

export function findByToken(token: string): SovereignUser | undefined {
  return readAll().find(u => u.activation_token === token);
}

export function findById(id: string): SovereignUser | undefined {
  return readAll().find(u => u.id === id);
}

export function findByDepartment(code: string): SovereignUser[] {
  return readAll().filter(u => u.department_code === code && u.status !== 'suspended');
}

export function listUsers(): SovereignUser[] {
  return readAll();
}

// ── Password helpers ─────────────────────────────────────────────────────────

export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const s = salt ?? crypto.randomBytes(32).toString('hex');
  const h = crypto.pbkdf2Sync(password, s, 100_000, 64, 'sha256').toString('hex');
  return { hash: h, salt: s };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const { hash: h } = hashPassword(password, salt);
  const a = Buffer.from(h, 'hex');
  const b = Buffer.from(hash, 'hex');
  // Constant-time compare (requires same length)
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function generateUsername(fullName: string, deptCode: string, existingUsernames: string[]): string {
  // Strip Arabic — username must be ASCII-only for easy login form typing
  const asciiName = fullName
    .toLowerCase()
    .replace(/[\u0600-\u06ff]/g, '')  // remove Arabic
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 15);
  const base = asciiName.length >= 2 ? asciiName : 'user';
  const dept = deptCode.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5);
  let candidate = `${base}.${dept}`;
  let i = 2;
  while (existingUsernames.includes(candidate)) {
    candidate = `${base}.${dept}${i}`;
    i++;
  }
  return candidate;
}

export function generateTempPassword(length = 12): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from(crypto.randomBytes(length))
    .map(b => chars[b % chars.length])
    .join('');
}

/** Generate a unique section access code with the given prefix, avoiding conflicts. */
export function generateSectionCode(prefix: string, existingCodes: string[]): string {
  const safePrefix = prefix.replace(/[^A-Za-z0-9]/g, '').slice(0, 5).toUpperCase() || 'SEC';
  let candidate = `${safePrefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  while (existingCodes.includes(candidate)) {
    candidate = `${safePrefix}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  }
  return candidate;
}

export function hasAnyVerifiedUser(): boolean {
  return readAll().some(u => u.status === 'verified');
}

export function orgHasVerifiedFounder(orgName: string): boolean {
  const key = orgName.toLowerCase().trim();
  return readAll().some(u =>
    u.organization_name.toLowerCase() === key && u.status === 'verified'
  );
}

type CreateInput = Omit<SovereignUser, 'id' | 'created_at' | 'is_founder' | 'role'>;

export function createUser(data: CreateInput): SovereignUser {
  const users      = readAll();
  const isFounder  = !orgHasVerifiedFounder(data.organization_name);
  const user: SovereignUser = {
    ...data,
    id:         crypto.randomUUID(),
    created_at: Date.now(),
    is_founder: isFounder,
    role:       isFounder ? 'founder' : 'member',
  };
  users.push(user);
  writeAll(users);
  return user;
}

/**
 * إنشاء مستخدم مدعو (مدير إدارة / مدير قسم / موظف)
 * يُحدد الدور والإدارة والقسم ويُولَّد له username + كلمة مرور مؤقتة
 */
export interface InviteUserInput {
  full_name:       string;
  email:           string;
  role:            UserRole;
  department_code: DepartmentCode;
  tenant_id?:      string;
  tenant_code?:    string;
  section_id?:     string;
  invited_by:      string;  // email of founder/admin
  organization_name: string;
  job_title?:      string;
}

export interface InviteUserResult {
  user:          SovereignUser;
  username:      string;
  temp_password: string;
}

export function inviteUser(input: InviteUserInput): InviteUserResult {
  const users    = readAll();
  const existing = users.map(u => u.username).filter(Boolean) as string[];

  const username     = generateUsername(input.full_name, input.department_code, existing);
  const temp_password = generateTempPassword();
  const { hash, salt } = hashPassword(temp_password);

  const user: SovereignUser = {
    id:               crypto.randomUUID(),
    full_name:        input.full_name,
    email:            input.email.toLowerCase().trim(),
    tenant_id:        input.tenant_id,
    tenant_code:      input.tenant_code,
    phone_number:     '',
    organization_name: input.organization_name,
    status:           'invited',
    role:             input.role,
    is_founder:       false,
    department_code:  input.department_code,
    section_id:       input.section_id,
    invited_by:       input.invited_by,
    job_title:        input.job_title,
    username,
    hashed_password:  hash,
    password_salt:    salt,
    must_change_password: true,
    // Unused OTP fields — set defaults
    activation_token: '',
    activation_otp:   '',
    otp_expires:      0,
    token_expires:    0,
    otp_attempts:     0,
    resend_count:     0,
    last_resend:      0,
    created_at:       Date.now(),
  };

  users.push(user);
  writeAll(users);
  return { user, username, temp_password };
}

export function updateUser(email: string, updates: Partial<SovereignUser>): SovereignUser | null {
  const users = readAll();
  const key   = email.toLowerCase().trim();
  const idx   = users.findIndex(u => u.email === key);
  if (idx < 0) return null;
  users[idx] = { ...users[idx], ...updates };
  writeAll(users);
  return users[idx];
}

export function completeOnboarding(email: string): SovereignUser | null {
  return updateUser(email, { onboarding_complete: true });
}

export interface CreateFirstAdminInput {
  full_name:         string;
  email:             string;
  phone_number?:     string;
  organization_name: string;
  tenant_id:         string;
  tenant_code:       string;
  invited_by?:       string;
}

export interface CreateFirstAdminResult {
  user:          SovereignUser;
  username:      string;
  temp_password: string;
}

export interface UpsertEmployeeCredentialInput {
  tenant_id: string;
  tenant_code: string;
  organization_name: string;
  employee_no: string;
  full_name: string;
  department_code?: DepartmentCode;
  phone_number?: string;
  password_hash: string;
  password_salt: string;
  mobile_role?: UserRole;
}

export function upsertEmployeeCredentialUser(input: UpsertEmployeeCredentialInput): SovereignUser {
  const users = readAll();
  const username = buildEmployeeUsername(input.tenant_code, input.employee_no);
  const now = Date.now();

  const idx = users.findIndex(
    (u) => u.username === username && (u.tenant_id === input.tenant_id || u.tenant_code === input.tenant_code)
  );

  const resolvedRole: UserRole = input.mobile_role || 'employee';

  if (idx >= 0) {
    users[idx] = {
      ...users[idx],
      full_name: input.full_name || users[idx].full_name,
      phone_number: input.phone_number || users[idx].phone_number,
      organization_name: input.organization_name,
      tenant_id: input.tenant_id,
      tenant_code: input.tenant_code,
      role: resolvedRole,
      status: 'verified',
      department_code: input.department_code || users[idx].department_code,
      username,
      hashed_password: input.password_hash,
      password_salt: input.password_salt,
      must_change_password: false,
      verified_at: users[idx].verified_at || now,
      last_login: users[idx].last_login,
      activation_token: users[idx].activation_token || '',
      activation_otp: users[idx].activation_otp || '',
      otp_expires: users[idx].otp_expires || 0,
      token_expires: users[idx].token_expires || 0,
      otp_attempts: users[idx].otp_attempts || 0,
      resend_count: users[idx].resend_count || 0,
      last_resend: users[idx].last_resend || 0,
    };
    writeAll(users);
    return users[idx];
  }

  let localEmail = `${username}@${normalizeUsernamePart(input.tenant_code) || 'tenant'}.local`;
  while (users.some((u) => u.email === localEmail)) {
    localEmail = `${username}.${Math.floor(100 + Math.random() * 900)}@${normalizeUsernamePart(input.tenant_code) || 'tenant'}.local`;
  }

  const user: SovereignUser = {
    id: crypto.randomUUID(),
    full_name: input.full_name,
    email: localEmail,
    tenant_id: input.tenant_id,
    tenant_code: input.tenant_code,
    phone_number: input.phone_number || '',
    organization_name: input.organization_name,
    status: 'verified',
    role: resolvedRole,
    is_founder: false,
    department_code: input.department_code,
    username,
    hashed_password: input.password_hash,
    password_salt: input.password_salt,
    must_change_password: false,
    activation_token: '',
    activation_otp: '',
    otp_expires: 0,
    token_expires: 0,
    otp_attempts: 0,
    resend_count: 0,
    last_resend: 0,
    created_at: now,
    verified_at: now,
  };

  users.push(user);
  writeAll(users);
  return user;
}

export function createFirstAdmin(input: CreateFirstAdminInput): CreateFirstAdminResult {
  const users = readAll();
  const existingEmail = input.email.toLowerCase().trim();
  if (users.some(u => u.email === existingEmail)) {
    throw new Error('email_already_exists');
  }

  const existingUsernames = users.map(u => u.username).filter(Boolean) as string[];
  // Prefer email prefix as username (always ASCII); fallback to name-based
  const emailPrefix = existingEmail.split('@')[0].replace(/[^a-z0-9.]/gi, '.').toLowerCase().slice(0, 20);
  const username = emailPrefix.length >= 3
    ? (existingUsernames.includes(emailPrefix) ? generateUsername(emailPrefix, 'admin', existingUsernames) : emailPrefix)
    : generateUsername(input.full_name, 'admin', existingUsernames);
  const temp_password = generateTempPassword();
  const { hash, salt } = hashPassword(temp_password);

  const user: SovereignUser = {
    id:               crypto.randomUUID(),
    full_name:        input.full_name,
    email:            existingEmail,
    tenant_id:        input.tenant_id,
    tenant_code:      input.tenant_code,
    phone_number:     input.phone_number?.trim() || '',
    organization_name: input.organization_name,
    status:           'invited',
    role:             'founder',
    is_founder:       true,
    is_first_admin:   true,
    invited_by:       input.invited_by,
    username,
    hashed_password:  hash,
    password_salt:    salt,
    must_change_password: true,
    activation_token: '',
    activation_otp:   '',
    otp_expires:      0,
    token_expires:    0,
    otp_attempts:     0,
    resend_count:     0,
    last_resend:      0,
    created_at:       Date.now(),
  };

  users.push(user);
  writeAll(users);
  return { user, username, temp_password };
}
