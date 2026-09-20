'use strict';

/**
 * Stripe integration.
 *
 * Two rules govern everything in this file.
 *
 * RULE 1: THE SERVER DECIDES THE PRICE.
 * The client sends a tier id — `method` or `engine` — and nothing else about
 * money. It never sends an amount. If it did, a customer could open devtools
 * and buy The Engine for one cent, and you would not find out until you
 * reconciled your Stripe payouts. The price is looked up server-side at the
 * moment the session is created.
 *
 * RULE 2: PAYMENT IS ONLY REAL WHEN THE WEBHOOK SAYS SO.
 * The browser redirect to your success page is a UI convenience, not proof of
 * payment. Anyone can navigate to /success?session_id=... by hand, and a real
 * customer can close the tab before the redirect fires. Fulfilment happens in
 * the webhook handler, which is signed and retried. The success page only ever
 * *reads* state the webhook already established.
 */

const Stripe = require('stripe');
const { config } = require('../config');
const logger = require('../utils/logger');
const { UpstreamError, AppError } = require('../utils/errors');
const { withRetry } = require('../utils/retry');
const pricing = require('./pricingService');

const stripe = Stripe(config.stripe.secretKey, {
  apiVersion: '2024-06-20',
  // Stripe's SDK retries idempotently on network errors; two is a sane cap
  // before our own retry wrapper takes over.
  maxNetworkRetries: 2,
  timeout: 20_000,
  appInfo: { name: 'Course Method', version: '2.0.0' },
});

/**
 * Create a Checkout session.
 *
 * @param {object} options
 * @param {'method'|'engine'} options.tier
 * @param {string} [options.customerEmail]  Prefills the Stripe form.
 * @param {object} [options.attribution]    utm_source etc., carried to metadata.
 * @param {string} [options.sessionKey]     Anonymous visitor id, for funnel joins.
 * @returns {Promise<{id: string, url: string, amountCents: number}>}
 */
async function createCheckoutSession({ tier, customerEmail = null, attribution = {}, sessionKey = null }) {
  // Throws if the tier does not exist or the cohort is genuinely full.
  const tierDefinition = pricing.assertPurchasable(tier);

  // RULE 1 in force: price comes from the server, at this instant.
  const amountCents = pricing.currentPriceCents(tier);

  try {
    const session = await withRetry(
      () => stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],

        line_items: [{
          quantity: 1,
          price_data: {
            currency: config.pricing.currency,
            unit_amount: amountCents,
            product_data: {
              name: tierDefinition.name,
              description: tierDefinition.tagline,
            },
          },
        }],

        // `{CHECKOUT_SESSION_ID}` is substituted by Stripe on redirect.
        success_url: `${config.publicUrl}/success.html?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${config.publicUrl}/#pricing`,

        ...(customerEmail ? { customer_email: customerEmail } : {}),

        // Metadata is the only thing that survives into the webhook, so
        // everything fulfilment needs goes here. Stripe caps each value at 500
        // characters, hence the slicing.
        metadata: {
          tier,
          session_key: sessionKey || '',
          utm_source: (attribution.utmSource || '').slice(0, 100),
          utm_medium: (attribution.utmMedium || '').slice(0, 100),
          utm_campaign: (attribution.utmCampaign || '').slice(0, 100),
          referrer: (attribution.referrer || '').slice(0, 200),
        },

        // Collect an address only where tax rules require it. Every extra field
        // on a checkout form costs conversions, so this is deliberately minimal.
        billing_address_collection: 'auto',

        // Expire abandoned sessions after 30 minutes rather than Stripe's
        // 24-hour default, so your dashboard reflects reality.
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }),
      { retries: 2, label: 'stripe:createCheckoutSession' }
    );

    logger.info('Checkout session created', { sessionId: session.id, tier, amountCents });

    return { id: session.id, url: session.url, amountCents };
  } catch (error) {
    // Stripe's typed errors are handled by the error middleware, which knows
    // how to translate them for a customer. Anything else is an upstream fault.
    if (error.type && String(error.type).startsWith('Stripe')) throw error;
    throw new UpstreamError('stripe', error);
  }
}

/**
 * Verify a Stripe webhook signature and return the parsed event.
 *
 * `rawBody` MUST be the untouched request body as a Buffer. If any middleware
 * has already parsed it into an object, the signature will not verify, because
 * the signature covers the exact bytes Stripe sent — re-serialising produces
 * different bytes. This is the single most common webhook integration failure;
 * see how server.js mounts express.raw() for this route only.
 */
function constructWebhookEvent(rawBody, signatureHeader) {
  if (!signatureHeader) {
    throw new AppError('Missing Stripe signature header.', 400, 'missing_signature');
  }

  try {
    return stripe.webhooks.constructEvent(rawBody, signatureHeader, config.stripe.webhookSecret);
  } catch (error) {
    // Do not leak why it failed. A forger should learn nothing from the reply.
    logger.warn('Webhook signature verification failed', { error: error.message });
    throw new AppError('Webhook signature verification failed.', 400, 'invalid_signature');
  }
}

/** Retrieve a checkout session, used by the success page to display a receipt. */
async function retrieveSession(sessionId) {
  try {
    return await withRetry(
      () => stripe.checkout.sessions.retrieve(sessionId, { expand: ['payment_intent'] }),
      { retries: 2, label: 'stripe:retrieveSession' }
    );
  } catch (error) {
    if (error.type && String(error.type).startsWith('Stripe')) throw error;
    throw new UpstreamError('stripe', error);
  }
}

/**
 * Issue a refund.
 *
 * @param {string} paymentIntentId
 * @param {string} [reason]  'requested_by_customer' | 'duplicate' | 'fraudulent'
 */
async function refund(paymentIntentId, reason = 'requested_by_customer') {
  try {
    const result = await withRetry(
      () => stripe.refunds.create({ payment_intent: paymentIntentId, reason }),
      { retries: 2, label: 'stripe:refund' }
    );
    logger.info('Refund issued', { paymentIntentId, refundId: result.id, amount: result.amount });
    return result;
  } catch (error) {
    if (error.type && String(error.type).startsWith('Stripe')) throw error;
    throw new UpstreamError('stripe', error);
  }
}

/**
 * Lightweight connectivity check for the readiness probe.
 * Deliberately a cheap call — this runs on every health check.
 */
async function ping() {
  try {
    await stripe.balance.retrieve();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

module.exports = { stripe, createCheckoutSession, constructWebhookEvent, retrieveSession, refund, ping };
