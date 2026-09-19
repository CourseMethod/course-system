'use strict';

/**
 * Stripe webhook receiver.
 *
 * CRITICAL MOUNTING REQUIREMENT: this router must be mounted BEFORE any JSON
 * body parser, with express.raw() applied. Stripe signs the exact bytes it
 * sent; if express.json() parses the body first, re-serialising produces
 * different bytes and every signature check fails. That is the number one
 * Stripe integration bug, and it presents as "webhooks all return 400" with no
 * obvious cause. See how server.js mounts this.
 *
 * Response discipline:
 *   - Return 2xx as soon as the event is safely recorded. Stripe treats a slow
 *     response as a failure and retries; a handler that does slow work before
 *     replying causes duplicate deliveries.
 *   - Return 4xx ONLY for events we will never be able to process (bad
 *     signature). Stripe stops retrying on 4xx.
 *   - Return 5xx for transient failures so Stripe retries for up to 3 days.
 */

const express = require('express');
const { asyncHandler } = require('../utils/errors');
const stripeService = require('../services/stripeService');
const fulfilment = require('../services/fulfilmentService');
const webhookModel = require('../models/webhooks');
const logger = require('../utils/logger');

const router = express.Router();

/** Events we act on. Anything else is acknowledged and ignored. */
const HANDLED_EVENTS = new Set([
  'checkout.session.completed',
  'checkout.session.async_payment_succeeded',
  'checkout.session.async_payment_failed',
  'charge.refunded',
  'charge.dispute.created',
  'charge.dispute.closed',
]);

router.post(
  '/webhook',
  // Raw body, capped — an unbounded raw parser is a memory-exhaustion vector.
  express.raw({ type: 'application/json', limit: '1mb' }),
  asyncHandler(async (req, res) => {
    // --- 1. Verify the signature ------------------------------------------
    // Throws AppError(400) on failure, which is correct: an unsigned or forged
    // event must never be retried.
    const event = stripeService.constructWebhookEvent(req.body, req.get('stripe-signature'));

    const log = req.log.child({ stripeEventId: event.id, eventType: event.type });

    // --- 2. Idempotency ----------------------------------------------------
    // Stripe guarantees at-least-once delivery. Without this claim, a redelivery
    // would email the customer their course a second time and double-count the
    // sale.
    const claim = webhookModel.claim(event.id, event.type, event.data?.object);

    if (!claim.claimed) {
      log.info('Duplicate webhook acknowledged without reprocessing');
      return res.json({ received: true, duplicate: true });
    }

    if (!HANDLED_EVENTS.has(event.type)) {
      webhookModel.markProcessed(claim.id);
      log.debug('Webhook type not handled, acknowledged');
      return res.json({ received: true, handled: false });
    }

    // --- 3. Process --------------------------------------------------------
    try {
      await processEvent(event, log);
      webhookModel.markProcessed(claim.id);
      return res.json({ received: true, handled: true });
    } catch (error) {
      webhookModel.markFailed(claim.id, error.message);
      log.error('Webhook processing failed', { error });

      // 500 so Stripe retries. The claim row is now `failed`, and claim()
      // permits a retry to pick it up again.
      return res.status(500).json({
        received: true,
        error: 'Processing failed, please retry',
      });
    }
  })
);

async function processEvent(event, log) {
  const object = event.data.object;

  switch (event.type) {
    case 'checkout.session.completed': {
      // Card payments are `paid` immediately. Delayed methods (bank debits)
      // arrive as `unpaid` and settle later via async_payment_succeeded —
      // fulfilling here would give away the product before the money lands.
      if (object.payment_status === 'paid') {
        await fulfilment.fulfilCheckout(object);
      } else {
        log.info('Checkout completed but payment pending, awaiting settlement', {
          paymentStatus: object.payment_status,
        });
      }
      break;
    }

    case 'checkout.session.async_payment_succeeded':
      await fulfilment.fulfilCheckout(object);
      break;

    case 'checkout.session.async_payment_failed':
      log.warn('Delayed payment failed', { sessionId: object.id });
      break;

    case 'charge.refunded':
      await fulfilment.handleRefund(object);
      break;

    case 'charge.dispute.created':
      await fulfilment.handleDispute(object);
      break;

    case 'charge.dispute.closed':
      log.info('Dispute closed', { status: object.status, amount: object.amount });
      break;

    default:
      logger.debug('Unhandled event reached processEvent', { type: event.type });
  }
}

module.exports = router;
