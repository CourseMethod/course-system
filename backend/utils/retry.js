'use strict';

/**
 * Retry with exponential backoff and full jitter.
 *
 * Used for anything crossing the network that can fail transiently: sending
 * email, calling Stripe. The jitter matters — if ten webhook deliveries fail at
 * the same instant and all retry on the same fixed schedule, they hammer the
 * recovering service in lockstep and knock it over again.
 */

const logger = require('./logger');

/** Errors worth retrying. Anything else is a bug or a permanent rejection. */
function isRetryable(error) {
  if (!error) return false;

  // Network-level failures.
  const retryableCodes = [
    'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND',
    'EAI_AGAIN', 'EPIPE', 'ESOCKETTIMEDOUT', 'ECONNABORTED',
  ];
  if (retryableCodes.includes(error.code)) return true;

  // Stripe and most HTTP APIs: 429 and 5xx are transient, 4xx is not.
  // Retrying a 400 just means making the same mistake more slowly.
  const status = error.statusCode || error.status;
  if (status === 429) return true;
  if (status >= 500 && status < 600) return true;

  // Stripe SDK-specific transient types.
  if (error.type === 'StripeConnectionError' || error.type === 'StripeAPIError') return true;

  // Nodemailer transient SMTP responses (4xx in SMTP terms).
  if (error.responseCode && error.responseCode >= 400 && error.responseCode < 500) return true;

  return false;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {() => Promise<any>} operation
 * @param {object} [options]
 * @param {number} [options.retries=3]     Attempts AFTER the first one.
 * @param {number} [options.baseDelayMs=300]
 * @param {number} [options.maxDelayMs=10000]
 * @param {string} [options.label='operation']  Shows up in logs.
 * @param {(e: Error) => boolean} [options.shouldRetry]
 */
async function withRetry(operation, options = {}) {
  const {
    retries = 3,
    baseDelayMs = 300,
    maxDelayMs = 10_000,
    label = 'operation',
    shouldRetry = isRetryable,
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await operation(attempt);
    } catch (error) {
      lastError = error;

      const canRetry = attempt < retries && shouldRetry(error);
      if (!canRetry) {
        if (attempt > 0) {
          logger.warn(`${label} failed permanently after ${attempt + 1} attempt(s)`, { error });
        }
        throw error;
      }

      // Exponential backoff with full jitter: random between 0 and the cap.
      const cap = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const delay = Math.floor(Math.random() * cap);

      logger.warn(`${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${delay}ms`, {
        error: error.message,
        code: error.code,
      });

      await sleep(delay);
    }
  }

  throw lastError;
}

module.exports = { withRetry, isRetryable, sleep };
