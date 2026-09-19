'use strict';

/**
 * Signed, self-describing tokens for download links and email tracking.
 *
 * Why not random opaque IDs in the database? We use both, actually — the token
 * carries a signed payload AND we record it in the database. The signature lets
 * us reject forged links without a database round trip, and the database record
 * lets us enforce use counts and revoke a link after a refund.
 *
 * Format:  base64url(payloadJSON).base64url(hmacSHA256)
 *
 * This is deliberately not a JWT. A JWT here would mean pulling in a library,
 * handling `alg: none` attacks, and explaining header/claim semantics for what
 * is a 3-field payload. The verification below is short enough to audit by eye.
 */

const crypto = require('crypto');
const { config } = require('../config');

/** Base64url encode without padding (URL-safe, no %-escaping needed). */
function b64url(buffer) {
  return Buffer.from(buffer).toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function b64urlDecode(text) {
  const padded = text.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(padded, 'base64');
}

function sign(payloadBuffer) {
  return crypto.createHmac('sha256', config.security.tokenSecret).update(payloadBuffer).digest();
}

/**
 * Create a signed token.
 *
 * @param {object} payload  Arbitrary JSON-serialisable claims.
 * @param {number} ttlSeconds  Lifetime. Stored inside the payload as `exp`.
 * @returns {string}
 */
function createToken(payload, ttlSeconds) {
  const body = {
    ...payload,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    // Random nonce so two tokens with identical claims are still distinct,
    // which matters for per-token use counting.
    nonce: crypto.randomBytes(8).toString('hex'),
  };

  const payloadBuffer = Buffer.from(JSON.stringify(body), 'utf8');
  return `${b64url(payloadBuffer)}.${b64url(sign(payloadBuffer))}`;
}

/**
 * Verify and decode a token.
 *
 * @returns {{valid: true, payload: object} | {valid: false, reason: string}}
 */
function verifyToken(token) {
  if (typeof token !== 'string' || token.length === 0 || token.length > 4096) {
    return { valid: false, reason: 'malformed' };
  }

  const parts = token.split('.');
  if (parts.length !== 2) return { valid: false, reason: 'malformed' };

  const [payloadPart, signaturePart] = parts;

  let payloadBuffer;
  let providedSignature;
  try {
    payloadBuffer = b64urlDecode(payloadPart);
    providedSignature = b64urlDecode(signaturePart);
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  const expectedSignature = sign(payloadBuffer);

  // Length check first: timingSafeEqual throws on length mismatch, and the
  // length of a signature is not secret.
  if (providedSignature.length !== expectedSignature.length) {
    return { valid: false, reason: 'bad_signature' };
  }
  // Constant-time compare so an attacker cannot recover the signature byte by
  // byte from response timing.
  if (!crypto.timingSafeEqual(providedSignature, expectedSignature)) {
    return { valid: false, reason: 'bad_signature' };
  }

  let payload;
  try {
    payload = JSON.parse(payloadBuffer.toString('utf8'));
  } catch {
    return { valid: false, reason: 'malformed' };
  }

  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
    return { valid: false, reason: 'expired' };
  }

  return { valid: true, payload };
}

/** Random identifier for database primary keys and ticket references. */
function randomId(bytes = 16) {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Short, human-friendly reference for support tickets — the kind of thing a
 * customer can read out in an email without transcription errors. Excludes
 * easily confused characters (0/O, 1/I/L).
 */
function humanReference(prefix = 'CP') {
  const alphabet = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return `${prefix}-${out.slice(0, 4)}-${out.slice(4)}`;
}

/**
 * Constant-time string comparison for secrets supplied by a caller (e.g. the
 * admin bearer token). Never use `===` for this.
 */
function safeCompare(a, b) {
  const bufferA = Buffer.from(String(a), 'utf8');
  const bufferB = Buffer.from(String(b), 'utf8');
  if (bufferA.length !== bufferB.length) return false;
  return crypto.timingSafeEqual(bufferA, bufferB);
}

module.exports = { createToken, verifyToken, randomId, humanReference, safeCompare };
