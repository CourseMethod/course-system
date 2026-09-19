'use strict';

/**
 * Error types.
 *
 * The distinction that matters: `AppError` is an error we anticipated and whose
 * message is safe to show a customer. Anything else is a bug, and its message
 * must never reach the browser — internal messages leak table names, file paths
 * and library internals that help an attacker and confuse a customer.
 *
 * The error handler middleware relies on `isOperational` to decide which of the
 * two it is looking at.
 */

class AppError extends Error {
  /**
   * @param {string} message  Safe to display to the end user.
   * @param {number} statusCode  HTTP status.
   * @param {string} code  Stable machine-readable code for the frontend.
   * @param {object} [details]  Extra context for logs (never sent to client).
   */
  constructor(message, statusCode = 500, code = 'internal_error', details = undefined) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  /** @param {Array<{field: string, message: string}>} issues */
  constructor(issues, message = 'Some of the information provided is not valid.') {
    super(message, 400, 'validation_error');
    this.issues = issues;
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required.') {
    super(message, 401, 'unauthorized');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this.') {
    super(message, 403, 'forbidden');
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Not found.') {
    super(message, 404, 'not_found');
  }
}

class ConflictError extends AppError {
  constructor(message = 'That conflicts with the current state.') {
    super(message, 409, 'conflict');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(message, 429, 'rate_limited');
  }
}

/** A dependency we do not control (Stripe, SMTP) failed. */
class UpstreamError extends AppError {
  constructor(service, originalError) {
    super(
      'A service we depend on is temporarily unavailable. Your card has not been charged. Please try again in a moment.',
      502,
      'upstream_error',
      { service, original: originalError?.message }
    );
    this.service = service;
    this.originalError = originalError;
  }
}

/**
 * Wraps an async Express handler so a rejected promise reaches the error
 * middleware instead of becoming an unhandled rejection that silently hangs the
 * request until the client times out.
 *
 *   router.post('/x', asyncHandler(async (req, res) => { ... }));
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  UpstreamError,
  asyncHandler,
};
