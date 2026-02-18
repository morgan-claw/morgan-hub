const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');
const { WebSocket: WS } = require('ws');

// Prevent uncaught errors from crashing the server
process.on('uncaughtException', (err) => {
  console.error('[MHub] Uncaught exception (not crashing):', err.message);
});
process.on('unhandledRejection', (err) => {
  console.error('[MHub] Unhandled rejection (not crashing):', err?.message || err);
});

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

  // CORS preflight — must be before route handlers
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    res.end();
    return;
  }

  // Hevy fitness API — direct REST calls (no CLI spawning)
  const HEVY_API_KEY = 'c9317013-3db9-4abe-b499-eaa5b35a1309';
  const HEVY_BASE = 'https://api.hevyapp.com/v1';
  
  if (url.pathname.startsWith('/api/hevy/')) {
    const route = url.pathname.replace('/api/hevy/', '');
    const routeMap = {
      'workouts': '/workouts',
      'routines': '/routines',
      'exercises': '/exercise_templates',
      'workout-count': '/workout_count',
    };
    const apiPath = routeMap[route];
    if (!apiPath) { res.writeHead(404, { 'Content-Type': 'application/json' }); res.end('{"error":"unknown route"}'); return; }

    try {
      const params = new URLSearchParams();
      for (const [k, v] of url.searchParams) params.set(k, v);
      const hevyUrl = `${HEVY_BASE}${apiPath}${params.toString() ? '?' + params : ''}`;
      const hevyRes = await fetch(hevyUrl, { headers: { 'api-key': HEVY_API_KEY, 'Accept': 'application/json' } });
      const data = await hevyRes.text();
      res.writeHead(hevyRes.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    } catch (e) {
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Legacy /api/fitness route — redirect to /api/hevy
  if (url.pathname === '/api/fitness') {
    const endpoint = url.searchParams.get('endpoint') || 'hevy.get_workouts';
    const page = url.searchParams.get('page') || '1';
    const pageSize = url.searchParams.get('pageSize') || '10';
    // Map mcporter tool names to Hevy REST endpoints
    const endpointMap = {
      'hevy.get_workouts': '/workouts',
      'hevy.get_all_workouts': '/workouts',
      'hevy.get_routines': '/routines',
      'hevy.get_all_routines': '/routines',
      'hevy.get_exercise_templates': '/exercise_templates',
      'hevy.get_workout_count': '/workout_count',
    };
    const apiPath = endpointMap[endpoint] || '/workouts';
    try {
      const hevyUrl = `${HEVY_BASE}${apiPath}?page=${page}&pageSize=${pageSize}`;
      console.log(`[fitness] ${endpoint} → ${hevyUrl}`);
      const hevyRes = await fetch(hevyUrl, { headers: { 'api-key': HEVY_API_KEY, 'Accept': 'application/json' } });
      const data = await hevyRes.text();
      res.writeHead(hevyRes.status, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(data);
    } catch (e) {
      console.error('[fitness] API error:', e.message);
      res.writeHead(502, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // Vault-DB API — direct SQLite access for habits etc.
  if (url.pathname === '/api/vault-db') {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
      res.end(); return;
    }
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const { action, sql } = JSON.parse(body);
        const { DatabaseSync } = require('node:sqlite');
        const dbPath = path.resolve(__dirname, '..', '..', 'data', 'vault.db');
        const db = new DatabaseSync(dbPath);
        let result;
        if (action === 'query') {
          const stmt = db.prepare(sql);
          result = { rows: stmt.all() };
        } else if (action === 'execute') {
          const stmt = db.prepare(sql);
          const r = stmt.run();
          result = { changes: r.changes, lastId: r.lastInsertRowid };
        } else {
          throw new Error('Unknown action: ' + action);
        }
        db.close();
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify(result));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({ error: e.message }));
      }
    });
    return;
  }

  // Proxy /api/gw/* to gateway /tools/invoke
  if (url.pathname === '/api/gw') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', async () => {
      try {
        // Inject sessionKey if not provided — tools/invoke needs it for scoping
        let parsed;
        try { parsed = JSON.parse(body); } catch { parsed = {}; }
        if (!parsed.sessionKey) parsed.sessionKey = 'agent:main:main';
        const gwRes = await fetch(GW + '/tools/invoke', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${GW_TOKEN}`,
          },
          body: JSON.stringify(parsed),
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
