'use strict';

/**
 * Health and readiness probes.
 *
 * Two separate endpoints, because they answer different questions and hosts use
 * them differently:
 *
 *   /api/health/live   — "is the process alive?" Cheap, no dependencies. If this
 *                        fails, the platform should restart the container.
 *   /api/health/ready  — "can it serve traffic correctly?" Checks the database,
 *                        the deliverable file and Stripe. If this fails, the
 *                        platform should stop routing to it but NOT restart it,
 *                        because a restart will not fix a missing ZIP.
 *
 * Getting these the wrong way round produces a crash loop during an outage of
 * something you do not control.
 */

const express = require('express');
const { asyncHandler } = require('../utils/errors');
const { getDb } = require('../models/db');
const deliveryService = require('../services/deliveryService');
const stripeService = require('../services/stripeService');
const { config } = require('../config');

const router = express.Router();

const startedAt = Date.now();

/** Liveness. Must stay dependency-free. */
router.get('/health/live', (req, res) => {
  res.json({ status: 'ok', uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000) });
});

/** Readiness. Checks everything a purchase depends on. */
router.get('/health/ready', asyncHandler(async (req, res) => {
  const checks = {};

  // --- Database ---
  try {
    getDb().prepare('SELECT 1').get();
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, error: error.message };
  }

  // --- Deliverable file ---
  // This is the check that catches the deploy where the build step was skipped
  // and every customer would receive a 503 instead of their course.
  const artifacts = deliveryService.checkArtifacts();
  checks.deliverable = {
    ok: artifacts.ok,
    method: artifacts.method.exists,
    engine: artifacts.engine.exists,
    ...(artifacts.ok ? {} : { error: `Course ZIP not found at ${artifacts.method.path}. Run: npm run build-vault` }),
  };

  // --- Stripe ---
  const stripePing = await stripeService.ping();
  checks.stripe = stripePing;

  const ready = Object.values(checks).every((check) => check.ok);

  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  });
}));

/** Plain /api/health — a combined summary, handy for uptime monitors. */
router.get('/health', (req, res) => {
  let databaseOk = true;
  try { getDb().prepare('SELECT 1').get(); } catch { databaseOk = false; }

  const artifacts = deliveryService.checkArtifacts();
  const ok = databaseOk && artifacts.ok;

  res.status(ok ? 200 : 503).json({
    status: ok ? 'ok' : 'degraded',
    version: '2.0.0',
    environment: config.env,
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
    database: databaseOk,
    deliverable: artifacts.ok,
  });
});

module.exports = router;
