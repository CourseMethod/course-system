'use strict';

/**
 * Email open and click tracking.
 *
 * Both endpoints are unauthenticated by necessity — they are hit by mail
 * clients, not by logged-in users. That makes them the most exposed surface in
 * the app, so both are written defensively: they never throw, never reveal
 * whether an id exists, and the click tracker refuses to redirect anywhere it
 * has not been told is safe.
 */

const express = require('express');
const emailModel = require('../models/emails');
const events = require('../models/events');
const { config } = require('../config');

const router = express.Router();

/**
 * A 1x1 transparent GIF, 43 bytes, inline so there is no file to deploy and no
 * disk read per open.
 */
const PIXEL = Buffer.from(
  'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
  'base64'
);

/**
 * GET /api/track/open/:emailId.gif
 *
 * ACCURACY CAVEAT, because decisions get made on this number: Apple Mail
 * Privacy Protection pre-fetches images for every message, and most corporate
 * gateways scan them. Both register as opens nobody performed. Depending on
 * your audience, 20-60% of recorded opens may be machines. Use this as a
 * relative trend between campaigns, never as an absolute. Click tracking below
 * is far more trustworthy.
 */
router.get('/track/open/:emailId.gif', (req, res) => {
  // Always return the pixel, whatever happens. A broken image in a customer's
  // email is a visible defect; a failed tracking write is not.
  const send = () => {
    res.set({
      'Content-Type': 'image/gif',
      'Content-Length': PIXEL.length,
      // Without no-store, the client caches the pixel and the second open is
      // never recorded.
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(PIXEL);
  };

  try {
    const emailId = req.params.emailId;
    if (typeof emailId === 'string' && /^[a-f0-9]{16,64}$/.test(emailId)) {
      const record = emailModel.findById(emailId);
      if (record) {
        emailModel.recordOpen(emailId);
        events.record(events.EVENT_TYPES.EMAIL_OPENED, {
          customerId: record.customer_id,
          payload: { template: record.template, emailId },
        });
      }
    }
  } catch (error) {
    req.log?.warn('Open tracking failed', { error: error.message });
  }

  send();
});

/**
 * GET /api/track/click/:emailId?url=...
 *
 * OPEN REDIRECT PREVENTION — the important part of this file.
 *
 * A naive implementation redirects to whatever `url` says. That hands an
 * attacker a link on YOUR domain that forwards to their phishing page, which is
 * exactly the credibility they need. Your domain then gets flagged by Safe
 * Browsing and your delivery emails stop arriving.
 *
 * So the destination must be on an allow-list: your own site, or one of a small
 * set of hosts the emails legitimately link to. Anything else is dropped and
 * the visitor goes to your homepage.
 */
const ALLOWED_REDIRECT_HOSTS = new Set([
  'obsidian.md',
  'www.obsidian.md',
  'claude.ai',
  'stripe.com',
  'dashboard.stripe.com',
]);

function isSafeRedirect(target) {
  let parsed;
  try {
    parsed = new URL(target);
  } catch {
    return false;
  }

  // Blocks javascript:, data:, file: and friends.
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  // Always allow our own origin, including subpaths.
  try {
    const ownHost = new URL(config.publicUrl).hostname;
    if (parsed.hostname === ownHost) return true;
  } catch { /* fall through to the allow-list */ }

  return ALLOWED_REDIRECT_HOSTS.has(parsed.hostname);
}

router.get('/track/click/:emailId', (req, res) => {
  const fallback = config.publicUrl;
  const target = typeof req.query.url === 'string' ? req.query.url : '';

  try {
    const emailId = req.params.emailId;
    if (typeof emailId === 'string' && /^[a-f0-9]{16,64}$/.test(emailId)) {
      const record = emailModel.findById(emailId);
      if (record) {
        emailModel.recordClick(emailId);
        events.record(events.EVENT_TYPES.EMAIL_CLICKED, {
          customerId: record.customer_id,
          payload: { template: record.template, emailId, target: target.slice(0, 200) },
        });
      }
    }
  } catch (error) {
    req.log?.warn('Click tracking failed', { error: error.message });
  }

  if (target && isSafeRedirect(target)) {
    return res.redirect(302, target);
  }

  if (target) {
    req.log?.warn('Blocked unsafe redirect target', { target: target.slice(0, 200) });
  }
  return res.redirect(302, fallback);
});

module.exports = router;
