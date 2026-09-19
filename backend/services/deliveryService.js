'use strict';

/**
 * Course delivery: issuing download links and streaming the file.
 *
 * The threat model, concretely. A download link is a bearer credential for a
 * paid product. If it can be guessed, shared indefinitely, or survives a
 * refund, you are giving the product away. So a link is:
 *
 *   signed    — cannot be forged or guessed (HMAC, see utils/tokens.js)
 *   expiring  — dead after DOWNLOAD_TOKEN_TTL_HOURS
 *   counted   — dead after DOWNLOAD_MAX_USES
 *   revocable — killed immediately on refund or chargeback
 *   bound     — to one customer id, so it cannot be traded for another product
 *
 * And the countervailing concern, which matters just as much: a legitimate
 * customer who hits any of those limits must be able to get a new link in
 * seconds, without asking you. A locked-out paying customer costs you a refund
 * and a bad review; see `requestResend` and the self-serve route.
 */

const fs = require('fs');
const path = require('path');
const { config } = require('../config');
const logger = require('../utils/logger');
const { AppError, NotFoundError } = require('../utils/errors');
const customers = require('../models/customers');
const downloadTokens = require('../models/downloadTokens');
const events = require('../models/events');
const { TIERS } = require('./pricingService');

/**
 * Resolve which file a tier delivers.
 * Falls back to the Method ZIP if the Engine bundle has not been built, so a
 * missing optional artifact degrades to "customer gets the course" rather than
 * "customer gets an error".
 */
function resolveArtifactPath(tier) {
  const tierDefinition = TIERS[tier];
  if (!tierDefinition) throw new AppError('Unknown product tier.', 400, 'unknown_tier');

  const candidate = tierDefinition.deliverable === 'engineZip'
    ? config.delivery.engineZip
    : config.delivery.methodZip;

  if (fs.existsSync(candidate)) return candidate;

  if (candidate !== config.delivery.methodZip && fs.existsSync(config.delivery.methodZip)) {
    logger.warn('Engine bundle missing, falling back to Method bundle', { expected: candidate });
    return config.delivery.methodZip;
  }

  return null;
}

/** Is the deliverable actually on disk? Surfaced by the readiness probe. */
function checkArtifacts() {
  const method = fs.existsSync(config.delivery.methodZip);
  const engine = fs.existsSync(config.delivery.engineZip);

  return {
    ok: method, // Method is the minimum viable deliverable.
    method: { path: config.delivery.methodZip, exists: method, sizeBytes: method ? fs.statSync(config.delivery.methodZip).size : 0 },
    engine: { path: config.delivery.engineZip, exists: engine, sizeBytes: engine ? fs.statSync(config.delivery.engineZip).size : 0 },
  };
}

/**
 * Issue a download URL for a customer.
 * @returns {{url: string, token: string, expiresAt: Date}}
 */
function issueDownloadLink(customerId) {
  const customer = customers.findById(customerId);
  if (!customer) throw new NotFoundError('Customer not found.');

  // A refunded customer must not receive a working link.
  if (customer.status !== 'paid') {
    throw new AppError('This purchase has been refunded, so the download is no longer available.', 403, 'not_entitled');
  }

  const { token, expiresAt } = downloadTokens.issue(customerId);

  return {
    url: `${config.publicUrl}/api/download/${token}`,
    token,
    expiresAt,
  };
}

/**
 * Validate a token and stream the file.
 *
 * Streams rather than buffers: a 20 MB ZIP read into memory per concurrent
 * request is how a small server falls over during a launch spike.
 */
function serveDownload(token, res, { requestLog = logger } = {}) {
  const validation = downloadTokens.validate(token);

  if (!validation.valid) {
    events.record(events.EVENT_TYPES.DOWNLOAD_FAILED, { payload: { reason: validation.reason } });

    // Distinct, actionable messages — a customer whose link merely expired
    // needs to know it is fixable, not that they did something wrong.
    const responses = {
      expired: { status: 410, code: 'link_expired', message: 'This download link has expired. Request a new one below — it is free and instant.' },
      exhausted: { status: 410, code: 'link_exhausted', message: 'This link has been used the maximum number of times. Request a fresh one below.' },
      revoked: { status: 403, code: 'link_revoked', message: 'This download link is no longer active. If you believe this is a mistake, please contact support.' },
      unknown: { status: 404, code: 'link_unknown', message: 'We could not find this download link. Request a new one below.' },
      bad_signature: { status: 403, code: 'link_invalid', message: 'This download link is not valid.' },
      malformed: { status: 400, code: 'link_invalid', message: 'This download link is not valid.' },
    };

    const response = responses[validation.reason] || responses.malformed;
    requestLog.warn('Download rejected', { reason: validation.reason });
    throw new AppError(response.message, response.status, response.code);
  }

  const customer = customers.findById(validation.customerId);
  if (!customer) throw new NotFoundError('Customer record not found.');

  if (customer.status !== 'paid') {
    throw new AppError('This purchase has been refunded, so the download is no longer available.', 403, 'not_entitled');
  }

  const artifactPath = resolveArtifactPath(customer.tier);

  // The file is missing on the server. This is an operator problem, and the
  // customer must not be left thinking they did something wrong.
  if (!artifactPath) {
    requestLog.error('Deliverable missing on disk', {
      tier: customer.tier,
      expected: config.delivery.methodZip,
    });
    throw new AppError(
      'The course file is temporarily unavailable. This is our fault, not yours — we have been alerted and will email your download within the hour.',
      503,
      'artifact_unavailable'
    );
  }

  const stats = fs.statSync(artifactPath);
  const filename = `course-printer-${customer.tier}.zip`;

  // Count the use before streaming. Counting after means a client that
  // disconnects mid-download gets a free extra use, which is exploitable.
  downloadTokens.recordUse(validation.record.nonce);
  customers.recordDownload(customer.id);
  events.record(events.EVENT_TYPES.DOWNLOAD_STARTED, {
    customerId: customer.id,
    payload: { tier: customer.tier, use: validation.record.uses + 1 },
  });

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Length', stats.size);
  // `filename` is constructed from our own tier id, never from user input —
  // a customer-supplied filename here would be a header-injection vector.
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  // Never let a proxy or browser cache a file served against a one-time token.
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  const stream = fs.createReadStream(artifactPath);

  stream.on('error', (error) => {
    requestLog.error('Download stream failed', { error: error.message, customerId: customer.id });
    // Headers are already sent by this point, so the only honest thing left is
    // to destroy the connection — a truncated ZIP is worse than a failed one
    // because the customer sees a corrupt file rather than a clear error.
    res.destroy();
  });

  stream.pipe(res);

  requestLog.info('Download served', { customerId: customer.id, tier: customer.tier, sizeBytes: stats.size });
}

/**
 * Self-serve link resend.
 *
 * SECURITY NOTE ON THE RESPONSE: this endpoint returns the same success message
 * whether or not the address has a purchase. Otherwise it becomes an oracle
 * that tells anyone which email addresses bought from you — a customer list is
 * exactly what a competitor would like to enumerate.
 *
 * @returns {{found: boolean, customer: object|null, link: object|null}}
 */
function requestResend(email) {
  const customer = customers.findActiveByEmail(email);

  if (!customer) {
    logger.info('Resend requested for unknown or refunded address', { email });
    return { found: false, customer: null, link: null };
  }

  const link = issueDownloadLink(customer.id);
  return { found: true, customer, link };
}

/** Kill every link for a customer. Called on refund and dispute. */
function revokeAccess(customerId) {
  const revoked = downloadTokens.revokeAllForCustomer(customerId);
  logger.info('Download access revoked', { customerId, tokensRevoked: revoked });
  return revoked;
}

module.exports = {
  issueDownloadLink,
  serveDownload,
  requestResend,
  revokeAccess,
  checkArtifacts,
  resolveArtifactPath,
};
