import 'server-only';
import { NextRequest, NextResponse } from 'next/server';

const KO_MAP: Record<string, string> = {
  테슬라: 'TSLA', 애플: 'AAPL', 엔비디아: 'NVDA', 마이크로소프트: 'MSFT',
  구글: 'GOOGL', 알파벳: 'GOOGL', 아마존: 'AMZN', 메타: 'META',
  넷플릭스: 'NFLX', 팔란티어: 'PLTR', 로켓랩: 'RKLB', 스페이스엑스: 'RKLB',
  코인베이스: 'COIN', 우버: 'UBER', 스냅: 'SNAP', 트위터: 'X',
  인텔: 'INTC', AMD: 'AMD', 퀄컴: 'QCOM', 브로드컴: 'AVGO',
  버크셔: 'BRK.B', 존슨앤존슨: 'JNJ', 비자: 'V', 마스터카드: 'MA',
  나이키: 'NKE', 스타벅스: 'SBUX', 월마트: 'WMT', 디즈니: 'DIS',
  리비안: 'RIVN', 루시드: 'LCID', ARM: 'ARM', 아스트라제네카: 'AZN',
  오라클: 'ORCL', 세일즈포스: 'CRM', 어도비: 'ADBE', 페이팔: 'PYPL',
  스포티파이: 'SPOT', 에어비앤비: 'ABNB', 도어대시: 'DASH', 리프트: 'LYFT',
  샵이파이: 'SHOP', 스퀘어: 'SQ', 트위터X: 'X', 로블록스: 'RBLX',
  드래프트킹스: 'DKNG', ASML: 'ASML', TSMC: 'TSM',
};

export interface SearchResult {
  ticker: string;
  name: string;
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (!q) return NextResponse.json([]);

  // 한글 이름 매핑 우선 (완전 일치)
  const koMatch = KO_MAP[q];
  if (koMatch) {
    return NextResponse.json([{ ticker: koMatch, name: q }]);
  }

  // 부분 매칭: "테슬" → "테슬라" → TSLA
  const partialKey = Object.keys(KO_MAP).find(key => key.startsWith(q) || q.startsWith(key));
  if (partialKey) {
    return NextResponse.json([{ ticker: KO_MAP[partialKey], name: partialKey }]);
  }

  try {
    const url = `https://financialmodelingprep.com/stable/search-symbol?query=${encodeURIComponent(q)}&limit=7&apikey=${process.env.FMP_API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json([]);

    const data = await res.json();
    if (!Array.isArray(data)) return NextResponse.json([]);

    const results: SearchResult[] = data
      .filter((d: { exchange?: string }) =>
        ['NYSE', 'NASDAQ', 'AMEX'].includes(d.exchange ?? '')
      )
      .slice(0, 5)
      .map((d: { symbol: string; name: string }) => ({ ticker: d.symbol, name: d.name }));

    return NextResponse.json(results);
  } catch {
    return NextResponse.json([]);
  }
}
