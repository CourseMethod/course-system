#!/usr/bin/env node
'use strict';

/**
 * Package the course vault into the ZIP customers download.
 *
 *     npm run build-vault
 *
 * Uses the system `zip` command, which exists on macOS and Linux. On Windows,
 * use WSL, or right-click the vault folder and "Send to → Compressed folder",
 * then move the result to backend/dist/course-printer-vault.zip.
 *
 * Two bundles are produced:
 *   course-printer-vault.zip   the vault alone            (The Method)
 *   course-printer-engine.zip  vault + web + backend      (The Engine)
 *
 * The Engine bundle deliberately excludes .env, node_modules, the database and
 * the dist folder. Shipping your own .env to a customer would hand them your
 * live Stripe secret key — the exclusion list below is a security control, not
 * housekeeping.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const backendDir = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendDir, '..');
const distDir = path.join(backendDir, 'dist');

const methodZip = path.join(distDir, 'course-printer-vault.zip');
const engineZip = path.join(distDir, 'course-printer-engine.zip');

/**
 * Never include these in a customer bundle. Ordered roughly by how bad it would
 * be to ship them.
 */
const EXCLUDES = [
  '*.env',            // live Stripe secret key, admin token
  '*/.env',
  '.env*',
  '*/node_modules/*', // huge, and platform-specific
  'node_modules/*',
  '*/data/*',         // your customer database
  'data/*',
  '*/dist/*',         // the ZIPs themselves — recursive nesting
  'dist/*',
  '*.db', '*.db-wal', '*.db-shm',
  '*/.git/*', '.git/*',
  '*.DS_Store',
  '*/.claude/*',
  '*.log',
];

function ensureZipAvailable() {
  try {
    execFileSync('zip', ['-v'], { stdio: 'ignore' });
  } catch {
    console.error(`
The 'zip' command is not available.

  macOS / Linux   it should already be there; try: sudo apt install zip
  Windows         use WSL, or compress the folder by hand:
                  1. Right-click the 'vault' folder, Send to > Compressed folder
                  2. Rename it to course-printer-vault.zip
                  3. Move it to backend/dist/
`);
    process.exit(1);
  }
}

function buildZip(outputPath, sources, label) {
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  const args = ['-r', '-q', outputPath, ...sources];
  for (const pattern of EXCLUDES) {
    args.push('-x', pattern);
  }

  execFileSync('zip', args, { cwd: projectRoot, stdio: 'inherit' });

  const sizeMb = (fs.statSync(outputPath).size / 1_048_576).toFixed(2);
  console.log(`  ${label.padEnd(22)} ${sizeMb} MB   ${path.relative(projectRoot, outputPath)}`);
}

function main() {
  ensureZipAvailable();

  const vaultDir = path.join(projectRoot, 'vault');
  if (!fs.existsSync(vaultDir)) {
    console.error(`No vault directory found at ${vaultDir}`);
    process.exit(1);
  }

  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  console.log('\nBuilding customer bundles\n');

  // The Method: the vault only.
  buildZip(methodZip, ['vault'], 'The Method');

  // The Engine: everything a customer needs to run the whole system.
  buildZip(engineZip, ['vault', 'web', 'backend', 'docs', 'README.md', 'SETUP.md', 'DEPLOYMENT.md', 'SECURITY.md', 'MARKETING.md', 'START-HERE.md'], 'The Engine');

  // Verify the exclusions actually held. A regex slip in the exclude list would
  // otherwise ship your Stripe key to every customer, silently.
  console.log('\nVerifying no secrets leaked into the bundles...');
  let leaked = false;

  for (const zipPath of [methodZip, engineZip]) {
    const listing = execFileSync('zip', ['-sf', zipPath], { encoding: 'utf8' });
    const suspicious = listing
      .split('\n')
      .map((line) => line.trim())
      .filter((line) =>
        /(^|\/)\.env$/.test(line) ||
        /\.env\.(local|production)$/.test(line) ||
        /\.db$/.test(line) ||
        /(^|\/)data\//.test(line)
      );

    if (suspicious.length > 0) {
      leaked = true;
      console.error(`\n  DANGER — ${path.basename(zipPath)} contains files that must not ship:`);
      suspicious.forEach((file) => console.error(`    ${file}`));
    }
  }

  if (leaked) {
    console.error('\nBundles NOT safe to distribute. Fix the EXCLUDES list in scripts/build-vault.js.\n');
    process.exit(1);
  }

  console.log('  Clean — no .env, database or credential files included.\n');
  console.log('Done. The server will serve these automatically.\n');
}

main();
