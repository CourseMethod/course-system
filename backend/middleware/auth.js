'use strict';

/**
 * Admin authentication.
 *
 * A single bearer token, compared in constant time. That is the right level of
 * machinery for a one-operator business: there is exactly one admin, tokens do
 * not need revocation lists, and a password database would be more attack
 * surface than it removes.
 *
 * What makes it safe enough:
 *   - The token is >= 32 characters of random hex (enforced in config).
 *   - Comparison is constant-time, so the token cannot be recovered byte by
 *     byte from response timing.
 *   - The route is rate limited hard, and failures are logged and counted.
 *   - Responses never distinguish "no token" from "wrong token" in a way that
 *     helps an attacker.
 *
 * If you ever add a second person, move to per-user tokens with a `users` table
 * before sharing this one. See docs/Security-Hardening.md.
 */

const { config } = require('../config');
const { UnauthorizedError } = require('../utils/errors');
const { safeCompare } = require('../utils/tokens');
const { recordFailedAdminAuth } = require('./rateLimit');

/**
 * Extract a bearer token from the Authorization header.
 * Also accepts `?token=` for the admin dashboard's initial load, because a
 * static HTML page cannot set headers on its own first navigation. That query
 * form is only ever read here and never logged (requestContext strips query
 * strings from its log lines).
 */
function extractToken(req) {
  const header = req.get('authorization') || '';
  if (header.toLowerCase().startsWith('bearer ')) {
    return header.slice(7).trim();
  }
  if (typeof req.query.token === 'string' && req.query.token) {
    return req.query.token.trim();
  }
  return null;
}

function requireAdmin(req, res, next) {
  const presented = extractToken(req);

  if (!presented) {
    recordFailedAdminAuth(req);
    req.log?.warn('Admin request with no credentials', { ip: req.ip });
    return next(new UnauthorizedError('Admin authentication required.'));
  }

  if (!safeCompare(presented, config.security.adminToken)) {
    recordFailedAdminAuth(req);
    req.log?.warn('Admin request with invalid token', { ip: req.ip });
    // Identical message and status to the missing-token case.
    return next(new UnauthorizedError('Admin authentication required.'));
  }

  req.isAdmin = true;
  return next();
}

module.exports = { requireAdmin };
