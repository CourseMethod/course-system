'use strict';

/**
 * Download link bookkeeping.
 *
 * The signed token (utils/tokens.js) proves a link was issued by us. This table
 * adds the two things a signature cannot do on its own:
 *
 *   1. Use limits — a signature is valid forever until it expires, so without a
 *      counter a customer could post their link publicly and serve unlimited
 *      free copies on your bandwidth.
 *   2. Revocation — after a refund or a chargeback, the link must stop working
 *      immediately, well before its expiry.
 */

const { getDb, now } = require('./db');
const { randomId, createToken, verifyToken } = require('../utils/tokens');
const { config } = require('../config');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

/**
 * Issue a fresh download token for a customer.
 * @returns {{token: string, expiresAt: Date}}
 */
function issue(customerId, { ttlHours = config.security.downloadTtlHours, maxUses = config.security.downloadMaxUses } = {}) {
  const ttlSeconds = ttlHours * 3600;
  const token = createToken({ sub: customerId, typ: 'download' }, ttlSeconds);

  // Pull the nonce back out of the token we just made so the database row and
  // the token refer to the same object.
  const { payload } = verifyToken(token);
  const expiresAt = new Date(payload.exp * 1000);

  prepare(`
    INSERT INTO download_tokens (id, customer_id, nonce, uses, max_uses, revoked, expires_at, created_at)
    VALUES (?, ?, ?, 0, ?, 0, ?, ?)
  `).run(randomId(), customerId, payload.nonce, maxUses, expiresAt.toISOString(), now());

  return { token, expiresAt };
}

/**
 * Validate a presented token against both the signature and the database.
 *
 * @returns {{valid: true, customerId: string, record: object}
 *          | {valid: false, reason: 'malformed'|'expired'|'bad_signature'|'unknown'|'revoked'|'exhausted'}}
 */
function validate(token) {
  const result = verifyToken(token);
  if (!result.valid) return { valid: false, reason: result.reason };

  const { payload } = result;
  if (payload.typ !== 'download') return { valid: false, reason: 'malformed' };

  const record = prepare('SELECT * FROM download_tokens WHERE nonce = ?').get(payload.nonce);

  // A correctly signed token with no matching row means the database was reset
  // or the row was pruned. Fail closed.
  if (!record) return { valid: false, reason: 'unknown' };
  if (record.revoked) return { valid: false, reason: 'revoked' };
  if (record.uses >= record.max_uses) return { valid: false, reason: 'exhausted' };

  return { valid: true, customerId: record.customer_id, record };
}

function recordUse(nonce) {
  prepare('UPDATE download_tokens SET uses = uses + 1 WHERE nonce = ?').run(nonce);
}

/** Kill every outstanding link for a customer. Called on refund and dispute. */
function revokeAllForCustomer(customerId) {
  const result = prepare('UPDATE download_tokens SET revoked = 1 WHERE customer_id = ?').run(customerId);
  return result.changes;
}

/** Housekeeping: expired rows have no further purpose. */
function pruneExpired() {
  const result = prepare("DELETE FROM download_tokens WHERE expires_at < datetime('now', '-30 days')").run();
  return result.changes;
}

module.exports = { issue, validate, recordUse, revokeAllForCustomer, pruneExpired };
