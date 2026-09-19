'use strict';

/**
 * Centralised error handling.
 *
 * The governing rule: a customer sees a message that helps them, and an
 * attacker learns nothing. Internal error text — SQL fragments, file paths,
 * library stack traces — never crosses the wire. Operational errors we raised
 * on purpose (AppError) carry customer-safe messages and are passed through;
 * everything else becomes a generic 500 with a request id the customer can
 * quote to you.
 */

const { AppError, ValidationError, NotFoundError } = require('../utils/errors');
const { config } = require('../config');
const logger = require('../utils/logger');

/** 404 handler — must be registered after all routes. */
function notFound(req, res, next) {
  next(new NotFoundError(`No route matches ${req.method} ${req.originalUrl.split('?')[0]}`));
}

/**
 * Translate a Stripe SDK error into something a customer can act on.
 * Stripe's raw messages are developer-facing and sometimes alarming
 * ("Your card was declined: insufficient_funds") in ways that are fine, and
 * sometimes leak integration detail in ways that are not.
 */
function describeStripeError(error) {
  switch (error.type) {
    case 'StripeCardError':
      // Safe and genuinely useful — this is the customer's own card telling
      // them something. Stripe writes these for end users.
      return { status: 402, code: 'card_declined', message: error.message || 'Your card was declined. Please try a different payment method.' };
    case 'StripeRateLimitError':
      return { status: 429, code: 'rate_limited', message: 'We are getting a lot of requests right now. Please try again in a moment.' };
    case 'StripeInvalidRequestError':
      // Our bug, not theirs. Do not echo the message.
      return { status: 500, code: 'internal_error', message: 'Something went wrong setting up your checkout. Your card has not been charged.' };
    case 'StripeAPIError':
    case 'StripeConnectionError':
      return { status: 502, code: 'upstream_error', message: 'Our payment provider is temporarily unreachable. Your card has not been charged. Please try again shortly.' };
    case 'StripeAuthenticationError':
      // Our keys are wrong. Catastrophic for us, meaningless to the customer.
      return { status: 500, code: 'internal_error', message: 'Checkout is temporarily unavailable. Please try again in a few minutes.' };
    default:
      return null;
  }
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity
function errorHandler(error, req, res, next) {
  const log = req.log || logger;

  // --- Validation ---------------------------------------------------------
  if (error instanceof ValidationError) {
    log.warn('Validation failed', { issues: error.issues, path: req.path });
    return res.status(400).json({
      error: { code: error.code, message: error.message, issues: error.issues },
      requestId: req.id,
    });
  }

  // --- Malformed JSON body ------------------------------------------------
  // express.json() throws a SyntaxError with `body` attached. Without this
  // branch it surfaces as an opaque 500 on what is really a client mistake.
  if (error instanceof SyntaxError && 'body' in error) {
    log.warn('Malformed JSON body', { path: req.path });
    return res.status(400).json({
      error: { code: 'malformed_json', message: 'The request body was not valid JSON.' },
      requestId: req.id,
    });
  }

  // --- Payload too large --------------------------------------------------
  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: { code: 'payload_too_large', message: 'That request was too large.' },
      requestId: req.id,
    });
  }

  // --- Stripe -------------------------------------------------------------
  if (error.type && String(error.type).startsWith('Stripe')) {
    const described = describeStripeError(error);
    if (described) {
      const level = described.status >= 500 ? 'error' : 'warn';
      log[level]('Stripe error', { type: error.type, code: error.code, message: error.message, path: req.path });
      return res.status(described.status).json({
        error: { code: described.code, message: described.message },
        requestId: req.id,
      });
    }
  }

  // --- Errors we raised on purpose ----------------------------------------
  if (error instanceof AppError && error.isOperational) {
    const level = error.statusCode >= 500 ? 'error' : 'warn';
    log[level](`Handled error: ${error.message}`, {
      code: error.code,
      statusCode: error.statusCode,
      details: error.details,
      path: req.path,
    });

    return res.status(error.statusCode).json({
      error: { code: error.code, message: error.message },
      requestId: req.id,
    });
  }

  // --- Anything else is a bug --------------------------------------------
  // Full detail to the logs, nothing useful to the client.
  log.error('Unhandled error', { error, path: req.path, method: req.method });

  return res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong on our end. If you were making a purchase, your card has not been charged. Please try again, or contact support with the reference below.',
      // Only in development, and only the message — never the stack, which can
      // contain file paths and environment detail.
      ...(config.isProduction ? {} : { debug: error.message }),
    },
    requestId: req.id,
  });
}

module.exports = { errorHandler, notFound };
