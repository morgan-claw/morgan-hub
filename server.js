const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WebSocket: WS } = require('ws');

const PORT = 3456;
const GW = 'http://127.0.0.1:18789';
const GW_WS = 'ws://127.0.0.1:18789';
const GW_TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN || 'ad1285515fd29335c9d91339de48edbe6500460fd02da86a';
const DIR = __dirname;

const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // Expose auth config for direct WS connections (Tailscale-only access)
  if (url.pathname === '/api/auth') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify({ token: GW_TOKEN }));
    return;
  }

  // File read/write API (workspace-relative)
  const WORKSPACE = 'C:\\Users\\openc\\.openclaw\\workspace';
  if (url.pathname === '/api/file') {
    if (req.method === 'GET') {
      const filePath = url.searchParams.get('path');
      if (!filePath) { res.writeHead(400); res.end('missing path'); return; }
      const full = path.resolve(WORKSPACE, filePath);
      if (!full.startsWith(WORKSPACE)) { res.writeHead(403); res.end('forbidden'); return; }
      try {
        const data = fs.readFileSync(full, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      } catch {
        res.writeHead(404, { 'Access-Control-Allow-Origin': '*' });
        res.end('');
      }
      return;
    }
    if (req.method === 'POST' || req.method === 'PUT') {
      let body = '';
      req.on('data', c => body += c);
      req.on('end', () => {
        try {
          const { path: fp, content } = JSON.parse(body);
          const full = path.resolve(WORKSPACE, fp);
          if (!full.startsWith(WORKSPACE)) { res.writeHead(403); res.end('forbidden'); return; }
          const dir = path.dirname(full);
          if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
          fs.writeFileSync(full, content, 'utf-8');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ ok: true }));
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }
  }

  // Proxy /api/gw/* to gateway /tools/invoke
  if (url.pathname === '/api/gw') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        const gwRes = await fetch(GW + '/tools/invoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GW_TOKEN}`,
          },
          body,
        });
        const data = await gwRes.text();
        res.writeHead(gwRes.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(data);
      } catch (e) {
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Static files
  let filePath = path.join(DIR, url.pathname === '/' ? 'index.html' : url.pathname);
  if (!path.extname(filePath)) filePath += '.html';
  console.log(`${req.method} ${url.pathname} -> ${filePath}`);
  
  try {
    const data = fs.readFileSync(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket proxy: client connects to /ws, we proxy to gateway WS
// Auth is injected server-side — clients don't need the token
const { WebSocketServer } = require('ws');
const wss = new WebSocketServer({ server, path: '/ws' });

wss.on('connection', (client, req) => {
  // Pass a valid origin to the gateway so origin check passes
  const allowedOrigin = 'https://desktop-reimhlv-1.tail801a90.ts.net:3334';
  const gw = new WS(GW_WS, {
    origin: allowedOrigin,
    headers: { 'Origin': allowedOrigin }
  });
  let gwReady = false;
  const queue = [];

  gw.on('open', () => { gwReady = true; console.log('[ws] upstream connected'); queue.forEach(m => gw.send(m)); queue.length = 0; });
  gw.on('message', (data) => { 
    const str = data.toString();
    try { const m = JSON.parse(str); if (m.type === 'event') console.log('[ws] event:', m.event); if (m.type === 'res') console.log('[ws] res:', str.slice(0,800)); if (m.type === 'err' || m.error) console.log('[ws] ERROR:', JSON.stringify(m)); } catch {}
    client.send(data); 
  });
  gw.on('close', (code) => { console.log('[ws] upstream closed:', code); client.close(); });
  gw.on('error', (e) => { console.log('[ws] upstream error:', e.message); client.close(); });

  client.on('message', (raw) => {
    let str = raw.toString();
    // Intercept connect RPC and inject token auth
    try {
      const msg = JSON.parse(str);
      if (msg.type === 'req' && msg.method === 'connect') {
        console.log('[ws] intercepting connect, injecting auth. Original auth:', JSON.stringify(msg.params.auth));
        msg.params = msg.params || {};
        msg.params.auth = { token: GW_TOKEN, password: process.env.OPENCLAW_GATEWAY_PASSWORD || 'openclaw-noah-2026' };
        str = JSON.stringify(msg);
      }
    } catch {}
    console.log('[ws] → upstream:', str.slice(0,600));
    if (gwReady) gw.send(str); else queue.push(str);
  });
  client.on('close', () => gw.close());
  client.on('error', () => gw.close());
});

server.listen(PORT, () => console.log(`Morgan Hub on http://localhost:${PORT}`));
