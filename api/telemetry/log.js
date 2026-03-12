// api/telemetry/log.js — Scale 9.4 Kernel Heatmap Logger
// POST /api/telemetry/log
//
// Receives anonymous WASM kernel run data and increments histogram buckets.
// No PII — only kernel ID, parameter names, and bucketed numeric values.
//
// Storage schema (Vercel KV / Redis):
//   hm:{kernelId}:runs               → integer (total run count)
//   hm:{kernelId}:param:{paramName}  → hash { bucket: count }
//   hm:index                         → set of kernelIds with data
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN (set via Vercel dashboard)

import { kv } from '@vercel/kv';

const MAX_PARAMS   = 12;   // guard against bloated payloads
const MAX_KERN_LEN = 80;
const MAX_PARAM_LEN = 40;

function bucketValue(val) {
  if (typeof val !== 'number' || !isFinite(val)) return null;
  // Round to 3 significant figures — preserves enough resolution without
  // creating a unique bucket per floating-point representation
  if (val === 0) return '0';
  const mag = Math.floor(Math.log10(Math.abs(val)));
  const factor = Math.pow(10, 2 - mag);
  return String(Math.round(val * factor) / factor);
}

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { kernel, params } = body ?? {};

  if (!kernel || typeof kernel !== 'string' || kernel.length > MAX_KERN_LEN) {
    return res.status(400).json({ error: 'Missing or invalid kernel' });
  }
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return res.status(400).json({ error: 'Missing or invalid params' });
  }

  const kernelId = kernel.slice(0, MAX_KERN_LEN);
  const paramEntries = Object.entries(params).slice(0, MAX_PARAMS);

  try {
    const pipeline = kv.pipeline();

    // Increment total run counter
    pipeline.incr(`hm:${kernelId}:runs`);

    // Track which kernels have data
    pipeline.sadd('hm:index', kernelId);

    // Bucket each param value
    for (const [paramName, val] of paramEntries) {
      const name   = String(paramName).slice(0, MAX_PARAM_LEN);
      const bucket = bucketValue(val);
      if (bucket === null) continue;
      pipeline.hincrby(`hm:${kernelId}:param:${name}`, bucket, 1);
    }

    await pipeline.exec();
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[TELEMETRY] KV write error:', err.message);
    return res.status(500).json({ error: 'Storage error' });
  }
}
