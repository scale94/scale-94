// api/telemetry/read.js — Scale 9.4 Kernel Heatmap Reader
// GET /api/telemetry/read              → all kernels + run counts
// GET /api/telemetry/read?kernel=<id>  → full histogram for one kernel
//
// Required env vars: KV_REST_API_URL, KV_REST_API_TOKEN

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  const origin = process.env.ALLOWED_ORIGIN ?? '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET')    return res.status(405).json({ error: 'Method not allowed' });

  const { kernel } = req.query ?? {};

  try {
    if (!kernel) {
      // Index view — all kernels + run counts
      const kernelIds = await kv.smembers('hm:index');
      if (!kernelIds?.length) return res.status(200).json({ kernels: [] });

      const pipeline = kv.pipeline();
      for (const id of kernelIds) pipeline.get(`hm:${id}:runs`);
      const counts = await pipeline.exec();

      const kernels = kernelIds.map((id, i) => ({
        id,
        runs: Number(counts[i] ?? 0),
      })).sort((a, b) => b.runs - a.runs);

      return res.status(200).json({ kernels });
    }

    // Per-kernel detail view
    const kernelId = kernel.slice(0, 80);

    // Get list of param keys for this kernel
    const paramKeys = await kv.keys(`hm:${kernelId}:param:*`);
    const runs      = await kv.get(`hm:${kernelId}:runs`);

    if (!paramKeys?.length) {
      return res.status(200).json({ kernel: kernelId, runs: 0, params: {} });
    }

    const pipeline = kv.pipeline();
    for (const key of paramKeys) pipeline.hgetall(key);
    const histograms = await pipeline.exec();

    const params = {};
    for (let i = 0; i < paramKeys.length; i++) {
      const paramName = paramKeys[i].replace(`hm:${kernelId}:param:`, '');
      const raw       = histograms[i] ?? {};
      // Convert to sorted array of {value, count} for easy rendering
      params[paramName] = Object.entries(raw)
        .map(([v, c]) => ({ value: parseFloat(v), count: Number(c) }))
        .sort((a, b) => a.value - b.value);
    }

    return res.status(200).json({ kernel: kernelId, runs: Number(runs ?? 0), params });
  } catch (err) {
    console.error('[TELEMETRY] KV read error:', err.message);
    return res.status(500).json({ error: 'Storage error' });
  }
}
