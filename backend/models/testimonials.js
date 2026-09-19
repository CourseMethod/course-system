'use strict';

/**
 * Real customer testimonials, collected with consent.
 *
 * READ THIS BEFORE YOU USE ANYTHING FROM THIS TABLE ON YOUR SALES PAGE.
 *
 * Every row here starts life invisible. A testimonial is published only when
 * you personally set `approved = 1`, and the schema records three separate
 * facts you are responsible for:
 *
 *   consent_to_publish — the customer agreed, in writing, to be quoted publicly
 *                        under the name shown. Get this explicitly. "They said
 *                        something nice in a DM" is not consent to put their
 *                        name and face on a sales page.
 *
 *   verified           — you have SEEN evidence of the result they are claiming
 *                        (a Stripe screenshot, an analytics export). Publishing
 *                        an unverified revenue claim as fact makes it your claim,
 *                        and you are the one who has to substantiate it.
 *
 *   approved           — you have made the call to display it.
 *
 * Why the ceremony: the FTC's Rule on the Use of Consumer Reviews and
 * Testimonials (16 CFR Part 465, in force since 2024) makes fabricated or
 * misattributed testimonials a civil-penalty offence per violation, and
 * "results not typical" fine print does NOT cure an unrepresentative earnings
 * claim. Payment processors also treat fake social proof as a fraud signal —
 * losing your Stripe account costs you the business overnight.
 *
 * The system is built so the honest path is the easy one: ask customers for
 * results with the post-purchase email, approve the real ones, publish those.
 */

const { getDb, now } = require('./db');
const { randomId } = require('../utils/tokens');

const statementCache = new Map();
function prepare(sql) {
  if (!statementCache.has(sql)) statementCache.set(sql, getDb().prepare(sql));
  return statementCache.get(sql);
}

function create({
  customerId = null,
  name,
  email,
  headline = null,
  quote,
  resultMetric = null,
  resultTimeframe = null,
  consentToPublish = false,
}) {
  const id = randomId();
  const timestamp = now();

  prepare(`
    INSERT INTO testimonials (
      id, customer_id, name, email, headline, quote,
      result_metric, result_timeframe,
      consent_to_publish, verified, approved, display_order,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 100, ?, ?)
  `).run(
    id, customerId, name, email.toLowerCase(), headline, quote,
    resultMetric, resultTimeframe,
    consentToPublish ? 1 : 0,
    timestamp, timestamp
  );

  return findById(id);
}

function findById(id) {
  if (!id) return null;
  return prepare('SELECT * FROM testimonials WHERE id = ?').get(id) || null;
}

/**
 * What the public sales page is allowed to show.
 *
 * Note the WHERE clause: approved AND consented. A testimonial cannot leak onto
 * the page through an admin mis-click alone — it has to clear both gates. The
 * email address is never selected, so it cannot end up in the public JSON.
 */
function listPublic({ limit = 12 } = {}) {
  return prepare(`
    SELECT id, name, headline, quote, result_metric, result_timeframe, verified, created_at
    FROM testimonials
    WHERE approved = 1 AND consent_to_publish = 1
    ORDER BY display_order ASC, created_at DESC
    LIMIT ?
  `).all(limit);
}

/** Everything, for the admin review queue. */
function listAll({ limit = 100, offset = 0, approved = null } = {}) {
  const conditions = [];
  const params = [];
  if (approved !== null) { conditions.push('approved = ?'); params.push(approved ? 1 : 0); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  const rows = prepare(`
    SELECT * FROM testimonials ${where}
    ORDER BY created_at DESC LIMIT ? OFFSET ?
  `).all(...params, limit, offset);

  const { total } = prepare(`SELECT COUNT(*) AS total FROM testimonials ${where}`).get(...params);
  return { testimonials: rows, total, limit, offset };
}

/**
 * Update the review flags.
 * Guard rail: approving something without recorded consent is refused outright
 * rather than allowed with a warning.
 */
function review(id, { approved, verified, displayOrder }) {
  const existing = findById(id);
  if (!existing) return null;

  if (approved === true && !existing.consent_to_publish) {
    throw new Error(
      'Cannot approve a testimonial without recorded consent to publish. ' +
      'Get written permission from the customer first, then set consent on the record.'
    );
  }

  prepare(`
    UPDATE testimonials
    SET approved = COALESCE(?, approved),
        verified = COALESCE(?, verified),
        display_order = COALESCE(?, display_order),
        updated_at = ?
    WHERE id = ?
  `).run(
    approved === undefined ? null : (approved ? 1 : 0),
    verified === undefined ? null : (verified ? 1 : 0),
    displayOrder === undefined ? null : displayOrder,
    now(),
    id
  );

  return findById(id);
}

function setConsent(id, consented) {
  prepare('UPDATE testimonials SET consent_to_publish = ?, updated_at = ? WHERE id = ?')
    .run(consented ? 1 : 0, now(), id);
  return findById(id);
}

function remove(id) {
  return prepare('DELETE FROM testimonials WHERE id = ?').run(id).changes > 0;
}

function stats() {
  return getDb().prepare(`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN approved = 1 THEN 1 END) AS approved,
      COUNT(CASE WHEN consent_to_publish = 1 THEN 1 END) AS consented,
      COUNT(CASE WHEN verified = 1 THEN 1 END) AS verified,
      COUNT(CASE WHEN approved = 0 THEN 1 END) AS awaiting_review
    FROM testimonials
  `).get();
}

module.exports = { create, findById, listPublic, listAll, review, setConsent, remove, stats };
