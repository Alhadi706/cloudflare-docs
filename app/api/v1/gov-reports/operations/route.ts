import { NextRequest } from 'next/server';
import { proxyGet } from '@/lib/backendProxy';
export async function GET(req: NextRequest) {
  return proxyGet(req, '/api/v1/gov-reports/operations');
}
