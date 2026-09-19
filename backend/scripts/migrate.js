#!/usr/bin/env node
'use strict';

/**
 * Apply pending database migrations without starting the server.
 *
 *     npm run migrate
 *
 * The server does this automatically at boot, so you rarely need it. It exists
 * for platforms with a separate release phase, and for checking what a deploy
 * would change before it changes it.
 */

const { initDatabase, closeDatabase } = require('../models/db');
const { config, validateOrExit } = require('../config');

validateOrExit();

console.log(`\nApplying migrations to ${config.database.path}\n`);

try {
  initDatabase();
  console.log('\nSchema is up to date.\n');
  closeDatabase();
  process.exit(0);
} catch (error) {
  console.error(`\nMigration failed: ${error.message}`);
  console.error('The schema was left unchanged.\n');
  process.exit(1);
}
