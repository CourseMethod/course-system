'use strict';

/**
 * Fulfilment — what happens when money arrives.
 *
 * This is the business-critical path. Everything else can fail gracefully; if
 * this fails, someone has paid you and received nothing, which becomes a
 * chargeback and a public complaint.
 *
 * The ordering below is deliberate and worth preserving:
 *
 *   1. Record the customer FIRST. A durable record of the sale is the thing
 *      that makes every later failure recoverable. If the process dies after
 *      step 1, you can still see the sale and resend by hand.
 *   2. Issue the download link.
 *   3. Send the email — and if it fails, do NOT fail the whole operation.
 *
 * Step 3 is the subtle one. This runs inside the Stripe webhook handler. If we
 * threw on an SMTP failure, the handler would return 500, Stripe would retry
 * the event, and we would redo fulfilment repeatedly for a payment that was
 * never in doubt. Instead the failure is recorded, you are alerted, and the
 * email can be resent from the dashboard with one click.
 */

const logger = require('../utils/logger');
const customers = require('../models/customers');
const events = require('../models/events');
const emailService = require('./emailService');
const deliveryService = require('./deliveryService');
const pricing = require('./pricingService');
const { config } = require('../config');

/**
 * Fulfil a completed checkout.
 *
 * Idempotent: safe to call repeatedly with the same Stripe session. A repeat
 * call returns early without sending a second email.
 *
 * @param {object} session  A Stripe checkout.session object.
 * @returns {Promise<{customer: object, isNew: boolean, emailSent: boolean}>}
 */
async function fulfilCheckout(session) {
  const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
  const tier = session.metadata?.tier;

  if (!email) {
    // Should be impossible — Stripe Checkout always collects an email — but if
    // it happens we must not lose the sale silently.
    logger.error('Checkout completed with no email address', { sessionId: session.id });
    await emailService.notifyAdmin('Sale with no email address', [
      `Stripe session: ${session.id}`,
      `Amount: ${pricing.formatPrice(session.amount_total)}`,
      'Find this payment in Stripe, get the customer email, and deliver manually.',
    ]);
    throw new Error(`Checkout session ${session.id} has no customer email`);
  }

  if (!tier || !pricing.TIERS[tier]) {
    logger.error('Checkout completed with unknown tier', { sessionId: session.id, tier });
    await emailService.notifyAdmin('Sale with unrecognised tier', [
      `Stripe session: ${session.id}`,
      `Customer: ${email}`,
      `Tier in metadata: ${tier || '(none)'}`,
      'Deliver this one manually.',
    ]);
    throw new Error(`Checkout session ${session.id} has unknown tier "${tier}"`);
  }

  // --- 1. Record the sale -------------------------------------------------
  const { customer, isNew } = customers.createFromCheckout({
    email,
    tier,
    amountCents: session.amount_total,
    currency: session.currency || config.pricing.currency,
    stripeSessionId: session.id,
    stripePaymentIntent: typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id,
    stripeCustomerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
    attribution: {
      utmSource: session.metadata?.utm_source || null,
      utmMedium: session.metadata?.utm_medium || null,
      utmCampaign: session.metadata?.utm_campaign || null,
      referrer: session.metadata?.referrer || null,
    },
  });

  // Already fulfilled — this is a Stripe redelivery. Stop here.
  if (!isNew) {
    logger.info('Checkout already fulfilled, skipping', { sessionId: session.id, customerId: customer.id });
    return { customer, isNew: false, emailSent: false };
  }

  events.record(events.EVENT_TYPES.PURCHASE_COMPLETED, {
    customerId: customer.id,
    sessionKey: session.metadata?.session_key || null,
    payload: { tier, amountCents: session.amount_total, source: session.metadata?.utm_source || 'direct' },
  });

  logger.info('Sale recorded', {
    customerId: customer.id,
    email,
    tier,
    amount: pricing.formatPrice(session.amount_total),
  });

  // --- 2. Issue the download link ----------------------------------------
  let link;
  try {
    link = deliveryService.issueDownloadLink(customer.id);
  } catch (error) {
    logger.error('Failed to issue download link', { customerId: customer.id, error: error.message });
    await emailService.notifyAdmin('Could not issue download link', [
      `Customer: ${email}`,
      `Customer id: ${customer.id}`,
      `Error: ${error.message}`,
      'The sale IS recorded. Resend the download from the admin dashboard.',
    ]);
    return { customer, isNew: true, emailSent: false };
  }

  // --- 3. Send the delivery email ----------------------------------------
  const result = await emailService.send('delivery', {
    to: email,
    customerId: customer.id,
    context: {
      tierName: pricing.TIERS[tier].name,
      downloadUrl: link.url,
      expiresAt: link.expiresAt,
      orientationUrl: `${config.publicUrl}/success.html?session_id=${session.id}`,
    },
  });

  if (!result.sent) {
    // A paying customer with no email is the worst state this system can be in.
    // Make it impossible to miss.
    await emailService.notifyAdmin('DELIVERY EMAIL FAILED — customer paid, got nothing', [
      `Customer: ${email}`,
      `Tier: ${pricing.TIERS[tier].name}`,
      `Amount: ${pricing.formatPrice(session.amount_total)}`,
      `Error: ${result.error}`,
      `Download link (send this to them manually): ${link.url}`,
      'Open the admin dashboard and use "Resend delivery" once email is working.',
    ]);
  }

  return { customer, isNew: true, emailSent: result.sent };
}

/**
 * Handle a refund that happened in Stripe (dashboard or API).
 * Revokes download access and confirms to the customer.
 */
async function handleRefund(charge) {
  const paymentIntentId = typeof charge.payment_intent === 'string'
    ? charge.payment_intent
    : charge.payment_intent?.id;

  const customer = customers.findByPaymentIntent(paymentIntentId);

  if (!customer) {
    logger.warn('Refund for unknown payment intent', { paymentIntentId });
    return null;
  }

  customers.updateStatus(customer.id, 'refunded');
  deliveryService.revokeAccess(customer.id);

  events.record(events.EVENT_TYPES.REFUND_ISSUED, {
    customerId: customer.id,
    payload: { amountCents: charge.amount_refunded },
  });

  await emailService.send('refund_confirmation', {
    to: customer.email,
    customerId: customer.id,
    context: { amountFormatted: pricing.formatPrice(charge.amount_refunded) },
    track: false,
  });

  logger.info('Refund processed', { customerId: customer.id, amount: charge.amount_refunded });
  return customer;
}

/**
 * Handle a dispute (chargeback).
 *
 * Disputes are serious: Stripe charges a non-refundable fee (typically $15) on
 * top of clawing back the payment, and a dispute rate above roughly 0.75% puts
 * your whole account at risk of termination. Access is revoked and you are
 * alerted immediately, because you have a limited window to submit evidence.
 */
async function handleDispute(dispute) {
  const paymentIntentId = typeof dispute.payment_intent === 'string'
    ? dispute.payment_intent
    : dispute.payment_intent?.id;

  const customer = customers.findByPaymentIntent(paymentIntentId);

  if (customer) {
    customers.updateStatus(customer.id, 'disputed');
    deliveryService.revokeAccess(customer.id);
    events.record(events.EVENT_TYPES.DISPUTE_OPENED, {
      customerId: customer.id,
      payload: { reason: dispute.reason, amountCents: dispute.amount },
    });
  }

  await emailService.notifyAdmin('CHARGEBACK OPENED — respond within the deadline', [
    `Customer: ${customer?.email || 'unknown'}`,
    `Amount: ${pricing.formatPrice(dispute.amount)}`,
    `Reason given: ${dispute.reason}`,
    `Respond by: ${dispute.evidence_details?.due_by ? new Date(dispute.evidence_details.due_by * 1000).toISOString() : 'see Stripe dashboard'}`,
    '',
    'Evidence that wins these: the delivery email record (admin dashboard shows send time and opens),',
    'the download log (shows they downloaded it), and your refund policy text.',
    'See docs/Troubleshooting.md, section "Chargebacks", for the exact submission checklist.',
  ]);

  logger.warn('Dispute opened', { customerId: customer?.id, reason: dispute.reason, amount: dispute.amount });
  return customer;
}

/** Resend a delivery email on demand. Used by the admin dashboard. */
async function resendDelivery(customerId) {
  const customer = customers.findById(customerId);
  if (!customer) throw new Error('Customer not found');

  const link = deliveryService.issueDownloadLink(customerId);

  const result = await emailService.send('download_resend', {
    to: customer.email,
    customerId,
    context: {
      tierName: pricing.TIERS[customer.tier]?.name || customer.tier,
      downloadUrl: link.url,
      expiresAt: link.expiresAt,
    },
  });

  return { sent: result.sent, link, error: result.error };
}

module.exports = { fulfilCheckout, handleRefund, handleDispute, resendDelivery };
