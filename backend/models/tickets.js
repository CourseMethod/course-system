'use strict';

/**
 * Support tickets and refund requests.
 *
 * Small on purpose. You do not need Zendesk to sell a $47 course — you need a
 * durable record that a request came in, a reference the customer can quote,
 * and a status you can move through. When ticket volume outgrows this, export
 * and move on; until then, an inbox alone loses requests.
 */

const { getDb, now } = require('./db');
const { randomId, humanReference } = require('../utils/tokens');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

const KINDS = ['support', 'refund', 'bug', 'question'];
const STATUSES = ['open', 'pending', 'resolved', 'closed'];
const PRIORITIES = ['low', 'normal', 'high', 'urgent'];

function create({ customerId = null, email, kind = 'support', subject, message, priority = 'normal' }) {
  const id = randomId();
  // Refund requests carry a legal clock (your 14-day guarantee), so they jump
  // the queue automatically rather than relying on you spotting them.
  const resolvedPriority = kind === 'refund' ? 'high' : (PRIORITIES.includes(priority) ? priority : 'normal');
  const reference = humanReference(kind === 'refund' ? 'REF' : 'CP');
  const timestamp = now();

  prepare(`
    INSERT INTO tickets (
      id, reference, customer_id, email, kind, subject, message,
      status, priority, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)
  `).run(
    id, reference, customerId, email.toLowerCase(),
    KINDS.includes(kind) ? kind : 'support',
    subject, message, resolvedPriority, timestamp, timestamp
  );

  return findById(id);
}

function findById(id) {
  if (!id) return null;
  return prepare('SELECT * FROM tickets WHERE id = ?').get(id) || null;
}

function findByReference(reference) {
  if (!reference) return null;
  return prepare('SELECT * FROM tickets WHERE reference = ?').get(reference.toUpperCase()) || null;
}

function list({ limit = 50, offset = 0, status = null, kind = null } = {}) {
  const conditions = [];
  const params = [];
  if (status && STATUSES.includes(status)) { conditions.push('status = ?'); params.push(status); }
  if (kind && KINDS.includes(kind)) { conditions.push('kind = ?'); params.push(kind); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = prepare(`
    SELECT * FROM tickets
    ${where}
    ORDER BY
      CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
      created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = prepare(`SELECT COUNT(*) AS total FROM tickets ${where}`).get(...params);
  return { tickets: rows, total, limit, offset };
}

function updateStatus(id, status, internalNotes = null) {
  if (!STATUSES.includes(status)) throw new Error(`Invalid ticket status: ${status}`);
  const resolvedAt = (status === 'resolved' || status === 'closed') ? now() : null;

  prepare(`
    UPDATE tickets
    SET status = ?,
        internal_notes = COALESCE(?, internal_notes),
        resolved_at = COALESCE(?, resolved_at),
        updated_at = ?
    WHERE id = ?
  `).run(status, internalNotes, resolvedAt, now(), id);

  return findById(id);
}

/** Open-ticket counts by kind, plus the oldest unanswered age in hours. */
function stats() {
  const db = getDb();

  const byStatus = db.prepare(`
    SELECT status, COUNT(*) AS count FROM tickets GROUP BY status
  `).all();

  const byKind = db.prepare(`
    SELECT kind, COUNT(*) AS count FROM tickets WHERE status IN ('open','pending') GROUP BY kind
  `).all();

  const oldest = db.prepare(`
    SELECT created_at FROM tickets WHERE status = 'open' ORDER BY created_at ASC LIMIT 1
  `).get();

  const oldestOpenHours = oldest
    ? Math.round((Date.now() - new Date(oldest.created_at).getTime()) / 3_600_000)
    : 0;

  return { by_status: byStatus, by_kind: byKind, oldest_open_hours: oldestOpenHours };
}

module.exports = { KINDS, STATUSES, PRIORITIES, create, findById, findByReference, list, updateStatus, stats };
