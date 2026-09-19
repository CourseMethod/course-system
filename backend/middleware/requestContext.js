'use strict';

/**
 * Attaches a request id and a scoped logger to every request, then logs the
 * completed request once.
 *
 * The request id is the thread you pull when a customer emails you. It goes in
 * the response headers and in every log line for that request, so "customer
 * says checkout failed at 14:32" becomes a single log search rather than an
 * archaeology project.
 */

const { randomId } = require('../utils/tokens');
const logger = require('../utils/logger');

/** Paths we do not log at info level — health checks would drown everything else. */
const QUIET_PATHS = new Set(['/api/health', '/api/health/live', '/api/health/ready', '/favicon.ico']);

function requestContext(req, res, next) {
  const startedAt = process.hrtime.bigint();

  // Honour an upstream id if the platform set one, so traces stitch together
  // across a proxy; otherwise mint our own.
  req.id = req.get('x-request-id') || randomId(8);
  res.set('X-Request-Id', req.id);

  req.log = logger.child({ requestId: req.id });

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;

    const meta = {
      method: req.method,
      path: req.originalUrl.split('?')[0], // query strings can carry tokens
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10,
      ip: req.ip,
    };

    if (res.statusCode >= 500) {
      req.log.error('Request failed', meta);
    } else if (res.statusCode >= 400) {
      req.log.warn('Request rejected', meta);
    } else if (QUIET_PATHS.has(meta.path)) {
      req.log.debug('Request', meta);
    } else {
      req.log.info('Request', meta);
    }
  });

  next();
}

module.exports = requestContext;
