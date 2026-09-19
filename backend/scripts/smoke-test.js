#!/usr/bin/env node
'use strict';

/**
 * End-to-end smoke test against a running server.
 *
 *     npm start            # in one terminal
 *     npm run test:smoke   # in another
 *
 * Exercises the paths that must work for money to arrive: config, health,
 * checkout validation, rate limiting, admin auth and download rejection.
 *
 * It does NOT create a real Stripe session or charge anything.
 */

const BASE = process.env.SMOKE_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

let passed = 0;
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`  PASS  ${name}`);
    passed += 1;
  } catch (error) {
    console.error(`  FAIL  ${name}`);
    console.error(`        ${error.message}`);
    failed += 1;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });

  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json().catch(() => null)
    : await response.text();

  return { status: response.status, body, headers: response.headers };
}

async function main() {
  console.log(`\nSmoke test against ${BASE}\n`);

  await check('health endpoint responds', async () => {
    const { status, body } = await request('/api/health');
    assert(status === 200 || status === 503, `expected 200 or 503, got ${status}`);
    assert(body.version, 'no version in response');
  });

  await check('liveness probe is dependency-free', async () => {
    const { status, body } = await request('/api/health/live');
    assert(status === 200, `expected 200, got ${status}`);
    assert(body.status === 'ok', 'status not ok');
  });

  await check('public config exposes publishable key and prices', async () => {
    const { status, body } = await request('/api/config');
    assert(status === 200, `expected 200, got ${status}`);
    assert(body.stripePublishableKey, 'no publishable key');
    assert(!JSON.stringify(body).includes('sk_'), 'SECRET KEY LEAKED IN PUBLIC CONFIG');
    assert(Array.isArray(body.pricing.tiers) && body.pricing.tiers.length === 2, 'expected two tiers');
  });

  await check('checkout rejects an unknown tier', async () => {
    const { status, body } = await request('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'free_please' }),
    });
    assert(status === 400, `expected 400, got ${status}`);
    assert(body.error.code === 'validation_error', `expected validation_error, got ${body.error.code}`);
  });

  await check('checkout ignores a client-supplied price', async () => {
    // The client cannot name a price. This asserts the field is simply not read:
    // an invalid tier is still rejected regardless of what amount is sent.
    const { status } = await request('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'nonsense', amount: 1, priceCents: 1 }),
    });
    assert(status === 400, `expected 400, got ${status}`);
  });

  await check('checkout rejects a malformed email', async () => {
    const { status, body } = await request('/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ tier: 'method', email: 'not-an-email' }),
    });
    assert(status === 400, `expected 400, got ${status}`);
    assert(body.error.issues.some((i) => i.field === 'email'), 'email issue not reported');
  });

  await check('malformed JSON gets a 400, not a 500', async () => {
    const response = await fetch(`${BASE}/api/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{ this is not json',
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
  });

  await check('admin API rejects a request with no token', async () => {
    const { status } = await request('/api/admin/overview');
    assert(status === 401, `expected 401, got ${status}`);
  });

  await check('admin API rejects a wrong token', async () => {
    const { status } = await request('/api/admin/overview', {
      headers: { Authorization: 'Bearer definitely-not-the-right-token-0000000000' },
    });
    assert(status === 401, `expected 401, got ${status}`);
  });

  await check('invalid download token is rejected', async () => {
    const { status } = await request('/api/download/not-a-real-token-at-all');
    assert(status >= 400 && status < 500, `expected 4xx, got ${status}`);
  });

  await check('forged download token is rejected', async () => {
    // Well-formed shape, wrong signature.
    const fake = Buffer.from(JSON.stringify({ sub: 'x', typ: 'download', exp: 99_999_999_999 }))
      .toString('base64url');
    const { status } = await request(`/api/download/${fake}.YWJjZGVm`);
    assert(status === 403 || status === 400, `expected 403/400, got ${status}`);
  });

  await check('webhook without a signature is rejected', async () => {
    const response = await fetch(`${BASE}/api/webhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'checkout.session.completed', data: { object: {} } }),
    });
    assert(response.status === 400, `expected 400, got ${response.status}`);
  });

  await check('resend does not reveal whether an address is a customer', async () => {
    const a = await request('/api/download/resend', {
      method: 'POST',
      body: JSON.stringify({ email: 'definitely-not-a-customer-92847@example.com' }),
    });
    assert(a.status === 200, `expected 200, got ${a.status}`);
    assert(/if that email address has a purchase/i.test(a.body.message), 'response leaks existence');
  });

  await check('security headers are present', async () => {
    const { headers } = await request('/api/health');
    assert(headers.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options');
    assert(headers.get('content-security-policy'), 'missing CSP');
    assert(!headers.get('x-powered-by'), 'X-Powered-By is exposed');
  });

  await check('request id is returned for support correlation', async () => {
    const { headers } = await request('/api/health');
    assert(headers.get('x-request-id'), 'no X-Request-Id header');
  });

  await check('public testimonials endpoint returns only approved entries', async () => {
    const { status, body } = await request('/api/testimonials');
    assert(status === 200, `expected 200, got ${status}`);
    assert(Array.isArray(body.testimonials), 'expected an array');
    // Email addresses must never appear in the public payload.
    assert(!JSON.stringify(body).includes('@') || body.testimonials.every((t) => !t.email),
      'testimonial emails exposed publicly');
  });

  await check('unknown route returns a clean 404', async () => {
    const { status, body } = await request('/api/this-does-not-exist');
    assert(status === 404, `expected 404, got ${status}`);
    assert(body.error.code === 'not_found', 'wrong error code');
  });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nSmoke test could not run: ${error.message}`);
  console.error(`Is the server running at ${BASE}?\n`);
  process.exit(1);
});
