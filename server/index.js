import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3001;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'app-data.json');

function sendJson(res, status, payload) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
  });
  res.end(JSON.stringify(payload));
}

async function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';

    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });

    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function isValidAppData(data) {
  return (
    data &&
    typeof data === 'object' &&
    Array.isArray(data.users) &&
    Array.isArray(data.schedules) &&
    Array.isArray(data.doublesMatches)
  );
}

async function handleGetAppData(res) {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    if (!isValidAppData(parsed)) {
      return sendJson(res, 500, { message: 'Stored data is invalid.' });
    }

    return sendJson(res, 200, parsed);
  } catch (error) {
    if (error && error.code === 'ENOENT') {
      return sendJson(res, 404, { message: 'App data is not initialized yet.' });
    }

    return sendJson(res, 500, { message: 'Failed to load app data.' });
  }
}

async function handlePutAppData(req, res) {
  try {
    const rawBody = await readRequestBody(req);
    const parsed = JSON.parse(rawBody || '{}');

    if (!isValidAppData(parsed)) {
      return sendJson(res, 400, { message: 'Invalid app data shape.' });
    }

    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DATA_FILE, JSON.stringify(parsed, null, 2), 'utf-8');

    return sendJson(res, 200, { ok: true });
  } catch (error) {
    return sendJson(res, 500, { message: 'Failed to save app data.' });
  }
}

const server = http.createServer(async (req, res) => {
  if (!req.url || !req.method) {
    return sendJson(res, 400, { message: 'Bad request' });
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method === 'GET' && url.pathname === '/api/app-data') {
    return handleGetAppData(res);
  }

  if (req.method === 'PUT' && url.pathname === '/api/app-data') {
    return handlePutAppData(req, res);
  }

  return sendJson(res, 404, { message: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`API server running at http://localhost:${PORT}`);
});
