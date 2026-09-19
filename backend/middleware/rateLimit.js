'use strict';

/**
 * Rate limiting.
 *
 * Different endpoints need wildly different limits, so there is a named limiter
 * per risk profile rather than one global number. The costs being defended
 * against are concrete:
 *
 *   checkout  — each call creates a Stripe session. A loop here pollutes your
 *               dashboard with thousands of abandoned sessions and can trip
 *               Stripe's own abuse detection against YOUR account.
 *   download  — each call streams a multi-megabyte ZIP. This is the one that
 *               produces a surprise bandwidth bill.
 *   admin     — brute-forcing the admin bearer token.
 *   support   — spam into your inbox and database.
 *
 * The webhook endpoint is deliberately NOT rate limited: Stripe can legitimately
 * burst, and dropping a webhook means a paying customer receives nothing. It is
 * protected by signature verification instead, which is stronger.
 */

const rateLimit = require('express-rate-limit');
const { config } = require('../config');
const logger = require('../utils/logger');
const events = require('../models/events');

/**
 * Shared behaviour: JSON error shaped like every other error in the API, and a
 * log line so you can see abuse in your dashboard rather than guessing.
 */
function build({ windowMs, max, name, message }) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,   // RateLimit-* headers so clients can back off
    legacyHeaders: false,
    // Skip limiting entirely in tests so the suite is not flaky.
    skip: () => config.isTest,
    handler(req, res) {
      logger.warn('Rate limit exceeded', {
        limiter: name,
        ip: req.ip,
        path: req.originalUrl.split('?')[0],
        requestId: req.id,
      });

      res.status(429).json({
        error: {
          code: 'rate_limited',
          message,
          retryAfterSeconds: Math.ceil(windowMs / 1000),
        },
        requestId: req.id,
      });
    },
  });
}

/** Broad backstop applied to the whole API. Generous; catches only real floods. */
const general = build({
  windowMs: 15 * 60 * 1000,
  max: 300,
  name: 'general',
  message: 'Too many requests. Please wait a few minutes and try again.',
});

/** Checkout session creation. Tight — a real buyer needs one or two attempts. */
const checkout = build({
  windowMs: 10 * 60 * 1000,
  max: 10,
  name: 'checkout',
  message: 'Too many checkout attempts. Please wait a few minutes, then try again. If you are stuck, email us and we will send a payment link directly.',
});

/** ZIP downloads. The per-token use counter is the real limit; this stops floods. */
const download = build({
  windowMs: 60 * 60 * 1000,
  max: 30,
  name: 'download',
  message: 'Too many download attempts. Please wait an hour, or reply to your receipt email and we will help.',
});

/**
 * Admin authentication. Very tight, because this is the endpoint an attacker
 * would grind against to guess your token.
 */
const admin = build({
  windowMs: 15 * 60 * 1000,
  max: 20,
  name: 'admin',
  message: 'Too many admin requests. Wait 15 minutes.',
});

/** Customer-submitted content: support tickets, testimonials, resend requests. */
const submission = build({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: 'submission',
  message: 'You have sent several requests already. We have them — please wait for our reply before sending another.',
});

/**
 * Analytics beacons. High ceiling because a single page view legitimately fires
 * several, but bounded so the events table cannot be filled by a script.
 */
const analytics = build({
  windowMs: 10 * 60 * 1000,
  max: 120,
  name: 'analytics',
  message: 'Too many events.',
});

/**
 * Records a failed admin auth attempt for the dashboard's security panel.
 * Separate from the limiter so it also fires on a wrong-token 401 that did not
 * hit the limit.
 */
function recordFailedAdminAuth(req) {
  events.record(events.EVENT_TYPES.ADMIN_LOGIN_FAILED, {
    payload: { ip: req.ip, userAgent: req.get('user-agent')?.slice(0, 200) },
  });
}

module.exports = { general, checkout, download, admin, submission, analytics, recordFailedAdminAuth };
