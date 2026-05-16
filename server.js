// QK Terminal — Candle Data Proxy Server
// Deploys to Railway / Render / Fly.io in under 5 minutes
// Bypasses corporate/ISP firewalls that block direct browser requests to financial APIs
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const https   = require('https');
const http    = require('http');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS — allow requests from the browser (any origin) ──────────────────────
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/', function(req, res) {
  res.json({
    status:  'QK Proxy running',
    version: '1.0',
    routes:  ['/candle', '/quote', '/health']
  });
});

app.get('/health', function(req, res) {
  res.json({ ok: true, uptime: Math.round(process.uptime()) + 's' });
});

// ─── Utility: fetch a URL and pipe JSON back ──────────────────────────────────
function proxyFetch(url, res) {
  var lib = url.startsWith('https') ? https : http;
  var req = lib.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; QKProxy/1.0)',
      'Accept':     'application/json'
    }
  }, function(response) {
    var data = '';
    response.on('data', function(chunk) { data += chunk; });
    response.on('end', function() {
      try {
        res.json(JSON.parse(data));
      } catch (e) {
        res.status(502).json({ error: 'Invalid JSON from upstream', raw: data.slice(0, 200) });
      }
    });
  });
  req.on('error', function(e) {
    res.status(502).json({ error: 'Upstream fetch failed: ' + e.message });
  });
  req.setTimeout(10000, function() {
    req.destroy();
    res.status(504).json({ error: 'Upstream timeout' });
  });
}

// ─── Route 1: Finnhub Candle ──────────────────────────────────────────────────
// Browser calls: GET /candle?symbol=NVDA&from=1714000000&to=1716000000&token=YOUR_KEY
// Proxy fetches from Finnhub and returns data with CORS headers
app.get('/candle', function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var from   = req.query.from;
  var to     = req.query.to;
  var token  = req.query.token;

  if (!symbol || !from || !to || !token) {
    return res.status(400).json({ error: 'Required params: symbol, from, to, token' });
  }

  var url = 'https://finnhub.io/api/v1/stock/candle?symbol=' + encodeURIComponent(symbol) +
            '&resolution=D&from=' + from + '&to=' + to + '&token=' + token;
  proxyFetch(url, res);
});

// ─── Route 2: Yahoo Finance Candle (fallback — no key needed) ─────────────────
// Browser calls: GET /yahoo-candle?symbol=NVDA
app.get('/yahoo-candle', function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  if (!symbol) { return res.status(400).json({ error: 'Required param: symbol' }); }

  var now  = Math.floor(Date.now() / 1000);
  var from = now - (70 * 24 * 3600);
  var url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
             '?period1=' + from + '&period2=' + now + '&interval=1d&events=history';
  proxyFetch(url, res);
});

// ─── Route 3: Finnhub Quote ───────────────────────────────────────────────────
// Browser calls: GET /quote?symbol=NVDA&token=YOUR_KEY
app.get('/quote', function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var token  = req.query.token;
  if (!symbol || !token) { return res.status(400).json({ error: 'Required params: symbol, token' }); }

  var url = 'https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + token;
  proxyFetch(url, res);
});

// ─── Route 4: Finnhub Insider Transactions ───────────────────────────────────
app.get('/insider', function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var token  = req.query.token;
  if (!symbol || !token) { return res.status(400).json({ error: 'Required params: symbol, token' }); }

  var url = 'https://finnhub.io/api/v1/stock/insider-transactions?symbol=' + encodeURIComponent(symbol) + '&token=' + token;
  proxyFetch(url, res);
});

// ─── Route 5: Finnhub Earnings Calendar ──────────────────────────────────────
app.get('/earnings', function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var from   = req.query.from;
  var to     = req.query.to;
  var token  = req.query.token;
  if (!token) { return res.status(400).json({ error: 'Required param: token' }); }

  var url = 'https://finnhub.io/api/v1/calendar/earnings?token=' + token;
  if (symbol) { url += '&symbol=' + encodeURIComponent(symbol); }
  if (from)   { url += '&from=' + from; }
  if (to)     { url += '&to=' + to; }
  proxyFetch(url, res);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, function() {
  console.log('QK Proxy running on port ' + PORT);
});
