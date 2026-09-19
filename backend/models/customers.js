'use strict';

/**
 * Customer records — the most valuable data in this system.
 *
 * Every query is a prepared statement with bound parameters. Statements are
 * lazily prepared and cached, because better-sqlite3 statement preparation is
 * the expensive part and these run on the webhook hot path.
 */

const { getDb, now } = require('./db');
const { randomId } = require('../utils/tokens');

/** Lazy prepared-statement cache, keyed by SQL text. */
const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) {
    statementCache.set(sql, getDb().prepare(sql));
  }
  return statementCache.get(sql);
}

/**
 * Record a completed purchase.
 *
 * Idempotent on `stripe_session_id`: if Stripe redelivers the webhook, the
 * INSERT is ignored and the existing row comes back. The caller uses the
 * returned `isNew` flag to decide whether to send the delivery email, which is
 * what stops a customer getting three copies of the same course.
 *
 * @returns {{customer: object, isNew: boolean}}
 */
function createFromCheckout({
  email,
  tier,
  amountCents,
  currency,
  stripeSessionId,
  stripePaymentIntent,
  stripeCustomerId,
  attribution = {},
}) {
  const existing = findByStripeSession(stripeSessionId);
  if (existing) return { customer: existing, isNew: false };

  const id = randomId();
  const timestamp = now();

  prepare(`
    INSERT INTO customers (
      id, email, tier, amount_cents, currency,
      stripe_session_id, stripe_payment_intent, stripe_customer_id,
      status, download_count,
      utm_source, utm_medium, utm_campaign, referrer,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'paid', 0, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    email,
    tier,
    amountCents,
    currency,
    stripeSessionId,
    stripePaymentIntent || null,
    stripeCustomerId || null,
    attribution.utmSource || null,
    attribution.utmMedium || null,
    attribution.utmCampaign || null,
    attribution.referrer || null,
    timestamp,
    timestamp
  );

  return { customer: findById(id), isNew: true };
}

function findById(id) {
  if (!id) return null;
  return prepare('SELECT * FROM customers WHERE id = ?').get(id) || null;
}

function findByStripeSession(sessionId) {
  if (!sessionId) return null;
  return prepare('SELECT * FROM customers WHERE stripe_session_id = ?').get(sessionId) || null;
}

function findByPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) return null;
  return prepare('SELECT * FROM customers WHERE stripe_payment_intent = ?').get(paymentIntentId) || null;
}

/** All purchases for an address — a customer may have bought more than once. */
function findByEmail(email) {
  if (!email) return [];
  return prepare('SELECT * FROM customers WHERE email = ? ORDER BY created_at DESC').all(email.toLowerCase());
}

/** Their most recent non-refunded purchase, used for self-serve re-delivery. */
function findActiveByEmail(email) {
  if (!email) return null;
  return prepare(`
    SELECT * FROM customers
    WHERE email = ? AND status = 'paid'
    ORDER BY created_at DESC
    LIMIT 1
  `).get(email.toLowerCase()) || null;
}

function recordDownload(customerId) {
  prepare(`
    UPDATE customers
    SET download_count = download_count + 1,
        last_download_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(now(), now(), customerId);
}

/** @param {'paid'|'refunded'|'disputed'} status */
function updateStatus(customerId, status) {
  prepare('UPDATE customers SET status = ?, updated_at = ? WHERE id = ?').run(status, now(), customerId);
  return findById(customerId);
}

/**
 * Paginated listing for the admin dashboard.
 *
 * Note the ORDER BY handling: `sort` is checked against a whitelist and only
 * ever becomes a literal column name we control. User input never reaches the
 * SQL string — a column name cannot be a bound parameter, so the whitelist is
 * the only safe way to do this.
 */
const SORTABLE_COLUMNS = {
  created_at: 'created_at',
  amount: 'amount_cents',
  email: 'email',
  tier: 'tier',
};

function list({ limit = 50, offset = 0, status = null, tier = null, search = null, sort = 'created_at', direction = 'desc' } = {}) {
  const column = SORTABLE_COLUMNS[sort] || 'created_at';
  const order = direction === 'asc' ? 'ASC' : 'DESC';

  const conditions = [];
  const params = [];

  if (status) { conditions.push('status = ?'); params.push(status); }
  if (tier) { conditions.push('tier = ?'); params.push(tier); }
  if (search) {
    // Bound parameter — the wildcards are added to the VALUE, not the SQL.
    conditions.push('email LIKE ?');
    params.push(`%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = prepare(`
    SELECT * FROM customers
    ${where}
    ORDER BY ${column} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = prepare(`SELECT COUNT(*) AS total FROM customers ${where}`).get(...params);

  return { customers: rows, total, limit, offset };
}

/**
 * Headline numbers for the dashboard. Refunded and disputed sales are excluded
 * from revenue — reporting gross revenue you had to give back is how people end
 * up believing a business is healthier than it is.
 */
function stats() {
  const db = getDb();

  const totals = db.prepare(`
    SELECT
      COUNT(*)                                                   AS total_customers,
      COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_cents ELSE 0 END), 0) AS net_revenue_cents,
      COALESCE(SUM(amount_cents), 0)                             AS gross_revenue_cents,
      COUNT(CASE WHEN status = 'refunded' THEN 1 END)            AS refunds,
      COUNT(CASE WHEN status = 'disputed' THEN 1 END)            AS disputes,
      COUNT(CASE WHEN tier = 'method'  AND status = 'paid' THEN 1 END) AS method_sales,
      COUNT(CASE WHEN tier = 'engine'  AND status = 'paid' THEN 1 END) AS engine_sales
    FROM customers
  `).get();

  const last30 = db.prepare(`
    SELECT
      COUNT(*) AS sales,
      COALESCE(SUM(amount_cents), 0) AS revenue_cents
    FROM customers
    WHERE status = 'paid' AND created_at >= datetime('now', '-30 days')
  `).get();

  const last7 = db.prepare(`
    SELECT
      COUNT(*) AS sales,
      COALESCE(SUM(amount_cents), 0) AS revenue_cents
    FROM customers
    WHERE status = 'paid' AND created_at >= datetime('now', '-7 days')
  `).get();

  const daily = db.prepare(`
    SELECT
      date(created_at) AS day,
      COUNT(*) AS sales,
      COALESCE(SUM(amount_cents), 0) AS revenue_cents
    FROM customers
    WHERE created_at >= datetime('now', '-30 days')
    GROUP BY date(created_at)
    ORDER BY day ASC
  `).all();

  const bySource = db.prepare(`
    SELECT
      COALESCE(utm_source, 'direct') AS source,
      COUNT(*) AS sales,
      COALESCE(SUM(amount_cents), 0) AS revenue_cents
    FROM customers
    WHERE status = 'paid'
    GROUP BY COALESCE(utm_source, 'direct')
    ORDER BY sales DESC
  `).all();

  const paidCount = totals.total_customers - totals.refunds - totals.disputes;

  return {
    ...totals,
    paid_customers: paidCount,
    average_order_cents: paidCount > 0 ? Math.round(totals.net_revenue_cents / paidCount) : 0,
    refund_rate: totals.total_customers > 0 ? totals.refunds / totals.total_customers : 0,
    last_30_days: last30,
    last_7_days: last7,
    daily,
    by_source: bySource,
  };
}

/** Count of paid sales for one tier — backs the real cohort cap. */
function countPaidByTier(tier) {
  const { count } = prepare(
    "SELECT COUNT(*) AS count FROM customers WHERE tier = ? AND status = 'paid'"
  ).get(tier);
  return count;
}

module.exports = {
  createFromCheckout,
  findById,
  findByStripeSession,
  findByPaymentIntent,
  findByEmail,
  findActiveByEmail,
  recordDownload,
  updateStatus,
  list,
  stats,
  countPaidByTier,
};
