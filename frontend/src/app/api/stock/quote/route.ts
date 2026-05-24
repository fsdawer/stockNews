import { NextRequest, NextResponse } from 'next/server';
import { fmp } from '@/lib/api/fmp';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) {
    return NextResponse.json({ error: 'ticker required' }, { status: 400 });
  }

  try {
    const data = await fmp.eodLight(ticker.toUpperCase());
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'FMP error' },
      { status: 502 }
    );
  }
}
