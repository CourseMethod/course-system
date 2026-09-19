#!/usr/bin/env node
'use strict';

/**
 * Generate cryptographically strong secrets for .env.
 *
 *     npm run create-admin-token
 *
 * Use this rather than inventing a password. A hand-made "admin token" is
 * guessable, and this token is the key to every customer record you have.
 */

const crypto = require('crypto');

const adminToken = crypto.randomBytes(32).toString('hex');
const tokenSecret = crypto.randomBytes(32).toString('hex');

console.log(`
Generated secrets — paste these into your .env file
${'─'.repeat(64)}

ADMIN_TOKEN=${adminToken}

TOKEN_SECRET=${tokenSecret}

${'─'.repeat(64)}

  ADMIN_TOKEN    Password for the admin dashboard. Anyone with this can read
                 every customer email address and issue refunds. Store it in a
                 password manager. Never commit it, never paste it in a chat.

  TOKEN_SECRET   Signs download links. Changing it invalidates every
                 outstanding link, so customers mid-download would need a
                 resend. Rotate deliberately, not casually.

Both must be different from each other — they are above, and they are.
`);
