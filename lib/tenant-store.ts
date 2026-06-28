import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { normalizeAppScope, type InstalledAppScope } from '@/lib/appScope';
import { generateTenantActivationCode } from '@/lib/tenant-activation';
import type { TenantProvisioningPackage } from '@/lib/central-provisioning';

export type TenantStatus = 'active' | 'suspended';
export type TenantRequestStatus = 'pending' | 'approved' | 'rejected';
export type TenantJoinStatus = 'pending' | 'approved' | 'rejected';
export type TenantDepartmentTrustState = 'pending' | 'active' | 'blocked';

export interface TenantRecord {
	id: string;
	code: string;
	name: string;
	status: TenantStatus;
	created_at: number;
	approved_at: number;
	approved_by: string;
	first_admin_email: string;
	enabled_departments: string[];
	telegram_bot_token?: string;
}

export interface TenantOnboardingRequest {
	id: string;
	organization_name: string;
	organization_type?: string;
	contact_full_name: string;
	contact_email: string;
	contact_phone: string;
	requested_departments: string[];
	notes?: string;
	status: TenantRequestStatus;
	requested_at: number;
	reviewed_at?: number;
	reviewed_by?: string;
	review_notes?: string;
	tenant_id?: string;
	activation_code?: string;
	provisioning_package?: TenantProvisioningPackage;
}

export interface SubmitTenantRequestInput {
	organization_name: string;
	organization_type?: string;
	contact_full_name: string;
	contact_email: string;
	contact_phone: string;
	requested_departments?: string[];
	notes?: string;
}

export interface TenantDepartmentLink {
	id: string;
	tenant_id: string;
	app_scope: InstalledAppScope;
	trust_state: TenantDepartmentTrustState;
	joined_at?: number;
	approved_by?: string;
	approved_at?: number;
	blocked_reason?: string;
	created_at: number;
	updated_at: number;
}

export interface TenantJoinRequest {
	id: string;
	tenant_id: string;
	app_scope: InstalledAppScope;
	requested_by: string;
	status: TenantJoinStatus;
	requested_at: number;
	decided_at?: number;
	decided_by?: string;
	decision_note?: string;
}

const DATA_DIR = path.join(process.cwd(), '.data');
const TENANTS_FILE = path.join(DATA_DIR, 'tenants.json');
const REQUESTS_FILE = path.join(DATA_DIR, 'tenant_requests.json');
const TENANT_LINKS_FILE = path.join(DATA_DIR, 'tenant_department_links.json');
const TENANT_JOIN_REQUESTS_FILE = path.join(DATA_DIR, 'tenant_join_requests.json');

function ensureDir(): void {
	if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readJsonFile<T>(filePath: string, fallback: T): T {
	ensureDir();
	if (!fs.existsSync(filePath)) return fallback;
	try {
		return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
	} catch {
		return fallback;
	}
}

function writeJsonFile<T>(filePath: string, payload: T): void {
	ensureDir();
	const tmp = `${filePath}.tmp`;
	fs.writeFileSync(tmp, JSON.stringify(payload, null, 2), 'utf8');
	fs.renameSync(tmp, filePath);
}

function readTenants(): TenantRecord[] {
	return readJsonFile<TenantRecord[]>(TENANTS_FILE, []);
}

function writeTenants(tenants: TenantRecord[]): void {
	writeJsonFile(TENANTS_FILE, tenants);
}

function readRequests(): TenantOnboardingRequest[] {
	return readJsonFile<TenantOnboardingRequest[]>(REQUESTS_FILE, []);
}

function writeRequests(requests: TenantOnboardingRequest[]): void {
	writeJsonFile(REQUESTS_FILE, requests);
}

function readTenantDepartmentLinks(): TenantDepartmentLink[] {
	return readJsonFile<TenantDepartmentLink[]>(TENANT_LINKS_FILE, []);
}

function writeTenantDepartmentLinks(links: TenantDepartmentLink[]): void {
	writeJsonFile(TENANT_LINKS_FILE, links);
}

function readTenantJoinRequests(): TenantJoinRequest[] {
	return readJsonFile<TenantJoinRequest[]>(TENANT_JOIN_REQUESTS_FILE, []);
}

function writeTenantJoinRequests(requests: TenantJoinRequest[]): void {
	writeJsonFile(TENANT_JOIN_REQUESTS_FILE, requests);
}

function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function slugifyTenantCode(value: string): string {
	// Strip Arabic — keep only ASCII-safe chars for easy typing in login form
	const ascii = value
		.trim()
		.toLowerCase()
		.replace(/[\u0600-\u06ff]/g, '')    // remove Arabic
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
	if (ascii.length >= 3) return ascii.slice(0, 40);
	// Arabic-only name → short random code
	return `org-${crypto.randomBytes(3).toString('hex')}`;
}

function ensureUniqueCode(baseCode: string, tenants: TenantRecord[]): string {
	const taken = new Set(tenants.map(t => t.code));
	if (!taken.has(baseCode)) return baseCode;

	let i = 2;
	let candidate = `${baseCode}-${i}`;
	while (taken.has(candidate)) {
		i += 1;
		candidate = `${baseCode}-${i}`;
	}
	return candidate;
}

export function listTenants(): TenantRecord[] {
	return readTenants();
}

export function getTenantById(id: string): TenantRecord | undefined {
	return readTenants().find(t => t.id === id);
}

export function getTenantByCode(code: string): TenantRecord | undefined {
	const key = code.trim().toLowerCase();
	return readTenants().find(t => t.code === key);
}

export function getTenantByName(name: string): TenantRecord | undefined {
	const key = normalizeName(name);
	return readTenants().find(t => normalizeName(t.name) === key);
}

export function updateTenant(id: string, patch: Partial<TenantRecord>): TenantRecord | undefined {
	const tenants = readTenants();
	const idx = tenants.findIndex(t => t.id === id);
	if (idx === -1) return undefined;

	const current = tenants[idx];
	const next: TenantRecord = {
		...current,
		...patch,
		id: current.id,
		code: current.code,
		name: current.name,
		created_at: current.created_at,
	};

	tenants[idx] = next;
	writeTenants(tenants);
	return next;
}

export function ensureTenantForOrganization(name: string, preferredCode?: string): TenantRecord {
	const trimmed = name.trim();
	if (!trimmed) {
		throw new Error('organization_name_required');
	}

	const tenants = readTenants();
	const existing = tenants.find(t => normalizeName(t.name) === normalizeName(trimmed));
	if (existing) return existing;

	const baseCode = slugifyTenantCode(preferredCode || trimmed);
	const code = ensureUniqueCode(baseCode, tenants);
	const tenant: TenantRecord = {
		id: crypto.randomUUID(),
		code,
		name: trimmed,
		status: 'active',
		created_at: Date.now(),
		approved_at: Date.now(),
		approved_by: 'self-service',
		first_admin_email: '',
		enabled_departments: [],
	};

	tenants.push(tenant);
	writeTenants(tenants);
	return tenant;
}

export function listTenantRequests(status?: TenantRequestStatus): TenantOnboardingRequest[] {
	const all = readRequests();
	if (!status) return all;
	return all.filter(r => r.status === status);
}

export function getTenantRequestById(id: string): TenantOnboardingRequest | undefined {
	return readRequests().find(r => r.id === id);
}

export function submitTenantRequest(input: SubmitTenantRequestInput): TenantOnboardingRequest {
	const nameKey = normalizeName(input.organization_name);
	const tenants = readTenants();
	const requests = readRequests();

	const hasTenant = tenants.some(t => normalizeName(t.name) === nameKey);
	if (hasTenant) {
		throw new Error('tenant_already_exists');
	}

	const hasPending = requests.some(
		r => normalizeName(r.organization_name) === nameKey && r.status === 'pending'
	);
	if (hasPending) {
		throw new Error('request_already_pending');
	}

	const request: TenantOnboardingRequest = {
		id: crypto.randomUUID(),
		organization_name: input.organization_name.trim(),
		organization_type: input.organization_type?.trim() || undefined,
		contact_full_name: input.contact_full_name.trim(),
		contact_email: input.contact_email.trim().toLowerCase(),
		contact_phone: input.contact_phone.trim(),
		requested_departments: (input.requested_departments ?? []).map(d => d.trim()).filter(Boolean),
		notes: input.notes?.trim() || undefined,
		status: 'pending',
		requested_at: Date.now(),
	};

	requests.push(request);
	writeRequests(requests);
	return request;
}

export function rejectTenantRequest(
	id: string,
	reviewer: string,
	notes?: string
): TenantOnboardingRequest {
	const requests = readRequests();
	const idx = requests.findIndex(r => r.id === id);
	if (idx < 0) throw new Error('request_not_found');

	if (requests[idx].status !== 'pending') {
		throw new Error('request_not_pending');
	}

	requests[idx] = {
		...requests[idx],
		status: 'rejected',
		reviewed_at: Date.now(),
		reviewed_by: reviewer,
		review_notes: notes?.trim() || undefined,
	};

	writeRequests(requests);
	return requests[idx];
}

export function approveTenantRequest(
	id: string,
	reviewer: string,
	input?: { code?: string; enabled_departments?: string[]; notes?: string }
): { request: TenantOnboardingRequest; tenant: TenantRecord } {
	const requests = readRequests();
	const tenants = readTenants();
	const idx = requests.findIndex(r => r.id === id);
	if (idx < 0) throw new Error('request_not_found');

	const request = requests[idx];
	if (request.status !== 'pending') {
		throw new Error('request_not_pending');
	}

	const baseCode = slugifyTenantCode(input?.code || request.organization_name);
	const code = ensureUniqueCode(baseCode, tenants);
	const tenant: TenantRecord = {
		id: crypto.randomUUID(),
		code,
		name: request.organization_name,
		status: 'active',
		created_at: Date.now(),
		approved_at: Date.now(),
		approved_by: reviewer,
		first_admin_email: request.contact_email,
		enabled_departments: (input?.enabled_departments ?? request.requested_departments)
			.map(d => d.trim())
			.filter(Boolean),
	};

	tenants.push(tenant);
	writeTenants(tenants);

	requests[idx] = {
		...request,
		status: 'approved',
		reviewed_at: Date.now(),
		reviewed_by: reviewer,
		review_notes: input?.notes?.trim() || undefined,
		tenant_id: tenant.id,
		activation_code: generateTenantActivationCode(tenant),
	};
	writeRequests(requests);

	return { request: requests[idx], tenant };
}

export function attachProvisioningPackageToRequest(
	id: string,
	provisioningPackage: TenantProvisioningPackage
): TenantOnboardingRequest {
	const requests = readRequests();
	const idx = requests.findIndex((r) => r.id === id);
	if (idx < 0) throw new Error('request_not_found');

	requests[idx] = {
		...requests[idx],
		provisioning_package: provisioningPackage,
	};
	writeRequests(requests);
	return requests[idx];
}

export function deleteTenantRequest(id: string): void {
	const requests = readRequests();
	const idx = requests.findIndex(r => r.id === id);
	if (idx < 0) throw new Error('request_not_found');
	requests.splice(idx, 1);
	writeRequests(requests);
}

export function listTenantDepartmentLinks(tenantId?: string): TenantDepartmentLink[] {
	const links = readTenantDepartmentLinks();
	if (!tenantId) return links;
	return links.filter((l) => l.tenant_id === tenantId);
}

export function getTenantDepartmentLink(
	tenantId: string,
	appScope: string
): TenantDepartmentLink | undefined {
	const scope = normalizeAppScope(appScope);
	return readTenantDepartmentLinks().find(
		(l) => l.tenant_id === tenantId && l.app_scope === scope
	);
}

export function hasActiveTenantDepartmentLink(tenantId: string): boolean {
	return readTenantDepartmentLinks().some(
		(l) => l.tenant_id === tenantId && l.trust_state === 'active'
	);
}

export function getTenantDepartmentTrustState(
	tenantId: string,
	appScope: string
): TenantDepartmentTrustState | 'none' {
	const link = getTenantDepartmentLink(tenantId, appScope);
	if (!link) return 'none';
	return link.trust_state;
}

export function hasAnyActiveScope(tenantId: string, scopes: string[]): boolean {
	if (!tenantId) return false;
	const normalized = scopes.map((s) => normalizeAppScope(s));
	return readTenantDepartmentLinks().some(
		(l) => l.tenant_id === tenantId && l.trust_state === 'active' && normalized.includes(l.app_scope)
	);
}

export function hasAnyPendingScope(tenantId: string, scopes: string[]): boolean {
	if (!tenantId) return false;
	const normalized = scopes.map((s) => normalizeAppScope(s));
	return readTenantDepartmentLinks().some(
		(l) => l.tenant_id === tenantId && l.trust_state === 'pending' && normalized.includes(l.app_scope)
	);
}

export function ensureTenantDepartmentLink(
	tenantId: string,
	appScope: string,
	state: TenantDepartmentTrustState,
	actor: string,
	reason?: string
): TenantDepartmentLink {
	const scope = normalizeAppScope(appScope);
	const links = readTenantDepartmentLinks();
	const now = Date.now();
	const idx = links.findIndex((l) => l.tenant_id === tenantId && l.app_scope === scope);

	if (idx < 0) {
		const link: TenantDepartmentLink = {
			id: crypto.randomUUID(),
			tenant_id: tenantId,
			app_scope: scope,
			trust_state: state,
			joined_at: state === 'active' ? now : undefined,
			approved_by: state === 'active' ? actor : undefined,
			approved_at: state === 'active' ? now : undefined,
			blocked_reason: state === 'blocked' ? reason : undefined,
			created_at: now,
			updated_at: now,
		};
		links.push(link);
		writeTenantDepartmentLinks(links);
		return link;
	}

	const current = links[idx];
	links[idx] = {
		...current,
		trust_state: state,
		joined_at: state === 'active' ? (current.joined_at ?? now) : current.joined_at,
		approved_by: state === 'active' ? actor : current.approved_by,
		approved_at: state === 'active' ? now : current.approved_at,
		blocked_reason: state === 'blocked' ? (reason ?? current.blocked_reason) : undefined,
		updated_at: now,
	};
	writeTenantDepartmentLinks(links);
	return links[idx];
}

export function listTenantJoinRequests(
	tenantId?: string,
	status?: TenantJoinStatus
): TenantJoinRequest[] {
	let requests = readTenantJoinRequests();
	if (tenantId) requests = requests.filter((r) => r.tenant_id === tenantId);
	if (status) requests = requests.filter((r) => r.status === status);
	return requests;
}

export function getTenantJoinRequestById(id: string): TenantJoinRequest | undefined {
	return readTenantJoinRequests().find((r) => r.id === id);
}

export function submitTenantJoinRequest(
	tenantId: string,
	appScope: string,
	requestedBy: string
): TenantJoinRequest {
	const scope = normalizeAppScope(appScope);
	if (scope === 'all') {
		throw new Error('scope_not_joinable');
	}

	const requests = readTenantJoinRequests();
	const existingPending = requests.find(
		(r) => r.tenant_id === tenantId && r.app_scope === scope && r.status === 'pending'
	);
	if (existingPending) return existingPending;

	const now = Date.now();
	const request: TenantJoinRequest = {
		id: crypto.randomUUID(),
		tenant_id: tenantId,
		app_scope: scope,
		requested_by: requestedBy,
		status: 'pending',
		requested_at: now,
	};
	requests.push(request);
	writeTenantJoinRequests(requests);

	ensureTenantDepartmentLink(tenantId, scope, 'pending', requestedBy);
	return request;
}

export function approveTenantJoinRequest(
	id: string,
	reviewer: string,
	note?: string
): TenantJoinRequest {
	const requests = readTenantJoinRequests();
	const idx = requests.findIndex((r) => r.id === id);
	if (idx < 0) throw new Error('join_request_not_found');
	if (requests[idx].status !== 'pending') throw new Error('join_request_not_pending');

	const now = Date.now();
	requests[idx] = {
		...requests[idx],
		status: 'approved',
		decided_at: now,
		decided_by: reviewer,
		decision_note: note?.trim() || undefined,
	};
	writeTenantJoinRequests(requests);

	ensureTenantDepartmentLink(
		requests[idx].tenant_id,
		requests[idx].app_scope,
		'active',
		reviewer
	);

	return requests[idx];
}

export function rejectTenantJoinRequest(
	id: string,
	reviewer: string,
	note?: string
): TenantJoinRequest {
	const requests = readTenantJoinRequests();
	const idx = requests.findIndex((r) => r.id === id);
	if (idx < 0) throw new Error('join_request_not_found');
	if (requests[idx].status !== 'pending') throw new Error('join_request_not_pending');

	const now = Date.now();
	requests[idx] = {
		...requests[idx],
		status: 'rejected',
		decided_at: now,
		decided_by: reviewer,
		decision_note: note?.trim() || undefined,
	};
	writeTenantJoinRequests(requests);

	ensureTenantDepartmentLink(
		requests[idx].tenant_id,
		requests[idx].app_scope,
		'blocked',
		reviewer,
		note
	);

	return requests[idx];
}
