'use strict';

/**
 * Course Printer — application entry point.
 *
 * Responsibilities, in order:
 *   1. Validate configuration and refuse to start if it is wrong.
 *   2. Open the database and run migrations.
 *   3. Assemble the middleware stack in the ONE order that works.
 *   4. Mount routes.
 *   5. Listen, and shut down cleanly when asked.
 *
 * MIDDLEWARE ORDER IS LOAD-BEARING. Read the comments before rearranging
 * anything — several of these orderings are the difference between a working
 * payment system and one that fails in ways that are hard to diagnose.
 */

const path = require('path');
const express = require('express');
const compression = require('compression');

const { config, validateOrExit } = require('./config');

// Fail fast, before anything else is initialised.
validateOrExit();

const logger = require('./utils/logger');
const { initDatabase, closeDatabase } = require('./models/db');
const { securityHeaders, corsPolicy } = require('./middleware/security');
const requestContext = require('./middleware/requestContext');
const rateLimiters = require('./middleware/rateLimit');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const emailService = require('./services/emailService');
const deliveryService = require('./services/deliveryService');

const checkoutRoutes = require('./routes/checkout');
const webhookRoutes = require('./routes/webhook');
const downloadRoutes = require('./routes/download');
const trackingRoutes = require('./routes/tracking');
const supportRoutes = require('./routes/support');
const analyticsRoutes = require('./routes/analytics');
const adminRoutes = require('./routes/admin');
const healthRoutes = require('./routes/health');
const configRoutes = require('./routes/config');

const app = express();

// ---------------------------------------------------------------------------
// 1. Trust proxy
// ---------------------------------------------------------------------------
// Every managed host (Railway, Render, Fly, Heroku, or nginx in front of Node)
// terminates TLS and forwards. Without this, req.ip is the proxy's address, so
// rate limiting sees all traffic as one client and either blocks everyone or
// nobody. `1` means "trust exactly one proxy hop" — using `true` would let a
// client spoof X-Forwarded-For and bypass rate limits entirely.
app.set('trust proxy', 1);

// Do not advertise the framework.
app.disable('x-powered-by');

// ---------------------------------------------------------------------------
// 2. Request context — first, so every later log line carries a request id
// ---------------------------------------------------------------------------
app.use(requestContext);

// ---------------------------------------------------------------------------
// 3. Security headers and CORS
// ---------------------------------------------------------------------------
app.use(securityHeaders());
app.use(corsPolicy());

// ---------------------------------------------------------------------------
// 4. STRIPE WEBHOOK — MOUNTED BEFORE THE JSON BODY PARSER
// ---------------------------------------------------------------------------
// This placement is mandatory and is the single most common Stripe integration
// mistake. Stripe signs the raw bytes of the request body. express.json() would
// consume the stream and hand us a parsed object; re-serialising it produces
// different bytes, so the signature never verifies and every webhook 400s.
//
// The router applies express.raw() itself, so the body arrives as a Buffer.
// Moving this line below express.json() breaks all payment fulfilment.
app.use('/api', webhookRoutes);

// ---------------------------------------------------------------------------
// 5. Body parsing for everything else
// ---------------------------------------------------------------------------
// The size limit is deliberately small. Nothing this API legitimately accepts
// is larger than a few kilobytes, and an unbounded parser is a trivial
// memory-exhaustion vector.
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: false, limit: '64kb' }));

// ---------------------------------------------------------------------------
// 6. Compression
// ---------------------------------------------------------------------------
// After body parsing, before routes. The filter skips the ZIP download —
// compressing an already-compressed archive burns CPU to make the file
// marginally larger, and it breaks the Content-Length we set for the progress
// bar in the customer's browser.
app.use(compression({
  filter(req, res) {
    if (req.path.startsWith('/api/download/')) return false;
    return compression.filter(req, res);
  },
}));

// ---------------------------------------------------------------------------
// 7. General rate limit backstop
// ---------------------------------------------------------------------------
// Per-route limiters do the real work; this catches broad floods. Health checks
// are exempt so a monitor cannot rate-limit itself out of working.
// /config is also exempt — every page load needs it, and it's lightweight.
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/health') || req.path.startsWith('/config')) return next();
  return rateLimiters.general(req, res, next);
});

// ---------------------------------------------------------------------------
// 8. Routes
// ---------------------------------------------------------------------------
app.use('/api', healthRoutes);
app.use('/api', configRoutes);
app.use('/api', checkoutRoutes);
app.use('/api', downloadRoutes);
app.use('/api', trackingRoutes);
app.use('/api', supportRoutes);
app.use('/api', analyticsRoutes);
app.use('/api/admin', adminRoutes);

// ---------------------------------------------------------------------------
// 9. Static sales page
// ---------------------------------------------------------------------------
// Convenient for a single-box deploy: one process serves both the page and the
// API, so there is no CORS to configure and no second host to pay for. If you
// put the page on a CDN instead, this simply goes unused.
const webRoot = path.resolve(__dirname, '..', 'web');
app.use(express.static(webRoot, {
  extensions: ['html'],
  // The HTML changes whenever you edit your copy, so it must not be cached
  // aggressively — otherwise you change a price and returning visitors keep
  // seeing the old one.
  setHeaders(res, filePath) {
    if (filePath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));

// ---------------------------------------------------------------------------
// 10. 404 and error handling — must be last
// ---------------------------------------------------------------------------
app.use(notFound);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Startup
// ---------------------------------------------------------------------------

async function start() {
  initDatabase();

  // Non-fatal checks that produce actionable warnings rather than a refusal to
  // start. A server that takes payments but cannot email is still better than
  // no server — the sale is recorded and recoverable.
  await emailService.verifyTransport();

  const artifacts = deliveryService.checkArtifacts();
  if (!artifacts.ok) {
    logger.warn(
      `Course ZIP not found at ${artifacts.method.path}. ` +
      'Customers who purchase will get an error instead of their download. ' +
      'Build it with: npm run build-vault'
    );
  } else {
    logger.info('Deliverable ready', {
      method: `${(artifacts.method.sizeBytes / 1_048_576).toFixed(1)} MB`,
      engine: artifacts.engine.exists ? `${(artifacts.engine.sizeBytes / 1_048_576).toFixed(1)} MB` : 'not built',
    });
  }

  const server = app.listen(config.port, () => {
    logger.info('Course Printer is running', {
      port: config.port,
      environment: config.env,
      publicUrl: config.publicUrl,
      stripeMode: config.stripe.isLiveMode ? 'LIVE' : 'test',
      emailTransport: config.email.transport,
    });

    if (!config.isProduction) {
      // eslint-disable-next-line no-console
      console.log(`
  Sales page   ${config.publicUrl}
  Admin        ${config.publicUrl}/admin.html
  Health       ${config.publicUrl}/api/health

  Stripe is in ${config.stripe.isLiveMode ? 'LIVE' : 'TEST'} mode.
  To receive webhooks locally:  stripe listen --forward-to localhost:${config.port}/api/webhook
`);
    }
  });

  // Node's default is 5 seconds, which is shorter than many load balancers'
  // idle timeout and causes sporadic 502s under keep-alive. 65 > 60 fixes it.
  server.keepAliveTimeout = 65_000;
  server.headersTimeout = 66_000;

  setupGracefulShutdown(server);

  return server;
}

/**
 * Graceful shutdown.
 *
 * Every platform deploy sends SIGTERM and then waits a short grace period.
 * Without handling it, in-flight requests are killed mid-response — and if one
 * of those is a Stripe webhook, Stripe records a failure and retries, which is
 * survivable but noisy. Worse, an interrupted database write with WAL enabled
 * leaves recovery work for the next boot.
 */
function setupGracefulShutdown(server) {
  let shuttingDown = false;

  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    logger.info(`${signal} received, shutting down gracefully`);

    // Stop accepting new connections; existing ones finish.
    server.close(() => {
      logger.info('HTTP server closed');
      emailService.closeTransport();
      closeDatabase();
      logger.info('Shutdown complete');
      process.exit(0);
    });

    // Backstop: if something hangs, exit anyway rather than being SIGKILLed
    // mid-write. 15s sits inside the typical 30s platform grace period.
    setTimeout(() => {
      logger.error('Graceful shutdown timed out, forcing exit');
      process.exit(1);
    }, 15_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // An unhandled rejection leaves the process in an unknown state. Log it
  // loudly; do not exit, because in practice this is usually a non-critical
  // background task and killing a server that is taking payments is worse.
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled promise rejection', { error: reason });
  });

  // An uncaught exception genuinely does leave the process unsafe. Log, then
  // exit so the platform restarts a clean one.
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught exception — exiting', { error });
    try { closeDatabase(); } catch { /* best effort */ }
    process.exit(1);
  });
}

// Only listen when run directly, so tests can import `app` without binding a port.
if (require.main === module) {
  start().catch((error) => {
    logger.error('Failed to start server', { error });
    process.exit(1);
  });
}

module.exports = { app, start };
