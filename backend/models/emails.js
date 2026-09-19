'use strict';

/**
 * Sent-email records and open/click tracking.
 *
 * The point of this table is answering one question fast: "this customer says
 * they never got the course — did we actually send it, did it bounce, and did
 * they open it?" Without it, every delivery complaint is a guess.
 */

const { getDb, now } = require('./db');
const { randomId } = require('../utils/tokens');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

function create({ customerId = null, recipient, template, subject }) {
  const id = randomId();
  prepare(`
    INSERT INTO emails (id, customer_id, recipient, template, subject, status, attempts, created_at)
    VALUES (?, ?, ?, ?, ?, 'queued', 0, ?)
  `).run(id, customerId, recipient, template, subject, now());
  return id;
}

function markSent(id) {
  prepare(`
    UPDATE emails
    SET status = 'sent', sent_at = ?, attempts = attempts + 1, last_error = NULL
    WHERE id = ?
  `).run(now(), id);
}

function markFailed(id, errorMessage) {
  prepare(`
    UPDATE emails
    SET status = 'failed', attempts = attempts + 1, last_error = ?
    WHERE id = ?
  `).run(String(errorMessage).slice(0, 500), id);
}

/**
 * Record an open. Called by the tracking pixel.
 *
 * Caveat worth knowing before you make decisions on this data: Apple Mail
 * Privacy Protection and most corporate gateways pre-fetch images, which
 * registers an "open" nobody performed. Treat open rate as a rough signal and
 * a relative trend, never as ground truth. Click tracking is far more reliable.
 */
function recordOpen(id) {
  prepare(`
    UPDATE emails
    SET open_count = open_count + 1,
        opened_at = COALESCE(opened_at, ?)
    WHERE id = ?
  `).run(now(), id);
}

function recordClick(id) {
  prepare(`
    UPDATE emails
    SET click_count = click_count + 1,
        clicked_at = COALESCE(clicked_at, ?)
    WHERE id = ?
  `).run(now(), id);
}

function findById(id) {
  if (!id) return null;
  return prepare('SELECT * FROM emails WHERE id = ?').get(id) || null;
}

function findByCustomer(customerId) {
  return prepare('SELECT * FROM emails WHERE customer_id = ? ORDER BY created_at DESC').all(customerId);
}

/** Emails that never went out — the queue to retry or investigate. */
function findFailed({ limit = 100 } = {}) {
  return prepare(`
    SELECT * FROM emails WHERE status = 'failed' ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}

/** Per-template performance for the dashboard. */
function statsByTemplate() {
  return getDb().prepare(`
    SELECT
      template,
      COUNT(*)                                        AS total,
      COUNT(CASE WHEN status = 'sent' THEN 1 END)     AS sent,
      COUNT(CASE WHEN status = 'failed' THEN 1 END)   AS failed,
      COUNT(CASE WHEN opened_at IS NOT NULL THEN 1 END)  AS opened,
      COUNT(CASE WHEN clicked_at IS NOT NULL THEN 1 END) AS clicked
    FROM emails
    GROUP BY template
    ORDER BY total DESC
  `).all().map((row) => ({
    ...row,
    open_rate: row.sent > 0 ? row.opened / row.sent : 0,
    click_rate: row.sent > 0 ? row.clicked / row.sent : 0,
    failure_rate: row.total > 0 ? row.failed / row.total : 0,
  }));
}

module.exports = {
  create,
  markSent,
  markFailed,
  recordOpen,
  recordClick,
  findById,
  findByCustomer,
  findFailed,
  statsByTemplate,
};
