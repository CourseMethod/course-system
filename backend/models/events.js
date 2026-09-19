'use strict';

/**
 * Event log — powers the conversion funnel and doubles as an audit trail.
 *
 * Events are written on a best-effort basis: analytics must never be the reason
 * a purchase fails. Every write is wrapped so a logging failure cannot
 * propagate into the request path.
 */

const { getDb, now } = require('./db');
const { randomId } = require('../utils/tokens');
const logger = require('../utils/logger');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

/** Canonical event names. Keeping them in one place stops typo-driven drift. */
const EVENT_TYPES = {
  PAGE_VIEW: 'page_view',
  PRICING_VIEW: 'pricing_view',
  CHECKOUT_STARTED: 'checkout_started',
  CHECKOUT_ABANDONED: 'checkout_abandoned',
  PURCHASE_COMPLETED: 'purchase_completed',
  DOWNLOAD_STARTED: 'download_started',
  DOWNLOAD_FAILED: 'download_failed',
  EMAIL_SENT: 'email_sent',
  EMAIL_OPENED: 'email_opened',
  EMAIL_CLICKED: 'email_clicked',
  REFUND_REQUESTED: 'refund_requested',
  REFUND_ISSUED: 'refund_issued',
  DISPUTE_OPENED: 'dispute_opened',
  TICKET_CREATED: 'ticket_created',
  TESTIMONIAL_SUBMITTED: 'testimonial_submitted',
  ADMIN_LOGIN_FAILED: 'admin_login_failed',
};

/**
 * Record an event.
 * @param {string} type  One of EVENT_TYPES.
 * @param {object} [options]
 * @param {string} [options.customerId]
 * @param {string} [options.sessionKey]  Anonymous visitor id, for funnel joins.
 * @param {object} [options.payload]
 */
function record(type, { customerId = null, sessionKey = null, payload = null } = {}) {
  try {
    prepare(`
      INSERT INTO events (id, type, customer_id, session_key, payload, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      randomId(),
      type,
      customerId,
      sessionKey,
      payload ? JSON.stringify(payload) : null,
      now()
    );
  } catch (error) {
    // Swallow deliberately. A full disk or locked database should not turn a
    // successful purchase into a 500.
    logger.warn('Failed to record event', { type, error: error.message });
  }
}

/**
 * The conversion funnel over a window.
 *
 * Counts are of DISTINCT session keys, not raw events, so one visitor
 * refreshing the pricing section ten times does not inflate the denominator.
 */
function funnel({ days = 30 } = {}) {
  const db = getDb();

  const countDistinct = (type) => {
    const row = db.prepare(`
      SELECT COUNT(DISTINCT COALESCE(session_key, id)) AS count
      FROM events
      WHERE type = ? AND created_at >= datetime('now', ?)
    `).get(type, `-${days} days`);
    return row.count;
  };

  const visitors = countDistinct(EVENT_TYPES.PAGE_VIEW);
  const pricingViews = countDistinct(EVENT_TYPES.PRICING_VIEW);
  const checkoutsStarted = countDistinct(EVENT_TYPES.CHECKOUT_STARTED);
  const purchases = countDistinct(EVENT_TYPES.PURCHASE_COMPLETED);

  const rate = (numerator, denominator) => (denominator > 0 ? numerator / denominator : 0);

  return {
    window_days: days,
    steps: [
      { step: 'Visited page', count: visitors, conversion_from_previous: 1, conversion_from_top: 1 },
      { step: 'Viewed pricing', count: pricingViews, conversion_from_previous: rate(pricingViews, visitors), conversion_from_top: rate(pricingViews, visitors) },
      { step: 'Started checkout', count: checkoutsStarted, conversion_from_previous: rate(checkoutsStarted, pricingViews), conversion_from_top: rate(checkoutsStarted, visitors) },
      { step: 'Completed purchase', count: purchases, conversion_from_previous: rate(purchases, checkoutsStarted), conversion_from_top: rate(purchases, visitors) },
    ],
    // The number to watch. Under 1% means the page or the traffic is wrong;
    // over 3% on cold traffic is strong. See docs/Analytics-Setup.md.
    overall_conversion_rate: rate(purchases, visitors),
    // Where the money is leaking: people who clicked buy and did not finish.
    checkout_abandonment_rate: checkoutsStarted > 0 ? rate(checkoutsStarted - purchases, checkoutsStarted) : 0,
  };
}

/** Raw recent events for the dashboard activity feed. */
function recent({ limit = 100, type = null } = {}) {
  const conditions = [];
  const params = [];
  if (type) { conditions.push('type = ?'); params.push(type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  return prepare(`
    SELECT * FROM events
    ${where}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(...params, limit).map((row) => ({
    ...row,
    payload: row.payload ? safeParse(row.payload) : null,
  }));
}

function safeParse(json) {
  try { return JSON.parse(json); } catch { return null; }
}

/** Event volume per day, for the dashboard chart. */
function dailyCounts({ type, days = 30 }) {
  return prepare(`
    SELECT date(created_at) AS day, COUNT(*) AS count
    FROM events
    WHERE type = ? AND created_at >= datetime('now', ?)
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all(type, `-${days} days`);
}

/**
 * Delete events older than the retention window.
 *
 * Two reasons to run this: the table is the fastest-growing thing in the
 * database, and holding visitor-level records indefinitely is a data-protection
 * liability you do not need. Purchase records in `customers` are untouched.
 */
function pruneOlderThan(days = 400) {
  const result = prepare("DELETE FROM events WHERE created_at < datetime('now', ?)").run(`-${days} days`);
  if (result.changes > 0) {
    logger.info(`Pruned ${result.changes} events older than ${days} days`);
  }
  return result.changes;
}

module.exports = { EVENT_TYPES, record, funnel, recent, dailyCounts, pruneOlderThan };
