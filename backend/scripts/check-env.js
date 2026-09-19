#!/usr/bin/env node
'use strict';

/**
 * Pre-flight configuration check.
 *
 *     npm run check-env
 *
 * Run this before every deploy. It reports every problem at once with the fix
 * for each, rather than making you discover them one restart at a time.
 */

const fs = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '..', '.env');

console.log('\nCourse Printer — configuration check\n' + '─'.repeat(52) + '\n');

if (!fs.existsSync(envPath)) {
  console.error('No .env file found.\n');
  console.error('  Fix:  cp .env.example .env\n');
  console.error('Then open .env and fill in your Stripe keys and secrets.\n');
  process.exit(1);
}

const { config, getValidationReport } = require('../config');
const { errors, warnings } = getValidationReport();

// --- Configuration validity -------------------------------------------------
if (errors.length > 0) {
  console.error(`${errors.length} problem(s) that will stop the server starting:\n`);
  errors.forEach((error, index) => console.error(`  ${index + 1}. ${error}`));
  console.error('');
}

if (warnings.length > 0) {
  console.warn(`${warnings.length} warning(s):\n`);
  warnings.forEach((warning, index) => console.warn(`  ${index + 1}. ${warning}`));
  console.warn('');
}

// --- What is actually configured -------------------------------------------
console.log('Current configuration\n');

const rows = [
  ['Environment', config.env],
  ['Public URL', config.publicUrl],
  ['Port', String(config.port)],
  ['Stripe mode', config.stripe.secretKey.startsWith('sk_live_') ? 'LIVE — real money' : 'test'],
  ['Webhook secret', config.stripe.webhookSecret ? 'set' : 'MISSING'],
  ['Email transport', config.email.transport === 'console' ? 'console (nothing is sent)' : config.email.transport],
  ['Email from', config.email.from],
  ['Support email', config.email.supportEmail],
  ['CORS origins', config.cors.origins.join(', ') || '(none)'],
  ['Database', config.database.path],
  ['Method price', `${(config.pricing.method / 100).toFixed(2)} ${config.pricing.currency.toUpperCase()}`],
  ['Engine price', `${(config.pricing.engine / 100).toFixed(2)} ${config.pricing.currency.toUpperCase()}`],
  ['Launch window', config.pricing.launchEndsAt
    ? `${config.pricing.launchEndsAt.toISOString()} ${config.pricing.launchEndsAt > new Date() ? '(active)' : '(ENDED)'}`
    : 'not configured — no countdown shown'],
  ['Engine cohort cap', config.pricing.engineCohortLimit > 0 ? String(config.pricing.engineCohortLimit) : 'none'],
];

const labelWidth = Math.max(...rows.map(([label]) => label.length));
rows.forEach(([label, value]) => {
  console.log(`  ${label.padEnd(labelWidth)}   ${value}`);
});

// --- Deliverable ------------------------------------------------------------
console.log('\nDeliverable\n');

const methodExists = fs.existsSync(config.delivery.methodZip);
const engineExists = fs.existsSync(config.delivery.engineZip);

if (methodExists) {
  const sizeMb = (fs.statSync(config.delivery.methodZip).size / 1_048_576).toFixed(1);
  console.log(`  Method ZIP   present (${sizeMb} MB)`);
} else {
  console.log(`  Method ZIP   MISSING at ${config.delivery.methodZip}`);
  console.log('               Customers would get an error instead of the course.');
  console.log('               Fix:  npm run build-vault');
}
console.log(`  Engine ZIP   ${engineExists ? 'present' : 'not built (falls back to Method)'}`);

// --- Verdict ----------------------------------------------------------------
console.log('\n' + '─'.repeat(52));

if (errors.length > 0) {
  console.error('\nNOT READY — fix the problems above first.\n');
  process.exit(1);
}

if (!methodExists) {
  console.warn('\nSTARTS, BUT CANNOT DELIVER — build the course ZIP before taking payments.\n');
  process.exit(1);
}

if (config.isProduction && config.email.transport === 'console') {
  console.warn('\nSTARTS, BUT SENDS NO EMAIL — configure a real transport before driving traffic.\n');
  process.exit(1);
}

console.log('\nReady to start.  npm start\n');
process.exit(0);
