'use strict';

/**
 * Structured logger.
 *
 * Two output modes:
 *   - JSON (production): one object per line, so hosted log search works.
 *   - Pretty (development): readable, colourised, aligned.
 *
 * The important part is `redact()`. Logs leak secrets more often than any other
 * channel — a Stripe key in an error object gets shipped to a log aggregator,
 * sits there forever, and is readable by anyone with dashboard access. Every
 * value logged passes through redaction on key name AND on value shape, so a
 * secret caught in an unexpected field still gets masked.
 */

const { config } = require('../config');

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const activeLevel = LEVELS[config.logging.level] ?? LEVELS.info;

const COLOURS = {
  error: '\x1b[31m',
  warn: '\x1b[33m',
  info: '\x1b[36m',
  debug: '\x1b[90m',
  reset: '\x1b[0m',
  dim: '\x1b[2m',
};

/** Field names whose values are always masked, matched case-insensitively. */
const SENSITIVE_KEYS = [
  'password', 'pass', 'secret', 'token', 'apikey', 'api_key', 'authorization',
  'auth', 'cookie', 'stripe_signature', 'signature', 'card', 'cvc', 'cvv',
  'accountnumber', 'ssn', 'adminToken', 'tokenSecret',
];

/** Value shapes that are secrets no matter what field they arrived in. */
const SENSITIVE_VALUE_PATTERNS = [
  /\bsk_(test|live)_[A-Za-z0-9]+/g,   // Stripe secret keys
  /\bwhsec_[A-Za-z0-9]+/g,            // Stripe webhook secrets
  /\brk_(test|live)_[A-Za-z0-9]+/g,   // Stripe restricted keys
  /\bBearer\s+[A-Za-z0-9._\-]+/gi,    // Bearer tokens
];

function maskString(value) {
  let out = value;
  for (const pattern of SENSITIVE_VALUE_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}

/**
 * Deep-clone a value with secrets masked. Handles cycles, Errors, Buffers and
 * deeply nested objects without blowing the stack.
 */
function redact(value, seen = new WeakSet(), depth = 0) {
  if (depth > 8) return '[depth limit]';
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') return maskString(value);
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'function') return '[function]';

  if (value instanceof Error) {
    return {
      name: value.name,
      message: maskString(value.message),
      // Stack traces are noise at info level but essential for errors.
      stack: config.isProduction ? undefined : maskString(value.stack || ''),
      ...(value.code ? { code: value.code } : {}),
      ...(value.statusCode ? { statusCode: value.statusCode } : {}),
    };
  }

  if (Buffer.isBuffer(value)) return `[buffer ${value.length}b]`;
  if (value instanceof Date) return value.toISOString();

  if (typeof value === 'object') {
    if (seen.has(value)) return '[circular]';
    seen.add(value);

    if (Array.isArray(value)) {
      return value.slice(0, 50).map((item) => redact(item, seen, depth + 1));
    }

    const out = {};
    for (const [key, val] of Object.entries(value)) {
      const isSensitive = SENSITIVE_KEYS.some((s) => key.toLowerCase().includes(s));
      out[key] = isSensitive ? '[redacted]' : redact(val, seen, depth + 1);
    }
    return out;
  }

  return String(value);
}

function emit(level, message, meta) {
  if (LEVELS[level] > activeLevel) return;

  const safeMeta = meta ? redact(meta) : undefined;
  const timestamp = new Date().toISOString();

  if (config.logging.json) {
    const line = JSON.stringify({ ts: timestamp, level, msg: maskString(String(message)), ...(safeMeta ? { meta: safeMeta } : {}) });
    process[level === 'error' ? 'stderr' : 'stdout'].write(line + '\n');
    return;
  }

  const colour = COLOURS[level] || '';
  const label = level.toUpperCase().padEnd(5);
  const time = timestamp.slice(11, 23);
  let line = `${COLOURS.dim}${time}${COLOURS.reset} ${colour}${label}${COLOURS.reset} ${maskString(String(message))}`;

  if (safeMeta && Object.keys(safeMeta).length > 0) {
    line += ` ${COLOURS.dim}${JSON.stringify(safeMeta)}${COLOURS.reset}`;
  }

  process[level === 'error' ? 'stderr' : 'stdout'].write(line + '\n');
}

const logger = {
  error: (message, meta) => emit('error', message, meta),
  warn: (message, meta) => emit('warn', message, meta),
  info: (message, meta) => emit('info', message, meta),
  debug: (message, meta) => emit('debug', message, meta),

  /**
   * Returns a logger that stamps every line with the same fields — used to
   * attach a request id so you can follow one customer's journey through the
   * logs when they email you saying something broke.
   */
  child(bindings) {
    return {
      error: (m, meta) => emit('error', m, { ...bindings, ...meta }),
      warn: (m, meta) => emit('warn', m, { ...bindings, ...meta }),
      info: (m, meta) => emit('info', m, { ...bindings, ...meta }),
      debug: (m, meta) => emit('debug', m, { ...bindings, ...meta }),
      child(more) { return logger.child({ ...bindings, ...more }); },
    };
  },

  redact,
};

module.exports = logger;
