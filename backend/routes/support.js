'use strict';

/**
 * Customer support: tickets, refund requests and testimonial submission.
 */

const express = require('express');
const { asyncHandler } = require('../utils/errors');
const validate = require('../utils/validate');
const rateLimiters = require('../middleware/rateLimit');
const tickets = require('../models/tickets');
const testimonials = require('../models/testimonials');
const customers = require('../models/customers');
const events = require('../models/events');
const emailService = require('../services/emailService');
const { config } = require('../config');

const router = express.Router();

/**
 * POST /api/support/ticket
 * Body: { email, subject, message, kind? }
 */
router.post('/support/ticket', rateLimiters.submission, asyncHandler(async (req, res) => {
  const body = req.body || {};

  const validated = validate.collect({
    email: validate.email(body.email),
    subject: validate.text(body.subject, { label: 'Subject', min: 3, max: 200 }),
    message: validate.text(body.message, { label: 'Message', min: 10, max: 5000 }),
    kind: body.kind
      ? validate.enumValue(body.kind, tickets.KINDS, 'Kind')
      : { ok: true, value: 'support' },
  });

  // Link the ticket to a purchase if we can — it saves you looking it up later
  // and tells you immediately whether you are talking to a customer.
  const customer = customers.findActiveByEmail(validated.email);

  const ticket = tickets.create({
    customerId: customer?.id || null,
    email: validated.email,
    kind: validated.kind,
    subject: validated.subject,
    message: validated.message,
  });

  events.record(events.EVENT_TYPES.TICKET_CREATED, {
    customerId: customer?.id || null,
    payload: { kind: validated.kind, reference: ticket.reference },
  });

  // Acknowledge to the customer so they know it arrived and when to expect a
  // reply. Silence here produces a duplicate message within the hour.
  await emailService.send('support_acknowledgement', {
    to: validated.email,
    customerId: customer?.id || null,
    context: { reference: ticket.reference, subject: validated.subject, kind: validated.kind },
    track: false,
  });

  // And alert the operator.
  await emailService.notifyAdmin(
    validated.kind === 'refund' ? `Refund request — ${ticket.reference}` : `Support ticket — ${ticket.reference}`,
    [
      `From: ${validated.email}`,
      `Customer: ${customer ? `${customer.tier}, bought ${new Date(customer.created_at).toDateString()}` : 'no purchase on record'}`,
      `Subject: ${validated.subject}`,
      '',
      validated.message.slice(0, 1000),
    ]
  );

  req.log.info('Ticket created', { reference: ticket.reference, kind: validated.kind });

  res.status(201).json({
    ok: true,
    reference: ticket.reference,
    message: validated.kind === 'refund'
      ? 'Refund request received. It will be processed within one business day and you will get a confirmation email.'
      : 'Message received. We reply to everything within 24 hours.',
  });
}));

/**
 * POST /api/support/refund
 * Body: { email, reason? }
 *
 * A dedicated route so the refund path is one click from the sales page rather
 * than buried in a contact form. That is not generosity — a customer who cannot
 * find how to get a refund files a chargeback instead, which costs you the sale
 * plus a fee plus a mark against your Stripe account.
 */
router.post('/support/refund', rateLimiters.submission, asyncHandler(async (req, res) => {
  const validated = validate.collect({
    email: validate.email(req.body?.email),
    reason: validate.text(req.body?.reason, { label: 'Reason', min: 0, max: 2000, required: false }),
  });

  const customer = customers.findActiveByEmail(validated.email);

  const ticket = tickets.create({
    customerId: customer?.id || null,
    email: validated.email,
    kind: 'refund',
    subject: 'Refund request',
    message: validated.reason || '(no reason given)',
  });

  events.record(events.EVENT_TYPES.REFUND_REQUESTED, {
    customerId: customer?.id || null,
    payload: { reference: ticket.reference },
  });

  await emailService.send('support_acknowledgement', {
    to: validated.email,
    customerId: customer?.id || null,
    context: { reference: ticket.reference, subject: 'Refund request', kind: 'refund' },
    track: false,
  });

  await emailService.notifyAdmin(`REFUND REQUEST — ${ticket.reference}`, [
    `From: ${validated.email}`,
    customer
      ? `Purchase: ${customer.tier}, ${new Date(customer.created_at).toDateString()}, downloads: ${customer.download_count}`
      : 'No purchase found for this address — check for a typo or a different address.',
    '',
    `Reason: ${validated.reason || '(none given)'}`,
    '',
    'Process it in Stripe. The charge.refunded webhook will revoke their download and email them automatically.',
  ]);

  res.status(201).json({
    ok: true,
    reference: ticket.reference,
    message: 'Refund request received. It will be processed within one business day — no questions asked. You will get a confirmation email when it is done.',
  });
}));

/**
 * POST /api/testimonials
 * Body: { name, email, quote, headline?, resultMetric?, resultTimeframe?, consentToPublish }
 *
 * How real social proof gets collected.
 *
 * Note that `consentToPublish` is an explicit, separate boolean. Submitting
 * feedback and agreeing to be quoted publicly are two different decisions, and
 * treating them as one is how sellers end up publishing testimonials they were
 * never given permission to use. Nothing submitted here appears anywhere public
 * until you approve it by hand in the admin dashboard, and the model layer
 * refuses to approve anything without consent on record.
 */
router.post('/testimonials', rateLimiters.submission, asyncHandler(async (req, res) => {
  const body = req.body || {};

  const validated = validate.collect({
    name: validate.name(body.name),
    email: validate.email(body.email),
    quote: validate.text(body.quote, { label: 'Your feedback', min: 20, max: 2000 }),
    headline: validate.text(body.headline, { label: 'Headline', min: 0, max: 120, required: false }),
    resultMetric: validate.text(body.resultMetric, { label: 'Result', min: 0, max: 200, required: false }),
    resultTimeframe: validate.text(body.resultTimeframe, { label: 'Timeframe', min: 0, max: 100, required: false }),
  });

  const customer = customers.findActiveByEmail(validated.email);

  const record = testimonials.create({
    customerId: customer?.id || null,
    name: validated.name,
    email: validated.email,
    headline: validated.headline || null,
    quote: validated.quote,
    resultMetric: validated.resultMetric || null,
    resultTimeframe: validated.resultTimeframe || null,
    // Strict boolean check: anything other than an explicit `true` is a no.
    consentToPublish: body.consentToPublish === true,
  });

  events.record(events.EVENT_TYPES.TESTIMONIAL_SUBMITTED, {
    customerId: customer?.id || null,
    payload: { consented: record.consent_to_publish === 1 },
  });

  await emailService.notifyAdmin('New feedback submitted', [
    `From: ${validated.name} <${validated.email}>`,
    `Verified customer: ${customer ? 'yes' : 'NO — not in the database'}`,
    `Consented to publish: ${record.consent_to_publish ? 'YES' : 'no'}`,
    `Claims a result: ${validated.resultMetric || '(none)'}`,
    '',
    validated.quote.slice(0, 1000),
    '',
    record.consent_to_publish
      ? 'Before publishing: confirm the exact wording with them, and if they quoted numbers, ask for a screenshot. Then approve it in the admin dashboard.'
      : 'They did NOT consent to publication. Do not put this on the sales page.',
  ]);

  res.status(201).json({
    ok: true,
    message: record.consent_to_publish
      ? 'Thank you. If we would like to use your words publicly we will email you the exact wording to confirm first.'
      : 'Thank you. This stays private and will not be published anywhere.',
  });
}));

/**
 * GET /api/testimonials
 *
 * Approved, consented testimonials for the sales page. Returns an empty array
 * when you have none yet, and the page renders a different section in that case
 * rather than an empty void — see web/index.html.
 */
router.get('/testimonials', (req, res) => {
  res.set('Cache-Control', 'public, max-age=300');
  res.json({ testimonials: testimonials.listPublic({ limit: 12 }) });
});

/** GET /api/support/info — support email and policy text for the page footer. */
router.get('/support/info', (req, res) => {
  res.json({
    supportEmail: config.email.supportEmail,
    refundWindowDays: 14,
    responseTimeHours: 24,
  });
});

module.exports = router;
