'use strict';

/**
 * Public configuration endpoint.
 * Exposes only the client-side configuration: pricing, Stripe key, launch window.
 * Does NOT expose secrets like webhook secret, database path, or admin tokens.
 */

const express = require('express');
const { config } = require('../config');

const router = express.Router();

/**
 * GET /api/config
 * Returns public configuration for the sales page.
 */
router.get('/config', (req, res) => {
  // Determine if launch pricing is active
  const now = new Date();
  const launchActive = config.pricing.launchEndsAt && now < config.pricing.launchEndsAt;

  // Current prices (may be launch or regular)
  const methodPrice = launchActive ? config.pricing.method : config.pricing.methodAfterLaunch;
  const enginePrice = launchActive ? config.pricing.engine : config.pricing.engineAfterLaunch;

  // Prices after launch (for comparison)
  const methodAfter = config.pricing.methodAfterLaunch;
  const engineAfter = config.pricing.engineAfterLaunch;

  const SYM = { usd: '$', eur: '€', gbp: '£', cad: 'CA$', aud: 'A$' }; const CUR = SYM[config.pricing.currency] || ''; const formatPrice = (cents) => CUR + (cents / 100).toFixed(2).replace(/\.?0+$/, '');

  res.json({
    stripePublishableKey: config.stripe.publishableKey,
    pricing: {
      // Gumroad is the merchant of record and adds VAT on top of the listed
      // price at its own checkout, so the page has to say so. Showing a
      // consumer a price that is not what they will be charged is both a
      // conversion problem at the last step and a breach of the EU price
      // indication rules.
      taxAddedAtCheckout: Boolean(config.checkout.gumroadMethodUrl || config.checkout.gumroadEngineUrl),
      launch: launchActive
        ? {
            active: true,
            endsAt: config.pricing.launchEndsAt.toISOString(),
          }
        : { active: false },
      tiers: [
        {
          id: 'method',
          name: 'The Method',
          tagline: 'The complete playbook. Build a course faceless. Sell it with templates. Everything you need, nothing you don\'t.',
          price: methodPrice,
          priceFormatted: formatPrice(methodPrice),
          compareAtFormatted: launchActive ? formatPrice(methodAfter) : null,
          checkoutUrl: config.checkout.gumroadMethodUrl || null,
          available: true,
          features: [
            'Full Course Method vault — 41 lessons, 5 modules',
            'Step-by-step faceless course build guide',
            'Positioning framework, niche finder, audience research',
            'Fill-in templates for everything',
            'AI prompts for content, scripts, social posts',
            'The 30-day distribution playbook',
            'Lifetime updates',
          ],
        },
        {
          id: 'engine',
          name: 'The Engine',
          tagline: 'Everything in The Method plus plug-and-play: the entire selling system, wired up and ready to launch.',
          price: enginePrice,
          priceFormatted: formatPrice(enginePrice),
          compareAtFormatted: launchActive ? formatPrice(engineAfter) : null,
          checkoutUrl: config.checkout.gumroadEngineUrl || null,
          available: true,
          features: [
            'Everything in The Method, plus:',
            'Sales page + checkout — this exact system',
            'Automated course delivery after purchase',
            'Customer database + analytics dashboard',
            'Email sequences + support tracking',
            'Full source code — read it, modify it, own it',
            'Deployment guides for every platform',
            'Email support through launch',
          ],
        },
      ],
    },
  });
});

module.exports = router;
