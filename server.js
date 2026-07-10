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

// Proxy for Belle
app.all('/api/belle/:unit/*', async (req, res) => {
  const { unit } = req.params;
  const token = UNIT_TOKENS[unit];
  if (!token) {
    return res.status(400).json({ error: 'Unidade inválida' });
  }

  const endpoint = req.params[0];
  // Reconstruct query string
  const queryString = new URLSearchParams(req.query).toString();
  const url = `${BELLE_BASE_URL}/${endpoint}${queryString ? `?${queryString}` : ''}`;

  try {
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

    const response = await fetch(url, fetchOptions);
    const data = await response.text();
    
    let jsonData;
    try {
      jsonData = JSON.parse(data);
    } catch {
      jsonData = data; // some might be empty or text
    }

    res.status(response.status).send(jsonData);
  } catch (error) {
    console.error('Proxy Error Belle:', error);
    res.status(500).json({ error: error.message });
  }
});

// Proxy for Elosgate
app.all('/api/elosgate/:unit/*', async (req, res) => {
  const { unit } = req.params;
  const apiKey = FINANCIAL_UNIT_KEYS[unit];
  if (!apiKey) {
    return res.status(400).json({ error: 'Unidade inválida para financeiro' });
  }

  const endpoint = req.params[0];
  const url = `${ELOSGATE_BASE_URL}/${endpoint}`;

  try {
    // Inject APIKey into body
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

    const response = await fetch(url, fetchOptions);
    const data = await response.json();
    
    res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy Error Elosgate:', error);
    res.status(500).json({ error: error.message });
  }
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'dist')));

// Fallback for React Router (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
