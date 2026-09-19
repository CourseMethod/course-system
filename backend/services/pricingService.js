'use strict';

/**
 * Pricing, launch windows and cohort caps.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * THE DESIGN PRINCIPLE HERE IS WORTH UNDERSTANDING BEFORE YOU CHANGE ANYTHING.
 *
 * Urgency and scarcity work. They are also the two places where course sellers
 * most often cross from persuasion into fraud, and the line is simple:
 *
 *     A deadline is honest if the thing it promises actually happens.
 *     A limit is honest if the thing it promises actually runs out.
 *
 * So this module is the single source of truth for BOTH the price the server
 * charges AND the countdown the sales page displays. They cannot drift apart,
 * because the page asks this module what to render. When the countdown hits
 * zero, the server really does charge more. When the cohort counter reaches the
 * cap, checkout for that tier really does close.
 *
 * That is not a moral flourish, it is a practical one. A countdown that resets
 * on refresh is spotted in about four seconds, it is the most reliable trust
 * signal a sceptical buyer has, and under the FTC Act a deadline you never
 * intend to honour is a deceptive practice. Honest urgency converts nearly as
 * well and you can defend every word of it.
 *
 * To run a genuine launch: set LAUNCH_PRICE_ENDS_AT and the higher after-launch
 * prices in .env. To run none: leave it empty and the page shows no countdown.
 * ────────────────────────────────────────────────────────────────────────────
 */

const { config } = require('../config');
const customers = require('../models/customers');
const { AppError } = require('../utils/errors');

/**
 * Static tier definitions. The `features` array is what the sales page and the
 * receipt email both render, so what a customer is promised at checkout is
 * literally the same list they are shown afterwards.
 */
const TIERS = {
  method: {
    id: 'method',
    name: 'The Method',
    tagline: 'Everything you need to build the course and get it selling.',
    features: [
      'The complete course vault — 5 modules, 40 lessons, in Obsidian',
      'Every AI prompt used to build it, ready to copy',
      'The distribution playbook with a 30-day posting calendar',
      'Reel scripts, hooks and caption templates',
      'Email sequence templates you can paste straight in',
      'Lifetime updates — every new lesson, free, forever',
      'Email support',
    ],
    deliverable: 'methodZip',
  },
  engine: {
    id: 'engine',
    name: 'The Engine',
    tagline: 'The course, plus the entire machine that sells it.',
    features: [
      'Everything in The Method',
      'The full sales page — the one you are reading — as editable code',
      'The production backend: Stripe checkout, automatic delivery, customer database',
      'Admin dashboard: every sale, customer and conversion number in one place',
      'The email system with open and click tracking built in',
      'Deployment guides for Railway, Render, Fly, Vercel and a plain VPS',
      'Security hardening and scaling guides',
      '30 days of direct 1-on-1 support over email',
    ],
    deliverable: 'engineZip',
    // Only this tier can carry a real cohort cap, because only this tier
    // includes a finite resource: your personal time.
    cohortLimited: true,
  },
};

/** Is the launch window currently open? */
function isLaunchActive() {
  if (!config.pricing.launchEndsAt) return false;
  return config.pricing.launchEndsAt.getTime() > Date.now();
}

/**
 * The price we will actually charge for a tier, right now, in cents.
 * This is the ONLY function allowed to decide a price. The checkout route calls
 * it at the moment of session creation, so a stale page cannot buy at an old
 * price and a tampered client cannot propose one.
 *
 * Three cases, and the distinction matters:
 *
 *   No launch window configured  → the base price (PRICE_METHOD / PRICE_ENGINE).
 *                                  This is the normal state. Your configured
 *                                  price is simply your price.
 *   Launch window, still open    → the base price, presented as a launch price
 *                                  with the higher after-launch figure shown
 *                                  struck through.
 *   Launch window, now closed    → the after-launch price, for real.
 *
 * The first case is the one worth being careful about: an earlier version of
 * this function returned the after-launch price whenever no launch was active,
 * which meant an operator who set PRICE_METHOD=4700 and configured no launch
 * would silently charge PRICE_METHOD_AFTER_LAUNCH instead. Charging a different
 * price from the one configured is the worst class of bug this file could have.
 */
function currentPriceCents(tierId) {
  const launchConfigured = Boolean(config.pricing.launchEndsAt);
  const launchClosed = launchConfigured && !isLaunchActive();

  if (tierId === 'method') {
    return launchClosed ? config.pricing.methodAfterLaunch : config.pricing.method;
  }
  if (tierId === 'engine') {
    return launchClosed ? config.pricing.engineAfterLaunch : config.pricing.engine;
  }
  throw new AppError('Unknown product tier.', 400, 'unknown_tier');
}

/**
 * If no launch is configured, the base price is simply the price and there is
 * no "was" figure. Showing a struck-through price that was never charged is a
 * fictitious-pricing violation in most jurisdictions, so we return null and the
 * page renders nothing rather than inventing an anchor.
 */
function compareAtPriceCents(tierId) {
  if (!config.pricing.launchEndsAt || !isLaunchActive()) return null;
  return tierId === 'method' ? config.pricing.methodAfterLaunch : config.pricing.engineAfterLaunch;
}

/**
 * Cohort availability for a tier.
 * @returns {{limited: boolean, limit: number|null, sold: number|null, remaining: number|null, soldOut: boolean}}
 */
function cohortStatus(tierId) {
  const tier = TIERS[tierId];
  const limit = config.pricing.engineCohortLimit;

  if (!tier?.cohortLimited || !limit || limit <= 0) {
    return { limited: false, limit: null, sold: null, remaining: null, soldOut: false };
  }

  const sold = customers.countPaidByTier(tierId);
  const remaining = Math.max(0, limit - sold);

  return { limited: true, limit, sold, remaining, soldOut: remaining === 0 };
}

/**
 * Gate called before creating a checkout session.
 * Throws if the tier genuinely cannot be sold right now.
 */
function assertPurchasable(tierId) {
  const tier = TIERS[tierId];
  if (!tier) throw new AppError('That product does not exist.', 400, 'unknown_tier');

  const cohort = cohortStatus(tierId);
  if (cohort.soldOut) {
    throw new AppError(
      `${tier.name} is fully booked for this cohort. It includes direct 1-on-1 support and there is a real limit to how many people can be in it at once. ` +
      'Join the waitlist and you will be first to know when it reopens.',
      409,
      'cohort_full'
    );
  }

  return tier;
}

/**
 * Format a cent amount for display.
 *
 * Whole amounts drop the decimals ($47, not $47.00) because a price with
 * trailing zeros reads as heavier than the same number without them. Totals
 * get thousands separators, because "$2292" is momentarily unreadable in a
 * dashboard tile in a way "$2,292" is not.
 */
function formatPrice(cents, currency = config.pricing.currency) {
  const symbol = { usd: '$', gbp: '£', eur: '€', cad: 'CA$', aud: 'A$' }[currency] || '';
  const hasFraction = cents % 100 !== 0;
  const amount = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  });
  return `${symbol}${amount}`;
}

/**
 * The complete public pricing payload, served at /api/config and consumed by
 * the sales page. Everything the page needs to render prices, countdowns and
 * availability comes from here, so there is exactly one place to change a price.
 */
function publicPricing() {
  const launchActive = isLaunchActive();

  const tiers = Object.values(TIERS).map((tier) => {
    const price = currentPriceCents(tier.id);
    const compareAt = compareAtPriceCents(tier.id);
    const cohort = cohortStatus(tier.id);

    return {
      id: tier.id,
      name: tier.name,
      tagline: tier.tagline,
      features: tier.features,
      priceCents: price,
      priceFormatted: formatPrice(price),
      compareAtCents: compareAt,
      compareAtFormatted: compareAt ? formatPrice(compareAt) : null,
      savingsFormatted: compareAt ? formatPrice(compareAt - price) : null,
      available: !cohort.soldOut,
      cohort: cohort.limited
        ? { limit: cohort.limit, remaining: cohort.remaining, soldOut: cohort.soldOut }
        : null,
    };
  });

  return {
    currency: config.pricing.currency,
    tiers,
    launch: launchActive
      ? {
          active: true,
          // The page counts down to this instant. When it passes, the next
          // request to this endpoint returns the higher prices — the countdown
          // and the charge are the same fact.
          endsAt: config.pricing.launchEndsAt.toISOString(),
        }
      : { active: false, endsAt: null },
  };
}

module.exports = {
  TIERS,
  isLaunchActive,
  currentPriceCents,
  compareAtPriceCents,
  cohortStatus,
  assertPurchasable,
  formatPrice,
  publicPricing,
};
