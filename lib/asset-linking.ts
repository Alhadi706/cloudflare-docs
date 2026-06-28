export interface AssetLinkContext {
  assetId: number;
  source: 'asset-portal' | 'department-dashboard' | 'migration';
  moduleKey: string;
}

export function toAssetId(value: unknown): number {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return Math.trunc(num);
}

export function requireAssetLink(value: unknown): { ok: true; assetId: number } | { ok: false; message: string } {
  const assetId = toAssetId(value);
  if (!assetId) {
    return { ok: false, message: 'ربط الأصل إلزامي قبل حفظ السجل' };
  }
  return { ok: true, assetId };
}

export function buildAssetLinkPayload(ctx: AssetLinkContext): Record<string, unknown> {
  return {
    asset_id: ctx.assetId,
    link_source: ctx.source,
    link_module: ctx.moduleKey,
    link_created_at: new Date().toISOString(),
  };
}
