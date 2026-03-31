// api/transmute/threshold.js — SOMA-9.4 Production Threshold
// GET /api/transmute/threshold
//
// Returns the persistent production threshold counter from Vercel KV.
// Called on mount + polled every 30s by useProductionThreshold hook.
// Counter is incremented atomically when a Discord "Shipped" button is clicked.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const [current, target] = await Promise.all([
    kv.get('threshold:current'),
    kv.get('threshold:target'),
  ]);

  return res.status(200).json({
    current: current != null ? Number(current) : 0,
    target:  target  != null ? Number(target)  : 10,
  });
}
