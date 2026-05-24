# Finnhub WebSocket — 참조 문서

## 연결 URL
```
wss://ws.finnhub.io?token={FINNHUB_API_KEY}
```

## 기본 패턴 (React useEffect)
```typescript
useEffect(() => {
  const ws = new WebSocket(
    `wss://ws.finnhub.io?token=${process.env.NEXT_PUBLIC_FINNHUB_KEY}`
  );

  ws.onopen = () => {
    ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
  };

  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'trade') {
      const latest = data.data[data.data.length - 1];
      setPrice(latest.p);  // p = price
      setVolume(latest.v); // v = volume
    }
  };

  ws.onerror = () => setTimeout(reconnect, 5000); // 5초 후 재연결

  return () => {
    ws.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }));
    ws.close();
  };
}, [ticker]);
```

## 메시지 형식
```json
{
  "type": "trade",
  "data": [
    {
      "p": 134.50,   // price
      "s": "RKLB",  // symbol
      "t": 1706000000000, // timestamp (ms)
      "v": 1234      // volume
    }
  ]
}
```

## 프리마켓 여부 판단
```typescript
const isPremarket = (timestamp: number): boolean => {
  const date = new Date(timestamp);
  const hours = date.getUTCHours(); // UTC 기준
  // 프리마켓: 09:00~13:30 UTC (04:00~08:30 ET)
  return hours >= 9 && hours < 13;
};
```

## 재연결 패턴
```typescript
let reconnectCount = 0;
const MAX_RECONNECT = 3;

const reconnect = () => {
  if (reconnectCount < MAX_RECONNECT) {
    reconnectCount++;
    setTimeout(() => initWebSocket(), 5000 * reconnectCount);
  }
};
```

## 주의사항
- 무료 플랜: 연결당 최대 50개 심볼 구독
- 장 외 시간엔 데이터가 드물게 옴 (프리마켓도 동일)
- `NEXT_PUBLIC_` 접두사로 환경변수 노출 (클라이언트 직결이므로 anon key 수준)
