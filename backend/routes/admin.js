'use strict';

/**
 * Admin API — everything behind the dashboard.
 *
 * Every route here requires the admin bearer token and is rate limited. The
 * router-level middleware below applies to all of them, so there is no way to
 * add an endpoint to this file and accidentally leave it public.
 */

const express = require('express');
const { asyncHandler, NotFoundError, AppError } = require('../utils/errors');
const validate = require('../utils/validate');
const { requireAdmin } = require('../middleware/auth');
const rateLimiters = require('../middleware/rateLimit');
const customers = require('../models/customers');
const events = require('../models/events');
const emailModel = require('../models/emails');
const tickets = require('../models/tickets');
const testimonials = require('../models/testimonials');
const webhooks = require('../models/webhooks');
const fulfilment = require('../services/fulfilmentService');
const stripeService = require('../services/stripeService');
const pricing = require('../services/pricingService');

const router = express.Router();

// Applied to every route in this file. Order matters: rate limit before auth so
// a flood of bad tokens is cheap to reject.
router.use(rateLimiters.admin);
router.use(requireAdmin);

/**
 * GET /api/admin/overview
 *
 * One call backing the whole dashboard. Deliberately a single round trip so the
 * dashboard has no loading waterfall.
 */
router.get('/overview', asyncHandler(async (req, res) => {
  const customerStats = customers.stats();
  const funnel = events.funnel({ days: 30 });

  res.json({
    revenue: {
      netCents: customerStats.net_revenue_cents,
      netFormatted: pricing.formatPrice(customerStats.net_revenue_cents),
      grossCents: customerStats.gross_revenue_cents,
      averageOrderCents: customerStats.average_order_cents,
      averageOrderFormatted: pricing.formatPrice(customerStats.average_order_cents),
      last30Days: {
        sales: customerStats.last_30_days.sales,
        revenueFormatted: pricing.formatPrice(customerStats.last_30_days.revenue_cents),
      },
      last7Days: {
        sales: customerStats.last_7_days.sales,
        revenueFormatted: pricing.formatPrice(customerStats.last_7_days.revenue_cents),
      },
    },
    customers: {
      total: customerStats.total_customers,
      paid: customerStats.paid_customers,
      refunds: customerStats.refunds,
      disputes: customerStats.disputes,
      refundRate: customerStats.refund_rate,
      byTier: { method: customerStats.method_sales, engine: customerStats.engine_sales },
    },
    funnel,
    daily: customerStats.daily,
    bySource: customerStats.by_source,
    email: emailModel.statsByTemplate(),
    tickets: tickets.stats(),
    testimonials: testimonials.stats(),
    webhooks: webhooks.stats(),
    pricing: pricing.publicPricing(),
  });
}));

/** GET /api/admin/customers */
router.get('/customers', asyncHandler(async (req, res) => {
  const { value: limit } = validate.boundedInt(req.query.limit, { fallback: 50, min: 1, max: 200 });
  const { value: offset } = validate.boundedInt(req.query.offset, { fallback: 0, min: 0, max: 100_000 });

  const result = customers.list({
    limit,
    offset,
    status: typeof req.query.status === 'string' ? req.query.status : null,
    tier: typeof req.query.tier === 'string' ? req.query.tier : null,
    search: typeof req.query.search === 'string' ? req.query.search.slice(0, 100) : null,
    sort: typeof req.query.sort === 'string' ? req.query.sort : 'created_at',
    direction: req.query.direction === 'asc' ? 'asc' : 'desc',
  });

  res.json({
    ...result,
    customers: result.customers.map((customer) => ({
      ...customer,
      amountFormatted: pricing.formatPrice(customer.amount_cents),
    })),
  });
}));

/** GET /api/admin/customers/:id — full history for one customer. */
router.get('/customers/:id', asyncHandler(async (req, res) => {
  const customer = customers.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer not found.');

  res.json({
    customer: { ...customer, amountFormatted: pricing.formatPrice(customer.amount_cents) },
    emails: emailModel.findByCustomer(customer.id),
  });
}));

/**
 * POST /api/admin/customers/:id/resend
 *
 * The button you press when a customer says the course never arrived. Issues a
 * fresh link and emails it.
 */
router.post('/customers/:id/resend', asyncHandler(async (req, res) => {
  const customer = customers.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer not found.');

  const result = await fulfilment.resendDelivery(customer.id);

  req.log.info('Admin resent delivery', { customerId: customer.id, sent: result.sent });

  res.json({
    ok: result.sent,
    // Returned even on failure so you can paste the link into a manual email
    // when the mail transport itself is the problem.
    downloadUrl: result.link.url,
    expiresAt: result.link.expiresAt,
    ...(result.sent ? {} : { error: result.error }),
  });
}));

/**
 * POST /api/admin/customers/:id/refund
 * Body: { reason? }
 *
 * Issues the refund through Stripe. Access revocation and the customer email
 * happen via the charge.refunded webhook, so a refund issued here and one
 * issued in the Stripe dashboard behave identically — there is one code path,
 * not two.
 */
router.post('/customers/:id/refund', asyncHandler(async (req, res) => {
  const customer = customers.findById(req.params.id);
  if (!customer) throw new NotFoundError('Customer not found.');

  if (customer.status === 'refunded') {
    throw new AppError('This purchase has already been refunded.', 409, 'already_refunded');
  }
  if (!customer.stripe_payment_intent) {
    throw new AppError(
      'No Stripe payment intent on record for this purchase, so it cannot be refunded automatically. Refund it in the Stripe dashboard instead.',
      422,
      'no_payment_intent'
    );
  }

  const refund = await stripeService.refund(customer.stripe_payment_intent, 'requested_by_customer');

  req.log.info('Admin issued refund', { customerId: customer.id, refundId: refund.id });

  res.json({
    ok: true,
    refundId: refund.id,
    amountFormatted: pricing.formatPrice(refund.amount),
    message: 'Refund issued. The customer will be emailed and their download revoked automatically when Stripe confirms it.',
  });
}));

/** GET /api/admin/tickets */
router.get('/tickets', asyncHandler(async (req, res) => {
  const { value: limit } = validate.boundedInt(req.query.limit, { fallback: 50, min: 1, max: 200 });
  const { value: offset } = validate.boundedInt(req.query.offset, { fallback: 0, min: 0, max: 100_000 });

  res.json(tickets.list({
    limit,
    offset,
    status: typeof req.query.status === 'string' ? req.query.status : null,
    kind: typeof req.query.kind === 'string' ? req.query.kind : null,
  }));
}));

/** PATCH /api/admin/tickets/:id — Body: { status, notes? } */
router.patch('/tickets/:id', asyncHandler(async (req, res) => {
  const validated = validate.collect({
    status: validate.enumValue(req.body?.status, tickets.STATUSES, 'Status'),
    notes: validate.text(req.body?.notes, { label: 'Notes', min: 0, max: 2000, required: false }),
  });

  const ticket = tickets.updateStatus(req.params.id, validated.status, validated.notes || null);
  if (!ticket) throw new NotFoundError('Ticket not found.');

  res.json({ ok: true, ticket });
}));

/** GET /api/admin/testimonials — the review queue. */
router.get('/testimonials', asyncHandler(async (req, res) => {
  const { value: limit } = validate.boundedInt(req.query.limit, { fallback: 100, min: 1, max: 200 });
  const approvedFilter = req.query.approved === 'true' ? true
    : req.query.approved === 'false' ? false
    : null;

  res.json(testimonials.listAll({ limit, approved: approvedFilter }));
}));

/**
 * PATCH /api/admin/testimonials/:id
 * Body: { approved?, verified?, consentToPublish?, displayOrder? }
 *
 * The model refuses to approve a testimonial with no consent on record and
 * throws; that surfaces here as a 422 with the reason, which is the intended
 * behaviour — it should be awkward to publish something you do not have
 * permission to publish.
 */
router.patch('/testimonials/:id', asyncHandler(async (req, res) => {
  const body = req.body || {};

  if (typeof body.consentToPublish === 'boolean') {
    testimonials.setConsent(req.params.id, body.consentToPublish);
  }

  try {
    const updated = testimonials.review(req.params.id, {
      approved: typeof body.approved === 'boolean' ? body.approved : undefined,
      verified: typeof body.verified === 'boolean' ? body.verified : undefined,
      displayOrder: Number.isInteger(body.displayOrder) ? body.displayOrder : undefined,
    });

    if (!updated) throw new NotFoundError('Testimonial not found.');
    res.json({ ok: true, testimonial: updated });
  } catch (error) {
    if (error instanceof NotFoundError) throw error;
    throw new AppError(error.message, 422, 'consent_required');
  }
}));

/** DELETE /api/admin/testimonials/:id */
router.delete('/testimonials/:id', asyncHandler(async (req, res) => {
  const removed = testimonials.remove(req.params.id);
  if (!removed) throw new NotFoundError('Testimonial not found.');
  res.json({ ok: true });
}));

/**
 * GET /api/admin/health/failures
 *
 * The "what is quietly broken" view: failed webhooks and failed emails. Check
 * it whenever a customer reports a problem — the answer is usually here.
 */
router.get('/health/failures', asyncHandler(async (req, res) => {
  res.json({
    failedWebhooks: webhooks.findFailed({ limit: 50 }),
    failedEmails: emailModel.findFailed({ limit: 50 }),
  });
}));

/** GET /api/admin/events — recent activity feed. */
router.get('/events', asyncHandler(async (req, res) => {
  const { value: limit } = validate.boundedInt(req.query.limit, { fallback: 100, min: 1, max: 500 });
  res.json({
    events: events.recent({
      limit,
      type: typeof req.query.type === 'string' ? req.query.type : null,
    }),
  });
}));

/**
 * GET /api/admin/export/customers.csv
 *
 * Your customer list, portable. Own your data — if this system ever goes away,
 * this file is the business.
 */
router.get('/export/customers.csv', asyncHandler(async (req, res) => {
  const { customers: rows } = customers.list({ limit: 100_000, offset: 0 });

  const headers = ['id', 'email', 'tier', 'amount_cents', 'currency', 'status', 'download_count', 'utm_source', 'utm_campaign', 'created_at'];

  const csv = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(',')),
  ].join('\n');

  res.set({
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`,
    'Cache-Control': 'no-store',
  });
  res.send(csv);
}));

/**
 * CSV escaping.
 *
 * The leading-character check is CSV injection defence, not decoration: a value
 * beginning with = + - or @ is interpreted as a formula by Excel and Sheets. A
 * customer whose "name" is `=HYPERLINK(...)` would otherwise run code in your
 * spreadsheet when you open your own export. Prefixing with a single quote
 * neutralises it.
 */
function csvCell(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[",\n\r]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

module.exports = router;
