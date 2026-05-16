// QK Terminal — Candle Data Proxy Server v2.0
// Uses node-fetch for Yahoo Finance (handles redirects + modern headers)
// ─────────────────────────────────────────────────────────────────────────────

const express = require('express');
const fetch   = require('node-fetch');
const https   = require('https');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
app.use(function(req, res, next) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { res.sendStatus(200); return; }
  next();
});

// ─── Health / root ────────────────────────────────────────────────────────────
app.get('/', function(req, res) {
  res.json({ status: 'QK Proxy running', version: '2.0',
    routes: ['/yahoo-candle', '/candle', '/quote', '/insider', '/earnings', '/health'] });
});

app.get('/health', function(req, res) {
  res.json({ ok: true, uptime: Math.round(process.uptime()) + 's', version: '2.0' });
});

// ─── Route 1: Yahoo Finance Candle (primary — no key needed) ──────────────────
app.get('/yahoo-candle', async function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  if (!symbol) { return res.status(400).json({ error: 'Required param: symbol' }); }

  var now  = Math.floor(Date.now() / 1000);
  var from = now - (70 * 24 * 3600);
  var url  = 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
             '?period1=' + from + '&period2=' + now + '&interval=1d&events=history&includeAdjustedClose=true';

  try {
    var response = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Origin':          'https://finance.yahoo.com',
        'Referer':         'https://finance.yahoo.com/'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      // Try query2 as fallback
      var url2 = 'https://query2.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(symbol) +
                 '?period1=' + from + '&period2=' + now + '&interval=1d&events=history';
      var r2 = await fetch(url2, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Accept': 'application/json' }
      });
      return res.json(await r2.json());
    }

    res.json(await response.json());
  } catch (e) {
    res.status(502).json({ error: 'Yahoo Finance fetch failed: ' + e.message });
  }
});

// ─── Route 2: Finnhub Candle ──────────────────────────────────────────────────
app.get('/candle', async function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var from   = req.query.from;
  var to     = req.query.to;
  var token  = req.query.token;
  if (!symbol || !from || !to || !token) {
    return res.status(400).json({ error: 'Required params: symbol, from, to, token' });
  }
  try {
    var r = await fetch('https://finnhub.io/api/v1/stock/candle?symbol=' + encodeURIComponent(symbol) +
      '&resolution=D&from=' + from + '&to=' + to + '&token=' + token);
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ─── Route 3: Finnhub Quote ───────────────────────────────────────────────────
app.get('/quote', async function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var token  = req.query.token;
  if (!symbol || !token) { return res.status(400).json({ error: 'Required params: symbol, token' }); }
  try {
    var r = await fetch('https://finnhub.io/api/v1/quote?symbol=' + encodeURIComponent(symbol) + '&token=' + token);
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ─── Route 4: Finnhub Insider Transactions ────────────────────────────────────
app.get('/insider', async function(req, res) {
  var symbol = (req.query.symbol || '').toUpperCase();
  var token  = req.query.token;
  if (!symbol || !token) { return res.status(400).json({ error: 'Required params: symbol, token' }); }
  try {
    var r = await fetch('https://finnhub.io/api/v1/stock/insider-transactions?symbol=' + encodeURIComponent(symbol) + '&token=' + token);
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ─── Route 5: Finnhub Earnings Calendar ──────────────────────────────────────
app.get('/earnings', async function(req, res) {
  var token = req.query.token;
  if (!token) { return res.status(400).json({ error: 'Required param: token' }); }
  var url = 'https://finnhub.io/api/v1/calendar/earnings?token=' + token;
  var sym = (req.query.symbol || '').toUpperCase();
  if (sym)           { url += '&symbol=' + encodeURIComponent(sym); }
  if (req.query.from){ url += '&from=' + req.query.from; }
  if (req.query.to)  { url += '&to='   + req.query.to; }
  try {
    var r = await fetch(url);
    res.json(await r.json());
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.listen(PORT, function() {
  console.log('QK Proxy v2.0 running on port ' + PORT);
});
