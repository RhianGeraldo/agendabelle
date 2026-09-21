process.env.UV_THREADPOOL_SIZE = '128';

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const UNIT_TOKENS = {
  mantena: process.env.VITE_BELLE_MANTENA_TOKEN,
  'sao-mateus': process.env.VITE_BELLE_SAO_MATEUS_TOKEN,
  linhares: process.env.VITE_BELLE_LINHARES_TOKEN,
  aracruz: process.env.VITE_BELLE_ARACRUZ_TOKEN,
  serra: process.env.VITE_BELLE_SERRA_TOKEN,
};

const FINANCIAL_UNIT_KEYS = {
  mantena: process.env.VITE_ELOSGATE_MANTENA_KEY,
  "sao-mateus": process.env.VITE_ELOSGATE_SAO_MATEUS_KEY,
  linhares: process.env.VITE_ELOSGATE_LINHARES_KEY,
  aracruz: process.env.VITE_ELOSGATE_ARACRUZ_KEY,
  serra: process.env.VITE_ELOSGATE_SERRA_KEY,
};

const BELLE_BASE_URL = 'https://app.bellesoftware.com.br/api/release/controller/IntegracaoExterna/v1.0';
const ELOSGATE_BASE_URL = 'https://svc3.elosgate.com.br/generated/gatewaysvc.svc/json';

async function fetchWithRetry(url, options, maxRetries = 3) {
  let lastError;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.status === 429) {
        console.warn(`[PROXY RETRY] Belle Rate Limit 429 on ${url}. Backing off 3s (Attempt ${attempt}/${maxRetries})...`);
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, 3000));
          continue;
        }
      }
      return response;
    } catch (err) {
      lastError = err;
      const errorCode = err.code || err.cause?.code;
      const isTransient = errorCode === 'EAI_AGAIN' || errorCode === 'ETIMEDOUT' || errorCode === 'ECONNRESET' || errorCode === 'ECONNREFUSED';
      if (attempt < maxRetries && isTransient) {
        console.warn(`[PROXY RETRY] Attempt ${attempt} failed with ${errorCode}. Retrying in ${attempt * 250}ms... (${url})`);
        await new Promise(r => setTimeout(r, attempt * 250));
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

const apiRouter = express.Router();

// Belle API Cache
const belleCache = new Map();
const inFlightRequests = new Map();

function getBelleTTL(endpoint) {
  // Static service durations (24 hours cache - preserves optimization for duration lookup)
  if (endpoint.includes('servico/listar')) return 24 * 60 * 60 * 1000;
  // Availability slots (30 seconds cache while browsing)
  if (endpoint.includes('agenda/disponibilidade')) return 30 * 1000;
  // NEVER cache agendamentos or planos - they must reflect cancellations and bookings immediately
  if (endpoint.includes('agendamentos')) return 0;
  if (endpoint.includes('cliente/planos')) return 0;
  if (endpoint.includes('cliente/listar')) return 10 * 1000; // 10s dedup
  return 0; // default: do not cache
}

function invalidateUnitCache(unit) {
  let count = 0;
  for (const key of belleCache.keys()) {
    if (key.startsWith(`${unit}:`)) {
      belleCache.delete(key);
      count++;
    }
  }
  if (count > 0) {
    console.log(`[BELLE CACHE] Invalidated ${count} cached items for unit: ${unit}`);
  }
}

// Rate Limiter & Request Queue for Belle API
const MAX_REQUESTS_PER_MINUTE = 35; // safe margin below Belle's 40
const MIN_INTERVAL_MS = 100; // minimum ms between starting requests
const MAX_CONCURRENT = 3; // at most 3 simultaneous active connections to Belle

let activeRequests = 0;
let lastRequestStartTime = 0;
let belleRequestTimestamps = [];
const requestQueue = [];

function getWaitTimeForQuota() {
  const now = Date.now();
  belleRequestTimestamps = belleRequestTimestamps.filter(t => now - t < 60000);
  if (belleRequestTimestamps.length < MAX_REQUESTS_PER_MINUTE) {
    return 0;
  }
  const oldest = belleRequestTimestamps[0];
  return Math.max(0, 60000 - (now - oldest) + 50);
}

function processQueue() {
  if (requestQueue.length === 0) return;
  if (activeRequests >= MAX_CONCURRENT) return;

  const waitQuota = getWaitTimeForQuota();
  if (waitQuota > 0) {
    console.warn(`[BELLE QUEUE] Quota limit reached (${belleRequestTimestamps.length}/${MAX_REQUESTS_PER_MINUTE}). Waiting ${(waitQuota / 1000).toFixed(1)}s for window to slide...`);
    setTimeout(processQueue, waitQuota);
    return;
  }

  const now = Date.now();
  const timeSinceLast = now - lastRequestStartTime;
  if (timeSinceLast < MIN_INTERVAL_MS) {
    setTimeout(processQueue, MIN_INTERVAL_MS - timeSinceLast);
    return;
  }

  const item = requestQueue.shift();
  if (!item) return;

  activeRequests++;
  lastRequestStartTime = Date.now();
  belleRequestTimestamps.push(lastRequestStartTime);

  const reqCount = belleRequestTimestamps.length;
  console.log(`[BELLE QUEUE] Dispatching (Active: ${activeRequests}, Queued: ${requestQueue.length}, Rolling 60s: ${reqCount}/${MAX_REQUESTS_PER_MINUTE})`);

  item.task()
    .then(item.resolve)
    .catch(item.reject)
    .finally(() => {
      activeRequests--;
      processQueue();
    });

  if (activeRequests < MAX_CONCURRENT && requestQueue.length > 0) {
    setTimeout(processQueue, MIN_INTERVAL_MS);
  }
}

function enqueueBelleRequest(task) {
  return new Promise((resolve, reject) => {
    requestQueue.push({ task, resolve, reject });
    processQueue();
  });
}

// Proxy for Belle
apiRouter.all('/belle/:unit/*splat', async (req, res) => {
  const { unit } = req.params;
  const token = UNIT_TOKENS[unit];
  if (!token) {
    return res.status(400).json({ error: 'Unidade inválida' });
  }

  const endpoint = req.params.splat.join('/');
  const queryString = new URLSearchParams(req.query).toString();
  const cacheKey = `${unit}:${endpoint}:${queryString}`;
  const url = `${BELLE_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;

  const isNoCache = 
    req.headers['cache-control']?.includes('no-cache') ||
    req.headers['pragma']?.includes('no-cache') ||
    req.query._t ||
    req.query.nocache;

  // Serve from cache for GET requests if valid and not explicitly no-cache
  if (req.method === 'GET' && !isNoCache) {
    const cached = belleCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(cached.status).send(cached.data);
    }

    // Deduplicate in-flight concurrent requests for the exact same URL
    if (inFlightRequests.has(cacheKey)) {
      try {
        const shared = await inFlightRequests.get(cacheKey);
        res.setHeader('X-Cache', 'DEDUP');
        return res.status(shared.status).send(shared.data);
      } catch (err) {
        // Fallback to fresh fetch if shared in-flight failed
      }
    }
  }

  const doFetch = async () => {
    const fetchOptions = {
      method: req.method,
      headers: {
        Authorization: token,
      },
    };
    
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(req.body);
    }

    console.log(`[BELLE API] ${req.method} ${endpoint}${queryString ? `?${queryString}` : ''}`);

    const response = await fetchWithRetry(url, fetchOptions, 3);
    const data = await response.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data;
    }

    return { status: response.status, data: jsonData };
  };

  try {
    let result;
    if (req.method === 'GET') {
      const fetchPromise = enqueueBelleRequest(doFetch);
      inFlightRequests.set(cacheKey, fetchPromise);
      try {
        result = await fetchPromise;
      } finally {
        inFlightRequests.delete(cacheKey);
      }

      // Cache successful GET responses if TTL > 0 and not no-cache
      if (result.status >= 200 && result.status < 300) {
        const ttl = getBelleTTL(endpoint);
        if (ttl > 0 && !isNoCache) {
          belleCache.set(cacheKey, {
            status: result.status,
            data: result.data,
            expiresAt: Date.now() + ttl,
          });
        }
      }
      res.setHeader('X-Cache', 'MISS');
    } else {
      // POST/PUT/PATCH mutations invalidate cache for that unit and go through queue
      result = await enqueueBelleRequest(doFetch);
      if (result.status >= 200 && result.status < 300) {
        invalidateUnitCache(unit);
      }
    }

    res.status(result.status).send(result.data);
  } catch (error) {
    console.error('Proxy Error Belle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for Elosgate
apiRouter.all('/elosgate/:unit/*splat', async (req, res) => {
  const { unit } = req.params;
  const apiKey = FINANCIAL_UNIT_KEYS[unit];
  if (!apiKey) {
    return res.status(400).json({ error: 'Unidade inválida para financeiro' });
  }

  const endpoint = req.params.splat.join('/');
  const url = `${ELOSGATE_BASE_URL}/${endpoint}`;

  try {
    const body = {
      ...req.body,
      APIKey: apiKey,
    };

    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    };

    const response = await fetchWithRetry(url, fetchOptions, 3);
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error Elosgate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mount router on both /api and / in case Nginx strips the prefix
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router (SPA)
app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
