'use strict';

/**
 * Checkout and public configuration.
 */

const express = require('express');
const { asyncHandler } = require('../utils/errors');
const validate = require('../utils/validate');
const rateLimiters = require('../middleware/rateLimit');
const stripeService = require('../services/stripeService');
const pricing = require('../services/pricingService');
const events = require('../models/events');
const { config } = require('../config');

const router = express.Router();

/**
 * GET /api/config
 *
 * Everything the sales page needs to render itself: the publishable key, live
 * prices, launch-window state and real cohort availability.
 *
 * The page fetches this on load rather than hardcoding prices, which means
 * changing a price is a .env edit and a restart — never an HTML edit. It also
 * guarantees the countdown on the page and the price at the till are the same
 * fact, which is what keeps the urgency honest.
 */
router.get('/config', (req, res) => {
  res.set('Cache-Control', 'public, max-age=60'); // short: cohort counts move
  res.json({
    // Publishable keys are designed to be public. The secret key never leaves
    // the server.
    stripePublishableKey: config.stripe.publishableKey,
    pricing: pricing.publicPricing(),
    supportEmail: config.email.supportEmail,
  });
});

/**
 * POST /api/checkout
 *
 * Body: { tier, email?, sessionKey?, attribution? }
 *
 * Note what is absent: any notion of price. See the header comment in
 * services/stripeService.js for why that matters.
 */
router.post('/checkout', rateLimiters.checkout, asyncHandler(async (req, res) => {
  const body = req.body || {};

  const validated = validate.collect({
    tier: validate.enumValue(body.tier, ['method', 'engine'], 'Tier'),
    // Optional: Stripe collects it anyway, but prefilling lifts conversion.
    email: body.email
      ? validate.email(body.email)
      : { ok: true, value: null },
  });

  // Attribution is best-effort and never trusted for anything but reporting,
  // so it is length-clamped rather than strictly validated.
  const attribution = {
    utmSource: clamp(body.attribution?.utmSource, 100),
    utmMedium: clamp(body.attribution?.utmMedium, 100),
    utmCampaign: clamp(body.attribution?.utmCampaign, 100),
    referrer: clamp(body.attribution?.referrer, 200),
  };

  const sessionKey = clamp(body.sessionKey, 64);

  const session = await stripeService.createCheckoutSession({
    tier: validated.tier,
    customerEmail: validated.email,
    attribution,
    sessionKey,
  });

  events.record(events.EVENT_TYPES.CHECKOUT_STARTED, {
    sessionKey,
    payload: {
      tier: validated.tier,
      amountCents: session.amountCents,
      source: attribution.utmSource || 'direct',
    },
  });

  req.log.info('Checkout started', { tier: validated.tier, amountCents: session.amountCents });

  res.json({ url: session.url, sessionId: session.id });
}));

/**
 * POST /api/verify-session
 *
 * Used by the success page to show a receipt. Deliberately read-only: it
 * reports what the webhook already recorded and never fulfils anything itself.
 * If the webhook has not landed yet, it says so and the page polls.
 */
router.post('/verify-session', asyncHandler(async (req, res) => {
  const { sessionId } = validate.collect({
    sessionId: validate.stripeSessionId(req.body?.sessionId),
  });

  const session = await stripeService.retrieveSession(sessionId);
  const customers = require('../models/customers');
  const customer = customers.findByStripeSession(sessionId);

  const paid = session.payment_status === 'paid';

  res.json({
    paid,
    // `fulfilled` false with `paid` true means the webhook is still in flight —
    // normally a second or two. The page shows a "finishing up" state rather
    // than an error, which prevents a wave of "I paid and nothing happened"
    // emails during that window.
    fulfilled: Boolean(customer),
    email: session.customer_details?.email || null,
    tier: session.metadata?.tier || null,
    tierName: pricing.TIERS[session.metadata?.tier]?.name || null,
    amountFormatted: session.amount_total ? pricing.formatPrice(session.amount_total) : null,
  });
}));

function clamp(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

module.exports = router;
