import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      error: 'LEGACY_ENDPOINT_DISABLED',
      detail: 'Use POST /api/v1/ask only.',
    },
    { status: 410 }
  );
}

