'use client';
import { useEffect, useRef, useState } from 'react';

interface TradeData {
  price: number;
  volume: number;
  timestamp: number;
  isPremarket: boolean;
}

function isPremarket(timestamp: number): boolean {
  const date = new Date(timestamp);
  const h = date.getUTCHours();
  const m = date.getUTCMinutes();
  // Pre-market ET (4:00-9:30am EDT) = UTC 8:00-13:30
  return h * 60 + m >= 8 * 60 && h * 60 + m < 13 * 60 + 30;
}

export function useFinnhubWS(ticker: string | null) {
  const [trade, setTrade] = useState<TradeData | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectCount = useRef(0);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RECONNECT = 3;

  useEffect(() => {
    if (!ticker) return;

    const apiKey = process.env.NEXT_PUBLIC_FINNHUB_KEY;
    if (!apiKey) {
      console.warn('NEXT_PUBLIC_FINNHUB_KEY not set');
      return;
    }

    function scheduleReconnect() {
      if (reconnectCount.current < MAX_RECONNECT) {
        reconnectCount.current++;
        reconnectTimer.current = setTimeout(connect, 5000 * reconnectCount.current);
      }
    }

    function connect() {
      const ws = new WebSocket(`wss://ws.finnhub.io?token=${apiKey}`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectCount.current = 0;
        ws.send(JSON.stringify({ type: 'subscribe', symbol: ticker }));
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === 'trade' && data.data?.length > 0) {
          const latest = data.data[data.data.length - 1];
          setTrade({
            price: latest.p,
            volume: latest.v,
            timestamp: latest.t,
            isPremarket: isPremarket(latest.t),
          });
        }
      };

      ws.onerror = () => scheduleReconnect();

      ws.onclose = (e) => {
        if (e.code !== 1000) scheduleReconnect();
      };
    }

    connect();

    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: 'unsubscribe', symbol: ticker }));
        }
        wsRef.current.close(1000);
      }
    };
  }, [ticker]);

  return trade;
}
