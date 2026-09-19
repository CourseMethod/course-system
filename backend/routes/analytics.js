'use strict';

/**
 * Analytics collection.
 *
 * First-party, minimal and cookie-free by design. The sales page generates a
 * random `sessionKey` in sessionStorage — no cookie, no fingerprint, no
 * cross-site identifier — which is enough to join a visit to a purchase for
 * funnel maths and nothing more. That keeps you outside the scope of most
 * consent-banner requirements, which is worth more than the extra data a
 * third-party tracker would give you.
 *
 * Notably absent: IP addresses and user agents are not stored against events.
 */

const express = require('express');
const rateLimiters = require('../middleware/rateLimit');
const events = require('../models/events');

const router = express.Router();

/** Only these can be reported by the client. An open endpoint would let anyone fill the table. */
const CLIENT_EVENTS = new Set([
  events.EVENT_TYPES.PAGE_VIEW,
  events.EVENT_TYPES.PRICING_VIEW,
  events.EVENT_TYPES.CHECKOUT_ABANDONED,
]);

/**
 * POST /api/track
 * Body: { type, sessionKey, payload? }
 *
 * Always returns 204, even for a rejected event. A tracking beacon that returns
 * an error teaches nothing useful to a legitimate client and gives a probing
 * one a signal.
 */
router.post('/track', rateLimiters.analytics, (req, res) => {
  try {
    const { type, sessionKey, payload } = req.body || {};

    if (typeof type === 'string' && CLIENT_EVENTS.has(type)) {
      events.record(type, {
        sessionKey: typeof sessionKey === 'string' ? sessionKey.slice(0, 64) : null,
        payload: sanitisePayload(payload),
      });
    }
  } catch (error) {
    req.log?.warn('Track beacon failed', { error: error.message });
  }

  res.status(204).end();
});

/**
 * Keep client-supplied payloads small and flat. Without this, a crafted beacon
 * could store a megabyte of nested JSON per request.
 */
function sanitisePayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return null;

  const out = {};
  let count = 0;

  for (const [key, value] of Object.entries(payload)) {
    if (count >= 10) break;
    if (typeof key !== 'string' || key.length > 40) continue;

    if (typeof value === 'string') out[key] = value.slice(0, 200);
    else if (typeof value === 'number' && Number.isFinite(value)) out[key] = value;
    else if (typeof value === 'boolean') out[key] = value;
    else continue;

    count += 1;
  }

  return Object.keys(out).length > 0 ? out : null;
}

module.exports = router;
