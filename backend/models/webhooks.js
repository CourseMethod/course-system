'use strict';

/**
 * Webhook delivery log — idempotency and retry state for Stripe events.
 *
 * Stripe guarantees AT LEAST ONCE delivery, not exactly once. It retries for up
 * to three days on any non-2xx response, and it can deliver the same event
 * twice even when you returned 200 (network timeouts on our side look like
 * failures on theirs). Without the unique constraint on `stripe_event_id`, a
 * redelivered `checkout.session.completed` would mean a second delivery email
 * and a duplicated sale in your revenue figures.
 *
 * The rule this table enforces: process each Stripe event id exactly once,
 * forever.
 */

const { getDb, now } = require('./db');
const { randomId } = require('../utils/tokens');
const logger = require('../utils/logger');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

/**
 * Claim an event for processing.
 *
 * @returns {{claimed: boolean, id: string|null, previousStatus: string|null}}
 *   claimed=false means this event was already handled and must be skipped.
 */
function claim(stripeEventId, type, payload) {
  const existing = prepare('SELECT * FROM webhook_deliveries WHERE stripe_event_id = ?').get(stripeEventId);

  if (existing) {
    if (existing.status === 'processed') {
      logger.info('Duplicate webhook ignored', { stripeEventId, type });
      return { claimed: false, id: existing.id, previousStatus: existing.status };
    }
    // Previously received or failed: allow a retry to pick it up again.
    prepare('UPDATE webhook_deliveries SET attempts = attempts + 1 WHERE id = ?').run(existing.id);
    return { claimed: true, id: existing.id, previousStatus: existing.status };
  }

  const id = randomId();
  try {
    prepare(`
      INSERT INTO webhook_deliveries (id, stripe_event_id, type, status, attempts, payload, created_at)
      VALUES (?, ?, ?, 'received', 1, ?, ?)
    `).run(
      id,
      stripeEventId,
      type,
      // Store a trimmed payload for forensics without bloating the database.
      payload ? JSON.stringify(payload).slice(0, 20_000) : null,
      now()
    );
    return { claimed: true, id, previousStatus: null };
  } catch (error) {
    // UNIQUE violation: another concurrent delivery of the same event won the
    // race. That is exactly the case this table exists to catch.
    if (String(error.message).includes('UNIQUE')) {
      logger.info('Concurrent duplicate webhook ignored', { stripeEventId, type });
      return { claimed: false, id: null, previousStatus: 'received' };
    }
    throw error;
  }
}

function markProcessed(id) {
  prepare("UPDATE webhook_deliveries SET status = 'processed', processed_at = ?, last_error = NULL WHERE id = ?")
    .run(now(), id);
}

function markFailed(id, errorMessage) {
  prepare("UPDATE webhook_deliveries SET status = 'failed', last_error = ? WHERE id = ?")
    .run(String(errorMessage).slice(0, 1000), id);
}

/**
 * Events that failed and are worth another look.
 *
 * Stripe's own retries usually resolve these. What lands here permanently is a
 * bug in our handler, and it means a paying customer may not have received
 * anything — check this list whenever a "where is my course?" email arrives.
 */
function findFailed({ limit = 50 } = {}) {
  return prepare(`
    SELECT id, stripe_event_id, type, status, attempts, last_error, created_at
    FROM webhook_deliveries
    WHERE status = 'failed'
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit);
}

function stats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN status = 'processed' THEN 1 END) AS processed,
      COUNT(CASE WHEN status = 'failed' THEN 1 END)    AS failed,
      COUNT(CASE WHEN status = 'received' THEN 1 END)  AS in_flight
    FROM webhook_deliveries
  `).get();
}

function pruneOlderThan(days = 90) {
  return prepare("DELETE FROM webhook_deliveries WHERE status = 'processed' AND created_at < datetime('now', ?)")
    .run(`-${days} days`).changes;
}

module.exports = { claim, markProcessed, markFailed, findFailed, stats, pruneOlderThan };
