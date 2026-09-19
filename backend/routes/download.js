'use strict';

/**
 * Course download and self-serve link resend.
 */

const express = require('express');
const { asyncHandler } = require('../utils/errors');
const validate = require('../utils/validate');
const rateLimiters = require('../middleware/rateLimit');
const deliveryService = require('../services/deliveryService');
const emailService = require('../services/emailService');
const pricing = require('../services/pricingService');

const router = express.Router();

/**
 * GET /api/download/:token
 *
 * Streams the ZIP. All authorisation logic lives in deliveryService — this
 * route is intentionally thin so there is exactly one place where entitlement
 * is decided.
 */
router.get('/download/:token', rateLimiters.download, asyncHandler(async (req, res) => {
  const token = req.params.token;

  // Bound the input before it reaches crypto. An 8 MB "token" should be
  // rejected by shape, not by HMAC.
  if (typeof token !== 'string' || token.length < 10 || token.length > 4096) {
    return res.status(400).json({
      error: { code: 'link_invalid', message: 'This download link is not valid.' },
      requestId: req.id,
    });
  }

  // Throws AppError on any entitlement failure; the error middleware renders it.
  deliveryService.serveDownload(token, res, { requestLog: req.log });
}));

/**
 * POST /api/download/resend
 * Body: { email }
 *
 * Lets a customer recover their own download without waiting for you. This
 * single endpoint removes the most common support request in the business.
 *
 * SECURITY: the response is identical whether or not the address has a
 * purchase. Returning "no purchase found" would turn this into a free tool for
 * enumerating your customer list.
 */
router.post('/download/resend', rateLimiters.submission, asyncHandler(async (req, res) => {
  const { email } = validate.collect({
    email: validate.email(req.body?.email),
  });

  const result = deliveryService.requestResend(email);

  if (result.found) {
    await emailService.send('download_resend', {
      to: email,
      customerId: result.customer.id,
      context: {
        tierName: pricing.TIERS[result.customer.tier]?.name || result.customer.tier,
        downloadUrl: result.link.url,
        expiresAt: result.link.expiresAt,
      },
    });
    req.log.info('Download link resent', { customerId: result.customer.id });
  } else {
    req.log.info('Resend requested for address with no active purchase');
  }

  // Same response either way. Deliberate.
  res.json({
    ok: true,
    message: 'If that email address has a purchase with us, a fresh download link is on its way. It usually arrives within a minute — check your spam folder if it does not.',
  });
}));

module.exports = router;
