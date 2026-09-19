'use strict';

/**
 * Security headers and CORS.
 *
 * Two jobs:
 *   1. Helmet, with a Content-Security-Policy tuned for a page that loads
 *      Stripe.js and nothing else third-party.
 *   2. A CORS policy that fails closed — an origin that is not on the list gets
 *      no CORS headers at all, rather than a permissive echo of whatever it
 *      claimed to be.
 */

const helmet = require('helmet');
const cors = require('cors');
const { config } = require('../config');
const logger = require('../utils/logger');

/**
 * Content-Security-Policy.
 *
 * `'unsafe-inline'` appears for styles and scripts because the sales page ships
 * as a single self-contained HTML file with inline <style> and <script> — that
 * is the whole point of it being one file you can drop on any host. If you move
 * to external assets, drop those two entries; they are the only meaningful
 * weakening here. See docs/Security-Hardening.md for the nonce-based variant.
 *
 * Everything else is locked to self plus Stripe's documented origins.
 */
function buildCsp() {
  return {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      // Stripe.js must load from js.stripe.com; Stripe rejects self-hosted copies.
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://js.stripe.com'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
      imgSrc: ["'self'", 'data:', 'https:'],
      // Stripe's checkout and 3-D Secure flows run in these frames.
      frameSrc: ["'self'", 'https://js.stripe.com', 'https://hooks.stripe.com', 'https://checkout.stripe.com'],
      connectSrc: ["'self'", 'https://api.stripe.com', 'https://checkout.stripe.com'],
      formAction: ["'self'", 'https://checkout.stripe.com'],
      // Nobody should be able to frame your checkout page — clickjacking a
      // payment flow is a real attack, not a theoretical one.
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      ...(config.isProduction ? { upgradeInsecureRequests: [] } : {}),
    },
  };
}

function securityHeaders() {
  return helmet({
    contentSecurityPolicy: buildCsp(),
    // HSTS only makes sense once you are actually on HTTPS, and setting it in
    // development would poison your browser against localhost over http.
    hsts: config.isProduction
      ? { maxAge: 31_536_000, includeSubDomains: true, preload: true }
      : false,
    // Referrer leaks the full URL of your sales page — including any UTM or
    // token in the query string — to every third party you link out to.
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginEmbedderPolicy: false, // would break Stripe's iframes
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // Stripe opens popups
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

function corsPolicy() {
  const allowed = new Set(config.cors.origins);

  return cors({
    origin(origin, callback) {
      // No Origin header: same-origin navigations, curl, server-to-server,
      // and Stripe's webhook POSTs. CORS does not apply to these; allowing
      // them here does not grant a browser anything.
      if (!origin) return callback(null, true);

      if (allowed.has(origin)) return callback(null, true);

      // Fail closed and say so loudly — a blocked origin is almost always a
      // misconfigured CORS_ORIGINS on a new deploy, and this log line is how
      // you find that in under a minute.
      logger.warn('Blocked cross-origin request', { origin, allowed: [...allowed] });
      return callback(null, false);
    },
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'RateLimit-Remaining', 'RateLimit-Reset'],
    credentials: false, // we use bearer tokens, never cookies — no CSRF surface
    maxAge: 86_400,
  });
}

module.exports = { securityHeaders, corsPolicy };
