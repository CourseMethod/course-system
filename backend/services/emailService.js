'use strict';

/**
 * Email sending, with retries, tracking and a full audit trail.
 *
 * Every send is recorded in the `emails` table BEFORE the attempt, so a crash
 * mid-send leaves evidence rather than a silent gap. That record is what lets
 * you answer "did this customer actually receive their course?" with a fact
 * instead of a shrug.
 */

const nodemailer = require('nodemailer');
const { config } = require('../config');
const logger = require('../utils/logger');
const { withRetry } = require('../utils/retry');
const emailModel = require('../models/emails');
const events = require('../models/events');
const { TEMPLATES } = require('../templates');

let transporter;

/**
 * Build the nodemailer transport.
 *
 * The `console` transport is a real transport, not a no-op: it prints the
 * rendered email to the log so you can read and click-test it in development
 * without any mail provider set up at all.
 */
function getTransporter() {
  if (transporter) return transporter;

  switch (config.email.transport) {
    case 'smtp':
      transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port,
        secure: config.email.smtp.secure, // true for 465, false for 587 + STARTTLS
        auth: { user: config.email.smtp.user, pass: config.email.smtp.password },
        // Pool connections: sending several emails should not mean several
        // TCP+TLS handshakes.
        pool: true,
        maxConnections: 3,
        maxMessages: 100,
        connectionTimeout: 10_000,
        greetingTimeout: 10_000,
        socketTimeout: 20_000,
      });
      break;

    case 'gmail':
      transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: config.email.gmail.user, pass: config.email.gmail.appPassword },
        pool: true,
        maxConnections: 1, // Gmail is strict about concurrency
      });
      break;

    case 'console':
    default:
      transporter = {
        async sendMail(message) {
          logger.info('─── EMAIL (console transport — not actually sent) ───');
          logger.info(`To:      ${message.to}`);
          logger.info(`From:    ${message.from}`);
          logger.info(`Subject: ${message.subject}`);
          logger.info(`\n${message.text}\n`);
          logger.info('─────────────────────────────────────────────────────');
          return { messageId: `console-${Date.now()}`, accepted: [message.to] };
        },
        async verify() { return true; },
        close() {},
      };
      break;
  }

  return transporter;
}

/**
 * Verify the transport at boot so a broken mail configuration is a loud startup
 * warning rather than a silent failure discovered when a customer complains.
 * Never throws — email being down must not stop the server taking payments.
 */
async function verifyTransport() {
  try {
    await getTransporter().verify();
    logger.info(`Email transport ready (${config.email.transport})`);
    return true;
  } catch (error) {
    logger.error(
      `Email transport FAILED to verify (${config.email.transport}). ` +
      'Purchases will still be recorded and you can resend from the admin dashboard, ' +
      'but customers will not receive delivery emails until this is fixed.',
      { error: error.message }
    );
    return false;
  }
}

/** URL for the 1x1 open-tracking pixel. */
function trackingPixelUrl(emailId) {
  return `${config.publicUrl}/api/track/open/${emailId}.gif`;
}

/**
 * Rewrite outbound links through the click tracker.
 *
 * Only http(s) links in href attributes are rewritten, and the destination is
 * URL-encoded so a link containing `&` survives the round trip. The tracker
 * validates the destination before redirecting (see routes/tracking.js) — an
 * open redirect here would be a phishing gift.
 */
function addClickTracking(html, emailId) {
  return html.replace(
    /href="(https?:\/\/[^"]+)"/g,
    (match, url) => {
      // Never rewrite the tracking pixel or unsubscribe links.
      if (url.includes('/api/track/')) return match;
      const encoded = encodeURIComponent(url);
      return `href="${config.publicUrl}/api/track/click/${emailId}?url=${encoded}"`;
    }
  );
}

/**
 * Render and send a template.
 *
 * @param {string} templateName  Key in TEMPLATES.
 * @param {object} options
 * @param {string} options.to
 * @param {object} options.context      Passed to the template function.
 * @param {string} [options.customerId]
 * @param {boolean} [options.track=true]
 * @returns {Promise<{sent: boolean, emailId: string, error?: string}>}
 */
async function send(templateName, { to, context = {}, customerId = null, track = true }) {
  const template = TEMPLATES[templateName];
  if (!template) {
    throw new Error(`Unknown email template: ${templateName}`);
  }

  // Render once without tracking so we can get the subject for the record.
  const preliminary = template({ ...context, supportEmail: config.email.supportEmail });
  const emailId = emailModel.create({
    customerId,
    recipient: to,
    template: templateName,
    subject: preliminary.subject,
  });

  // Re-render with the tracking pixel now that we have an id to track against.
  const rendered = track
    ? template({
        ...context,
        supportEmail: config.email.supportEmail,
        trackingPixelUrl: trackingPixelUrl(emailId),
      })
    : preliminary;

  const html = track ? addClickTracking(rendered.html, emailId) : rendered.html;

  const message = {
    from: config.email.from,
    to,
    subject: rendered.subject,
    // Both parts, always. HTML-only email is a strong spam signal.
    text: rendered.text,
    html,
    headers: {
      // Lets Gmail and Outlook show a native unsubscribe control, which keeps
      // people from using the spam button to achieve the same thing — and spam
      // complaints are what destroy domain reputation.
      'List-Unsubscribe': `<mailto:${config.email.supportEmail}?subject=unsubscribe>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  };

  try {
    await withRetry(() => getTransporter().sendMail(message), {
      retries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 15_000,
      label: `email:${templateName}`,
    });

    emailModel.markSent(emailId);
    events.record(events.EVENT_TYPES.EMAIL_SENT, { customerId, payload: { template: templateName, emailId } });
    logger.info('Email sent', { template: templateName, to, emailId, customerId });

    return { sent: true, emailId };
  } catch (error) {
    emailModel.markFailed(emailId, error.message);

    // Logged loudly but NOT re-thrown. The caller is usually the Stripe webhook,
    // and failing the webhook because SMTP is down would make Stripe retry the
    // whole payment event — potentially duplicating work — when the payment
    // itself was completely fine. The failure is visible in the admin dashboard
    // and the email can be resent from there.
    logger.error('Email send FAILED', {
      template: templateName, to, emailId, customerId, error: error.message,
    });

    return { sent: false, emailId, error: error.message };
  }
}

/** Notify the operator. Best effort — never blocks or throws. */
async function notifyAdmin(title, lines) {
  try {
    await send('admin_alert', {
      to: config.email.supportEmail,
      context: { title, lines },
      track: false,
    });
  } catch (error) {
    logger.warn('Admin notification failed', { error: error.message });
  }
}

function closeTransport() {
  if (transporter?.close) {
    transporter.close();
    transporter = undefined;
  }
}

module.exports = { send, notifyAdmin, verifyTransport, closeTransport, trackingPixelUrl };
