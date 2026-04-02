// api/transmute/status.js — SOMA-9.4 Order Status Lookup
// GET /api/transmute/status?hash=<formulaHash>
//
// Returns the fulfillment state for an order identified by its formula hash.
// Called by useOrderStatus hook after a user registers interest / acquires.

import { kv } from '@vercel/kv';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const hash = req.query.hash;
  if (!hash) return res.status(400).json({ error: 'hash parameter required' });

  const orderId = await kv.get(`order:hash:${hash}`);
  if (!orderId) return res.status(404).json({ error: 'order not found' });

  const order = await kv.hgetall(`order:${orderId}`);
  if (!order)  return res.status(404).json({ error: 'order not found' });

  return res.status(200).json({
    orderId:          order.id,
    fulfillmentState: order.fulfillmentState || 'QUEUED',
    createdAt:        order.createdAt,
  });
}
