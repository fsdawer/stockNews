const API_KEY = process.env.FMP_API_KEY;
fetch(`https://financialmodelingprep.com/stable/historical-price-eod/light?symbol=AAPL&limit=2&apikey=${API_KEY}`)
  .then(r => r.text())
  .then(console.log);
