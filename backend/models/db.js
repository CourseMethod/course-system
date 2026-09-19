'use strict';

/**
 * Database connection and schema migrations.
 *
 * SQLite via better-sqlite3. That is a deliberate choice, not a placeholder:
 * a course business selling a few thousand units has a working set measured in
 * megabytes, and every query here is a point lookup or a small aggregate.
 * SQLite handles that with zero operational overhead, and `better-sqlite3` is
 * synchronous, which removes a whole category of race conditions from the
 * webhook path. When you outgrow it, see docs/Scaling-Guide.md — the model
 * layer below is the only thing that would need rewriting.
 *
 * SQL INJECTION: every statement in this codebase is a prepared statement with
 * bound parameters (`?`). There is no string concatenation of user input into
 * SQL anywhere, including in the admin filters, where values are bound and only
 * a whitelisted column name can reach an ORDER BY clause.
 */

const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { config } = require('../config');
const logger = require('../utils/logger');

let db;

/**
 * Ordered, append-only list of migrations.
 *
 * Rules:
 *   - Never edit a migration that has shipped. Add a new one.
 *   - Each runs exactly once, tracked in `schema_migrations`.
 *   - All of them run inside a single transaction, so a failed deploy leaves
 *     the schema untouched rather than half-applied.
 */
const MIGRATIONS = [
  {
    id: '001_initial_schema',
    up: (database) => {
      database.exec(`
        -- ------------------------------------------------------------------
        -- customers: one row per purchase.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS customers (
          id                   TEXT PRIMARY KEY,
          email                TEXT NOT NULL,
          tier                 TEXT NOT NULL,
          amount_cents         INTEGER NOT NULL,
          currency             TEXT NOT NULL DEFAULT 'usd',

          stripe_session_id    TEXT UNIQUE,
          stripe_payment_intent TEXT,
          stripe_customer_id   TEXT,

          -- paid | refunded | disputed
          status               TEXT NOT NULL DEFAULT 'paid',

          download_count       INTEGER NOT NULL DEFAULT 0,
          last_download_at     TEXT,

          -- Marketing attribution captured at checkout (see services/pricing).
          utm_source           TEXT,
          utm_medium           TEXT,
          utm_campaign         TEXT,
          referrer             TEXT,

          created_at           TEXT NOT NULL,
          updated_at           TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_customers_email      ON customers(email);
        CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at);
        CREATE INDEX IF NOT EXISTS idx_customers_status     ON customers(status);
        CREATE INDEX IF NOT EXISTS idx_customers_tier       ON customers(tier);

        -- ------------------------------------------------------------------
        -- events: the analytics funnel and the audit trail, in one table.
        -- Deliberately schemaless in the payload so adding a new tracked event
        -- never needs a migration.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS events (
          id          TEXT PRIMARY KEY,
          type        TEXT NOT NULL,
          customer_id TEXT,
          session_key TEXT,
          payload     TEXT,
          created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_events_type_created ON events(type, created_at);
        CREATE INDEX IF NOT EXISTS idx_events_customer     ON events(customer_id);
        CREATE INDEX IF NOT EXISTS idx_events_session      ON events(session_key);

        -- ------------------------------------------------------------------
        -- emails: what we sent, whether it was opened, and whether delivery
        -- ultimately succeeded. Answers "did they actually get it?" when a
        -- customer says the course never arrived.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS emails (
          id           TEXT PRIMARY KEY,
          customer_id  TEXT,
          recipient    TEXT NOT NULL,
          template     TEXT NOT NULL,
          subject      TEXT NOT NULL,

          -- queued | sent | failed
          status       TEXT NOT NULL DEFAULT 'queued',
          attempts     INTEGER NOT NULL DEFAULT 0,
          last_error   TEXT,

          opened_at    TEXT,
          open_count   INTEGER NOT NULL DEFAULT 0,
          clicked_at   TEXT,
          click_count  INTEGER NOT NULL DEFAULT 0,

          created_at   TEXT NOT NULL,
          sent_at      TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_emails_customer  ON emails(customer_id);
        CREATE INDEX IF NOT EXISTS idx_emails_status    ON emails(status);
        CREATE INDEX IF NOT EXISTS idx_emails_template  ON emails(template);
        CREATE INDEX IF NOT EXISTS idx_emails_recipient ON emails(recipient);

        -- ------------------------------------------------------------------
        -- download_tokens: issued links. The signature proves authenticity;
        -- this table enforces use limits and allows revocation after a refund.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS download_tokens (
          id          TEXT PRIMARY KEY,
          customer_id TEXT NOT NULL,
          nonce       TEXT NOT NULL UNIQUE,
          uses        INTEGER NOT NULL DEFAULT 0,
          max_uses    INTEGER NOT NULL,
          revoked     INTEGER NOT NULL DEFAULT 0,
          expires_at  TEXT NOT NULL,
          created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tokens_customer ON download_tokens(customer_id);
        CREATE INDEX IF NOT EXISTS idx_tokens_nonce    ON download_tokens(nonce);

        -- ------------------------------------------------------------------
        -- tickets: support requests and refund requests.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS tickets (
          id          TEXT PRIMARY KEY,
          reference   TEXT NOT NULL UNIQUE,
          customer_id TEXT,
          email       TEXT NOT NULL,

          -- support | refund | bug | question
          kind        TEXT NOT NULL DEFAULT 'support',
          subject     TEXT NOT NULL,
          message     TEXT NOT NULL,

          -- open | pending | resolved | closed
          status      TEXT NOT NULL DEFAULT 'open',
          priority    TEXT NOT NULL DEFAULT 'normal',

          internal_notes TEXT,
          resolved_at    TEXT,

          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_tickets_status  ON tickets(status);
        CREATE INDEX IF NOT EXISTS idx_tickets_email   ON tickets(email);
        CREATE INDEX IF NOT EXISTS idx_tickets_created ON tickets(created_at);

        -- ------------------------------------------------------------------
        -- testimonials: REAL customer results, collected with permission.
        --
        -- Nothing here is displayed publicly until you set approved = 1 by
        -- hand in the admin dashboard, and 'consent_to_publish' records that
        -- the customer actually agreed to be quoted. See docs/Marketing-
        -- Playbook.md for why this matters legally: publishing a testimonial
        -- you invented, or one you were not given permission to use, is a
        -- straightforward FTC violation.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS testimonials (
          id                 TEXT PRIMARY KEY,
          customer_id        TEXT,
          name               TEXT NOT NULL,
          email              TEXT NOT NULL,
          headline           TEXT,
          quote              TEXT NOT NULL,

          -- Their self-reported numbers. Treat as unverified until you have
          -- seen evidence; 'verified' records that you did.
          result_metric      TEXT,
          result_timeframe   TEXT,

          consent_to_publish INTEGER NOT NULL DEFAULT 0,
          verified           INTEGER NOT NULL DEFAULT 0,
          approved           INTEGER NOT NULL DEFAULT 0,
          display_order      INTEGER NOT NULL DEFAULT 100,

          created_at         TEXT NOT NULL,
          updated_at         TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON testimonials(approved, display_order);

        -- ------------------------------------------------------------------
        -- webhook_deliveries: idempotency + retry bookkeeping for Stripe.
        --
        -- Stripe retries webhooks. Without this table, a retried
        -- 'checkout.session.completed' would send the customer a second copy of
        -- their course and double-count the sale in your revenue numbers.
        -- ------------------------------------------------------------------
        CREATE TABLE IF NOT EXISTS webhook_deliveries (
          id            TEXT PRIMARY KEY,
          stripe_event_id TEXT NOT NULL UNIQUE,
          type          TEXT NOT NULL,

          -- received | processed | failed
          status        TEXT NOT NULL DEFAULT 'received',
          attempts      INTEGER NOT NULL DEFAULT 0,
          last_error    TEXT,
          payload       TEXT,

          created_at    TEXT NOT NULL,
          processed_at  TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_webhooks_status ON webhook_deliveries(status);
        CREATE INDEX IF NOT EXISTS idx_webhooks_event  ON webhook_deliveries(stripe_event_id);
      `);
    },
  },
];

/**
 * Open the database, apply PRAGMAs and run any pending migrations.
 * Safe to call more than once; subsequent calls return the same handle.
 */
function initDatabase() {
  if (db) return db;

  // Create the parent directory. On a fresh host this will not exist, and the
  // resulting SQLITE_CANTOPEN is otherwise a confusing first-run failure.
  const directory = path.dirname(config.database.path);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
    logger.info('Created database directory', { directory });
  }

  db = new Database(config.database.path);

  // WAL: readers do not block the writer. Without it, an admin dashboard query
  // running while a webhook writes can produce SQLITE_BUSY and drop a sale.
  db.pragma('journal_mode = WAL');
  // NORMAL is the right durability/speed trade-off under WAL; a crash can lose
  // the last transaction, and Stripe's webhook retry covers exactly that case.
  db.pragma('synchronous = NORMAL');
  db.pragma('foreign_keys = ON');
  // Wait rather than immediately erroring if another process holds the lock.
  db.pragma('busy_timeout = 5000');

  runMigrations(db);

  logger.info('Database ready', { path: config.database.path });
  return db;
}

function runMigrations(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id         TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);

  const applied = new Set(
    database.prepare('SELECT id FROM schema_migrations').all().map((row) => row.id)
  );

  const pending = MIGRATIONS.filter((m) => !applied.has(m.id));
  if (pending.length === 0) {
    logger.debug('No pending migrations');
    return;
  }

  const recordMigration = database.prepare(
    'INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)'
  );

  // One transaction for all pending migrations: either the deploy's schema
  // change lands completely or not at all.
  const applyAll = database.transaction(() => {
    for (const migration of pending) {
      logger.info(`Applying migration ${migration.id}`);
      migration.up(database);
      recordMigration.run(migration.id, new Date().toISOString());
    }
  });

  try {
    applyAll();
    logger.info(`Applied ${pending.length} migration(s)`);
  } catch (error) {
    logger.error('Migration failed — schema left unchanged', { error });
    throw error;
  }
}

function getDb() {
  if (!db) return initDatabase();
  return db;
}

function closeDatabase() {
  if (db) {
    // Fold the WAL back into the main file so a backup of the .db file alone
    // is complete.
    try { db.pragma('wal_checkpoint(TRUNCATE)'); } catch { /* best effort */ }
    db.close();
    db = undefined;
    logger.info('Database closed');
  }
}

/** ISO timestamp helper — every table stores times as ISO 8601 UTC strings. */
const now = () => new Date().toISOString();

module.exports = { initDatabase, getDb, closeDatabase, now };
