/**
 * FusionMigrate — Backend API Proxy
 * -----------------------------------
 * Keeps your Anthropic API key on the server.
 * The browser never sees it.
 *
 * Stack: Node.js + Express (zero other dependencies)
 * Run:   node server.js
 * Port:  3000 (change via PORT env var)
 */

const express  = require('express');
const https    = require('https');
const path     = require('path');
const fs       = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Read API key from environment (never hard-code it) ──
const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY environment variable is not set.');
  console.error('    Set it before starting: export ANTHROPIC_API_KEY=sk-ant-...\n');
  process.exit(1);
}

// ── Middleware ──
app.use(express.json({ limit: '10mb' }));   // large CSV batches
app.use(express.static(path.join(__dirname, '..', 'public'))); // serve the UI

// ── Optional: basic auth (uncomment + set env vars to protect the app) ──
// const BASIC_USER = process.env.APP_USER || 'admin';
// const BASIC_PASS = process.env.APP_PASS || 'changeme';
// app.use((req, res, next) => {
//   if (req.path === '/api/cleanse' || req.path === '/api/report') {
//     const auth = req.headers['authorization'] || '';
//     const b64  = auth.replace('Basic ', '');
//     const [u, p] = Buffer.from(b64, 'base64').toString().split(':');
//     if (u !== BASIC_USER || p !== BASIC_PASS) {
//       res.set('WWW-Authenticate', 'Basic realm="FusionMigrate"');
//       return res.status(401).send('Authentication required');
//     }
//   }
//   next();
// });

// ── POST /api/cleanse  ──────────────────────────────────
// Receives: { system, messages, max_tokens }
// Returns:  Anthropic API response (passes through)
app.post('/api/cleanse', async (req, res) => {
  const { system, messages, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: max_tokens || 4096,
    system,
    messages
  });

  callAnthropic(payload, res);
});

// ── POST /api/report  ──────────────────────────────────
// Receives: { messages, max_tokens }
// Returns:  Anthropic API response
app.post('/api/report', async (req, res) => {
  const { messages, max_tokens } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-6',
    max_tokens: max_tokens || 2000,
    messages
  });

  callAnthropic(payload, res);
});

// ── Shared Anthropic caller ─────────────────────────────
function callAnthropic(payload, res) {
  const options = {
    hostname: 'api.anthropic.com',
    path:     '/v1/messages',
    method:   'POST',
    headers: {
      'Content-Type':      'application/json',
      'Content-Length':    Buffer.byteLength(payload),
      'x-api-key':         ANTHROPIC_KEY,
      'anthropic-version': '2023-06-01'
    }
  };

  const apiReq = https.request(options, apiRes => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', () => {
      res.status(apiRes.statusCode).set('Content-Type', 'application/json').send(data);
    });
  });

  apiReq.on('error', err => {
    console.error('Anthropic API error:', err.message);
    res.status(502).json({ error: 'Upstream API error', detail: err.message });
  });

  apiReq.write(payload);
  apiReq.end();
}

// ── Health check ────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// ── Catch-all: serve index.html (SPA) ──────────────────
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅  FusionMigrate running at http://localhost:${PORT}`);
  console.log(`    API key: ${ANTHROPIC_KEY.substring(0,12)}... (set, not exposed to browser)`);
  console.log(`    Press Ctrl+C to stop\n`);
});
