/**
 * FusionMigrate — Backend API Proxy
 */

const express  = require('express');
const https    = require('https');
const path     = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY environment variable is not set.\n');
  process.exit(1);
}

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '..', 'public')));

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
    res.status(502).json({ error: 'Upstream API error', detail: err.message });
  });
  apiReq.write(payload);
  apiReq.end();
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n✅  FusionMigrate running at http://localhost:${PORT}\n`);
});
