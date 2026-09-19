'use strict';

/**
 * Configuration loading and validation.
 *
 * Design rule: the process refuses to start if it is misconfigured, and says
 * exactly what is wrong and how to fix it. A server that boots "successfully"
 * with a missing webhook secret is worse than one that refuses to boot, because
 * the failure surfaces later as silent lost sales instead of a loud startup
 * error you see immediately.
 *
 * Everything that reads process.env lives here. No other file in the codebase
 * touches process.env directly, so there is exactly one place to look when you
 * are asking "where does this value come from?".
 */

require('dotenv').config();

const path = require('path');

/** Collected during validation so we can report ALL problems at once. */
const errors = [];
const warnings = [];

// ---------------------------------------------------------------------------
// Primitive readers
// ---------------------------------------------------------------------------

function str(name, { required = false, fallback = '', minLength = 0, secret = false } = {}) {
  const raw = (process.env[name] ?? '').trim();

  if (!raw) {
    if (required) {
      errors.push(`${name} is required but not set.`);
    }
    return fallback;
  }

  // Catch the extremely common "I copied .env.example and never edited it" case.
  if (raw.includes('replace_me') || raw.includes('YOUR_') || raw.includes('_HERE')) {
    errors.push(`${name} still contains a placeholder value ("${secret ? '***' : raw}"). Replace it with a real value.`);
    return fallback;
  }

  if (minLength && raw.length < minLength) {
    errors.push(`${name} must be at least ${minLength} characters (got ${raw.length}).`);
  }

  return raw;
}

function int(name, { required = false, fallback = 0, min = null, max = null } = {}) {
  const raw = (process.env[name] ?? '').trim();

  if (!raw) {
    if (required) errors.push(`${name} is required but not set.`);
    return fallback;
  }

  const parsed = Number(raw);
  if (!Number.isInteger(parsed)) {
    errors.push(`${name} must be a whole number (got "${raw}").`);
    return fallback;
  }
  if (min !== null && parsed < min) {
    errors.push(`${name} must be >= ${min} (got ${parsed}).`);
  }
  if (max !== null && parsed > max) {
    errors.push(`${name} must be <= ${max} (got ${parsed}).`);
  }
  return parsed;
}

function bool(name, fallback = false) {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  return raw === 'true' || raw === '1' || raw === 'yes';
}

function list(name, fallback = []) {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return fallback;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function isoDate(name) {
  const raw = (process.env[name] ?? '').trim();
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    errors.push(`${name} must be an ISO 8601 timestamp like 2026-10-01T23:59:59Z (got "${raw}").`);
    return null;
  }
  return parsed;
}

function oneOf(name, allowed, fallback) {
  const raw = (process.env[name] ?? '').trim().toLowerCase();
  if (!raw) return fallback;
  if (!allowed.includes(raw)) {
    errors.push(`${name} must be one of: ${allowed.join(', ')} (got "${raw}").`);
    return fallback;
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Build the config object
// ---------------------------------------------------------------------------

const env = oneOf('NODE_ENV', ['development', 'production', 'test'], 'development');
const isProduction = env === 'production';
const isTest = env === 'test';

const publicUrl = str('PUBLIC_URL', { fallback: 'http://localhost:3000' }).replace(/\/+$/, '');

const config = {
  env,
  isProduction,
  isTest,
  port: int('PORT', { fallback: 3000, min: 1, max: 65535 }),
  publicUrl,

  cors: {
    // In production an empty origin list is a configuration error, not a
    // licence to allow everything. We fail closed.
    origins: list('CORS_ORIGINS', isProduction ? [] : [publicUrl, 'http://localhost:3000', 'http://127.0.0.1:3000']),
  },

  stripe: {
    secretKey: str('STRIPE_SECRET_KEY', { required: !isTest, secret: true }),
    publishableKey: str('STRIPE_PUBLISHABLE_KEY', { required: !isTest }),
    webhookSecret: str('STRIPE_WEBHOOK_SECRET', { required: !isTest, secret: true }),
  },

  security: {
    tokenSecret: str('TOKEN_SECRET', { required: !isTest, minLength: 32, secret: true }),
    adminToken: str('ADMIN_TOKEN', { required: !isTest, minLength: 32, secret: true }),
    downloadTtlHours: int('DOWNLOAD_TOKEN_TTL_HOURS', { fallback: 72, min: 1, max: 8760 }),
    downloadMaxUses: int('DOWNLOAD_MAX_USES', { fallback: 25, min: 1, max: 1000 }),
  },

  email: {
    transport: oneOf('EMAIL_TRANSPORT', ['smtp', 'gmail', 'console'], 'console'),
    from: str('EMAIL_FROM', { fallback: 'Course Printer <hello@example.com>' }),
    supportEmail: str('SUPPORT_EMAIL', { fallback: 'hello@example.com' }),
    smtp: {
      host: str('SMTP_HOST'),
      port: int('SMTP_PORT', { fallback: 587, min: 1, max: 65535 }),
      secure: bool('SMTP_SECURE', false),
      user: str('SMTP_USER'),
      password: str('SMTP_PASSWORD', { secret: true }),
    },
    gmail: {
      user: str('GMAIL_USER'),
      appPassword: str('GMAIL_APP_PASSWORD', { secret: true }),
    },
  },

  pricing: {
    currency: str('CURRENCY', { fallback: 'usd' }).toLowerCase(),
    method: int('PRICE_METHOD', { fallback: 4700, min: 100 }),
    engine: int('PRICE_ENGINE', { fallback: 9700, min: 100 }),
    launchEndsAt: isoDate('LAUNCH_PRICE_ENDS_AT'),
    methodAfterLaunch: int('PRICE_METHOD_AFTER_LAUNCH', { fallback: 7900, min: 100 }),
    engineAfterLaunch: int('PRICE_ENGINE_AFTER_LAUNCH', { fallback: 14900, min: 100 }),
    engineCohortLimit: int('ENGINE_COHORT_LIMIT', { fallback: 0, min: 0 }),
  },

  delivery: {
    methodZip: path.resolve(__dirname, '..', str('VAULT_ZIP_PATH', { fallback: './dist/course-printer-vault.zip' })),
    engineZip: path.resolve(__dirname, '..', str('VAULT_ZIP_ENGINE_PATH', { fallback: './dist/course-printer-engine.zip' })),
  },

  database: {
    path: path.resolve(__dirname, '..', str('DATABASE_PATH', { fallback: './data/course-printer.db' })),
  },

  logging: {
    level: oneOf('LOG_LEVEL', ['error', 'warn', 'info', 'debug'], 'info'),
    json: bool('LOG_JSON', isProduction),
  },
};

// ---------------------------------------------------------------------------
// Cross-field validation — the checks that catch real, expensive mistakes
// ---------------------------------------------------------------------------

// 1. Never ship test keys to production. This one has cost people real launches:
//    the page works, checkout "succeeds", and no money ever arrives.
if (isProduction && config.stripe.secretKey.startsWith('sk_test_')) {
  errors.push(
    'STRIPE_SECRET_KEY is a TEST key but NODE_ENV=production. ' +
    'Real customers would see a working checkout that never charges them. ' +
    'Swap in your sk_live_ key, or set NODE_ENV=development.'
  );
}
if (isProduction && config.stripe.publishableKey.startsWith('pk_test_')) {
  errors.push('STRIPE_PUBLISHABLE_KEY is a TEST key but NODE_ENV=production. Swap in your pk_live_ key.');
}

// 2. Mixing live and test keys produces baffling "No such customer" errors.
const secretIsLive = config.stripe.secretKey.startsWith('sk_live_');
const publishableIsLive = config.stripe.publishableKey.startsWith('pk_live_');
if (config.stripe.secretKey && config.stripe.publishableKey && secretIsLive !== publishableIsLive) {
  errors.push(
    'STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY are from different modes ' +
    `(secret=${secretIsLive ? 'live' : 'test'}, publishable=${publishableIsLive ? 'live' : 'test'}). ` +
    'They must both be live or both be test.'
  );
}

// 3. Production must serve over HTTPS or Stripe redirects and cookies break.
if (isProduction && !config.publicUrl.startsWith('https://')) {
  errors.push(`PUBLIC_URL must use https:// in production (got "${config.publicUrl}").`);
}

// 4. Fail closed on CORS rather than silently allowing every origin.
if (isProduction && config.cors.origins.length === 0) {
  errors.push('CORS_ORIGINS must list your domain(s) in production. Leaving it empty would block your own sales page.');
}
if (config.cors.origins.includes('*')) {
  errors.push('CORS_ORIGINS must not contain "*". List your exact domains.');
}

// 5. The two secrets must not be the same value, and must not be trivially weak.
if (config.security.tokenSecret && config.security.tokenSecret === config.security.adminToken) {
  errors.push('TOKEN_SECRET and ADMIN_TOKEN must be different values. Generate each one separately.');
}

// 6. Email that is not actually configured.
if (config.email.transport === 'smtp' && (!config.email.smtp.host || !config.email.smtp.user)) {
  errors.push('EMAIL_TRANSPORT=smtp requires SMTP_HOST, SMTP_USER and SMTP_PASSWORD.');
}
if (config.email.transport === 'gmail' && (!config.email.gmail.user || !config.email.gmail.appPassword)) {
  errors.push('EMAIL_TRANSPORT=gmail requires GMAIL_USER and GMAIL_APP_PASSWORD (an App Password, not your login password).');
}
if (isProduction && config.email.transport === 'console') {
  warnings.push(
    'EMAIL_TRANSPORT=console in production: customers will NOT receive their course email. ' +
    'Purchases still record correctly and you can resend from the admin dashboard, but fix this before you drive traffic.'
  );
}

// 7. Launch pricing sanity. A "sale" that already ended, or that raises nothing,
//    means the countdown on your page is lying to visitors.
if (config.pricing.launchEndsAt) {
  if (config.pricing.launchEndsAt.getTime() < Date.now()) {
    warnings.push(
      `LAUNCH_PRICE_ENDS_AT (${config.pricing.launchEndsAt.toISOString()}) is in the past. ` +
      'Launch pricing is over, so full price is now in effect and the sales page will not show a countdown.'
    );
  }
  if (config.pricing.methodAfterLaunch <= config.pricing.method) {
    warnings.push('PRICE_METHOD_AFTER_LAUNCH is not higher than PRICE_METHOD, so the "price goes up" claim would be false. Fix the numbers or clear LAUNCH_PRICE_ENDS_AT.');
  }
  if (config.pricing.engineAfterLaunch <= config.pricing.engine) {
    warnings.push('PRICE_ENGINE_AFTER_LAUNCH is not higher than PRICE_ENGINE, so the "price goes up" claim would be false. Fix the numbers or clear LAUNCH_PRICE_ENDS_AT.');
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

/**
 * Print collected warnings, and abort the process if anything is fatally wrong.
 * Called once from server.js before any listener is opened.
 */
function validateOrExit() {
  for (const warning of warnings) {
    // eslint-disable-next-line no-console
    console.warn(`  [config warning] ${warning}`);
  }

  if (errors.length > 0) {
    // eslint-disable-next-line no-console
    console.error(
      '\n' +
      'Configuration problems — the server will not start\n' +
      '───────────────────────────────────────────────────\n' +
      errors.map((e, i) => `  ${i + 1}. ${e}`).join('\n') +
      '\n\n' +
      '  Fix these in your .env file, then run `npm run check-env` to re-check.\n' +
      '  If you have not created a .env yet:  cp .env.example .env\n'
    );
    process.exit(1);
  }
}

/** Used by scripts/check-env.js to inspect without exiting. */
function getValidationReport() {
  return { errors: [...errors], warnings: [...warnings] };
}

module.exports = { config, validateOrExit, getValidationReport };
