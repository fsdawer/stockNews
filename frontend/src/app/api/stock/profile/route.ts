import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const ticker = request.nextUrl.searchParams.get('ticker');
  if (!ticker) return NextResponse.json(null);

  const apiKey = process.env.FMP_API_KEY;
  if (!apiKey) return NextResponse.json(null);

  const res = await fetch(
    `https://financialmodelingprep.com/stable/profile?symbol=${ticker.toUpperCase()}&apikey=${apiKey}`,
    { next: { revalidate: 86400 } } // 24시간 캐시
  );
  if (!res.ok) return NextResponse.json(null);

  const data = await res.json();
  const item = Array.isArray(data) ? data[0] : data;
  if (!item) return NextResponse.json(null);

  return NextResponse.json({
    name: item.companyName ?? item.name ?? ticker.toUpperCase(),
    logo: item.image ?? null,
    exchange: item.exchangeShortName ?? item.exchange ?? null,
    industry: item.industry ?? null,
  });
}
