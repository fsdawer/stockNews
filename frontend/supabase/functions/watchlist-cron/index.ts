import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

Deno.serve(async (req) => {
  const authHeader = req.headers.get('Authorization');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (authHeader !== `Bearer ${serviceKey}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const { data: watchlistItems } = await supabase
    .from('watchlist')
    .select('ticker');

  if (!watchlistItems || watchlistItems.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const tickers = [...new Set(watchlistItems.map((w: { ticker: string }) => w.ticker))];
  const appUrl = Deno.env.get('APP_URL') ?? 'https://your-app.vercel.app';

  let processed = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < tickers.length; i += BATCH_SIZE) {
    const batch = tickers.slice(i, i + BATCH_SIZE);

    for (const ticker of batch) {
      try {
        await fetch(`${appUrl}/api/news/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });

        await fetch(`${appUrl}/api/market-context`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ticker }),
        });

        processed++;
        // 100ms delay to stay within Finnhub 60 req/min free-tier limit
        await new Promise(r => setTimeout(r, 100));
      } catch {
        // Continue processing remaining tickers on individual failure
      }
    }
  }

  return new Response(JSON.stringify({ processed, total: tickers.length }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
