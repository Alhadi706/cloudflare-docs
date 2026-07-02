import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/backendProxy';

export async function GET(req: NextRequest) {
  return proxyGet(req, '/api/v1/approval/summary', {
    totals: { pending: 0, approved: 0, rejected: 0, total: 0 },
    by_entity_type: [],
    pending_by_role: {},
  });
}
