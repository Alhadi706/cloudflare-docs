export type GovernanceValidationResult = {
  ok: boolean;
  error?: string;
};

const COMPONENT_KEYWORDS = [
  'component',
  'components',
  'spare',
  'spares',
  'spare_part',
  'spare_parts',
  'sparepart',
  'spareparts',
  'consumable',
  'consumables',
  'subcomponent',
  'subcomponents',
  'sub_component',
  'sub_components',
  'part',
  'parts',
  'piece',
  'pieces',
  'kit',
  'kits',
  'mro',
  'inventory_item',
];

const COMPONENT_PHRASES = [
  'spare part',
  'spare parts',
  'قطع غيار',
  'قطعة غيار',
  'مكون',
  'مكونات',
  'مكو',
];

const PARENT_FIELD_KEYS = [
  'parent_id',
  'parent_asset_id',
  'parentid',
  'parentassetid',
  'root_asset_id',
  'ancestor_asset_id',
  'grandparent_asset_id',
];

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

function normalizeKey(key: string): string {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function findFirstValueByKeys(obj: Record<string, unknown>, keys: string[]): unknown {
  const wanted = new Set(keys.map(normalizeKey));
  for (const [rawKey, rawValue] of Object.entries(obj)) {
    if (wanted.has(normalizeKey(rawKey))) {
      return rawValue;
    }
  }
  return undefined;
}

function parseHierarchyLevel(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getHierarchyLevel(payload: Record<string, unknown>): number | null {
  const properties = asRecord(payload.properties);
  const direct = findFirstValueByKeys(payload, ['hierarchy_level', 'level', 'depth']);
  const nested = findFirstValueByKeys(properties, ['hierarchy_level', 'level', 'depth']);
  return parseHierarchyLevel(direct ?? nested);
}

function extractTypeLikeValues(payload: Record<string, unknown>): string[] {
  const properties = asRecord(payload.properties);
  const values = [
    findFirstValueByKeys(payload, ['asset_type', 'assetType', 'classification', 'type', 'category']),
    findFirstValueByKeys(properties, ['asset_type', 'assetType', 'classification', 'type', 'category']),
  ];

  return values
    .map((v) => normalize(v))
    .filter(Boolean);
}

function isComponentText(raw: string): boolean {
  if (!raw) return false;
  const normalized = raw.toLowerCase().trim();
  if (!normalized) return false;

  for (const phrase of COMPONENT_PHRASES) {
    if (normalized.includes(phrase)) return true;
  }

  const tokens = normalized.split(/[^a-z0-9\u0600-\u06FF_]+/g).filter(Boolean);
  return tokens.some((token) => COMPONENT_KEYWORDS.includes(token));
}

function hasComponentClassification(payload: Record<string, unknown>): boolean {
  return extractTypeLikeValues(payload).some(isComponentText);
}

function readParentReference(payload: Record<string, unknown>): unknown {
  const properties = asRecord(payload.properties);
  return (
    findFirstValueByKeys(payload, PARENT_FIELD_KEYS)
    ?? findFirstValueByKeys(properties, PARENT_FIELD_KEYS)
  );
}

function hasComponentFlag(payload: Record<string, unknown>): boolean {
  const properties = asRecord(payload.properties);
  const raw =
    findFirstValueByKeys(payload, ['is_component', 'is_spare'])
    ?? findFirstValueByKeys(properties, ['is_component', 'is_spare']);
  if (typeof raw === 'boolean') return raw;
  return ['1', 'true', 'yes'].includes(normalize(raw));
}

export function validatePrincipalAssetCreatePayload(payload: unknown): GovernanceValidationResult {
  const data = asRecord(payload);
  if (!Object.keys(data).length) {
    return { ok: false, error: 'Invalid principal asset payload.' };
  }

  if (readParentReference(data) !== undefined) {
    return {
      ok: false,
      error: 'Two-level hierarchy enforced: principal assets cannot include a parent reference.',
    };
  }

  const level = getHierarchyLevel(data);
  if (level !== null && level > 1) {
    return {
      ok: false,
      error: 'Two-level hierarchy enforced: principal assets must be level 1 only.',
    };
  }

  if (hasComponentClassification(data) || hasComponentFlag(data)) {
    return {
      ok: false,
      error: 'Components/spares are not assets. Register them under maintenance/component workflows linked to child assets.',
    };
  }

  return { ok: true };
}

export function validateChildAssetCreatePayload(payload: unknown, parentId: string): GovernanceValidationResult {
  const data = asRecord(payload);
  if (!Object.keys(data).length) {
    return { ok: false, error: 'Invalid child asset payload.' };
  }

  if (!String(parentId || '').trim()) {
    return { ok: false, error: 'Missing parent asset reference in URL.' };
  }

  const parentRef = readParentReference(data);
  if (parentRef !== undefined && normalize(parentRef) !== normalize(parentId)) {
    return {
      ok: false,
      error: 'Two-level hierarchy enforced: child assets must reference only the direct principal parent from route.',
    };
  }

  const level = getHierarchyLevel(data);
  if (level !== null && level > 2) {
    return {
      ok: false,
      error: 'Two-level hierarchy enforced: hierarchy depth cannot exceed principal -> child.',
    };
  }

  if (hasComponentClassification(data) || hasComponentFlag(data)) {
    return {
      ok: false,
      error: 'Components/spares are not assets. Link components to child assets using maintenance/component domains.',
    };
  }

  return { ok: true };
}

export function applyHandoverBoundary(payload: unknown): Record<string, unknown> {
  const data = asRecord(payload);
  const projectReference = asRecord(data.project_reference);

  return {
    ...data,
    project_reference: {
      ...projectReference,
      handover_status: 'historical_reference',
      operational_authority: 'asset_master',
      project_authority_active: false,
      ownership_boundary: 'project_to_asset',
    },
    operational_authority: 'asset_master',
    project_authority_active: false,
    ownership_boundary: 'project_to_asset',
    handover_boundary_version: 'sprint_1b_gap03',
  };
}
