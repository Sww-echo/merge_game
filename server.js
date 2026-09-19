import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { validateResources } from './src/resources/resource-schema.js';

const ROOT_DIR = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(ROOT_DIR, 'dist');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const SCORES_FILE = path.join(DATA_DIR, 'scores.json');
const RESOURCE_SOURCE_FILE = path.join(ROOT_DIR, 'public', 'resources.json');
const RESOURCE_FILE = path.join(DATA_DIR, 'resources.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 8787);
const MAX_BODY_SIZE = 256 * 1024;

const MIME_TYPES = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

let writeQueue = Promise.resolve();

function setJsonHeaders(response) {
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
}

function sendJson(response, statusCode, payload) {
  setJsonHeaders(response);
  response.writeHead(statusCode);
  response.end(JSON.stringify(payload));
}

async function ensureScoreFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(SCORES_FILE);
  } catch {
    await fs.writeFile(SCORES_FILE, JSON.stringify({ scores: [] }, null, 2));
  }
}

async function readScoreStore() {
  await ensureScoreFile();
  try {
    const data = JSON.parse(await fs.readFile(SCORES_FILE, 'utf8'));
    return { scores: Array.isArray(data.scores) ? data.scores : [] };
  } catch {
    return { scores: [] };
  }
}

async function writeScoreStore(store) {
  const temporaryFile = `${SCORES_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(store, null, 2));
  await fs.rename(temporaryFile, SCORES_FILE);
}

async function ensureResourceFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(RESOURCE_FILE);
  } catch {
    const source = await fs.readFile(RESOURCE_SOURCE_FILE, 'utf8');
    await fs.writeFile(RESOURCE_FILE, source);
  }
}

async function readResourceStore() {
  await ensureResourceFile();
  try {
    const data = JSON.parse(await fs.readFile(RESOURCE_FILE, 'utf8'));
    return validateResources(data);
  } catch {
    const source = JSON.parse(await fs.readFile(RESOURCE_SOURCE_FILE, 'utf8'));
    return validateResources(source);
  }
}

async function writeResourceStore(resources) {
  const temporaryFile = `${RESOURCE_FILE}.${process.pid}.tmp`;
  await fs.writeFile(temporaryFile, JSON.stringify(resources, null, 2));
  await fs.rename(temporaryFile, RESOURCE_FILE);
}

function appendScore(score) {
  const operation = writeQueue.then(async () => {
    const store = await readScoreStore();
    store.scores.push(score);
    store.scores.sort((a, b) => b.score - a.score || b.createdAt.localeCompare(a.createdAt));
    store.scores = store.scores.slice(0, 1000);
    await writeScoreStore(store);
    return store;
  });

  writeQueue = operation.catch(() => {});
  return operation;
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';

    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE) {
        reject(new Error('Request body is too large.'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

async function handleScores(request, response, url) {
  if (request.method === 'GET') {
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit') || 10), 1), 100);
    const store = await readScoreStore();
    sendJson(response, 200, { scores: store.scores.slice(0, limit) });
    return;
  }

  if (request.method !== 'POST') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid JSON.' });
    return;
  }

  const name = String(payload.name || 'Player').trim().slice(0, 24) || 'Player';
  const score = Number(payload.score);
  if (!Number.isInteger(score) || score < 0 || score > 1_000_000_000) {
    sendJson(response, 400, { error: 'Score must be a non-negative integer.' });
    return;
  }

  const record = {
    id: crypto.randomUUID(),
    playerId: String(payload.playerId || 'anonymous').slice(0, 80),
    name,
    score,
    createdAt: new Date().toISOString(),
  };
  const store = await appendScore(record);
  const rank = store.scores.findIndex((item) => item.id === record.id) + 1;
  sendJson(response, 201, { ok: true, record, rank });
}

async function handleResources(request, response) {
  if (request.method === 'GET') {
    sendJson(response, 200, await readResourceStore());
    return;
  }

  if (request.method !== 'PUT') {
    sendJson(response, 405, { error: 'Method not allowed.' });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readRequestBody(request));
    validateResources(payload);
  } catch (error) {
    sendJson(response, 400, { error: error.message || 'Invalid resource configuration.' });
    return;
  }

  await writeResourceStore(payload);
  sendJson(response, 200, { ok: true, resources: payload });
}

async function serveStatic(request, response, url) {
  if (url.pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API endpoint not found.' });
    return;
  }

  const relativePath = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(DIST_DIR, relativePath);
  if (!filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  try {
    const file = await fs.readFile(filePath);
    response.setHeader('Content-Type', MIME_TYPES[path.extname(filePath)] || 'application/octet-stream');
    response.writeHead(200);
    response.end(file);
  } catch {
    response.writeHead(404);
    response.end('Not found');
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || `${HOST}:${PORT}`}`);

  if (request.method === 'OPTIONS') {
    setJsonHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  try {
    if (url.pathname === '/api/scores') {
      await handleScores(request, response, url);
    } else if (url.pathname === '/api/resources') {
      await handleResources(request, response);
    } else {
      await serveStatic(request, response, url);
    }
  } catch (error) {
    console.error(error);
    sendJson(response, 500, { error: 'Internal server error.' });
  }
});

server.listen(PORT, HOST, () => {
  console.log(`Suika service running at http://${HOST}:${PORT}`);
});
