#!/usr/bin/env node
/**
 * @file patch-idkit-wasm-url.js
 * @description Runs on every `npm install` (postinstall) to fix a real bug in
 * @worldcoin/idkit-core's WASM loader for this app's bundling environment.
 *
 * The published package resolves its .wasm file via
 * `new URL("idkit_wasm_bg.wasm", import.meta.url)`. Metro's web bundler does
 * not give `import.meta.url` a usable value here, so that call throws
 * "Failed to construct 'URL': Invalid base URL" — which IDKit swallows and
 * shows the user as a generic "Something went wrong", with no indication
 * this is a bundler incompatibility rather than a real World ID error.
 *
 * We can't fix the upstream package, and a raw manual edit to node_modules
 * doesn't survive a fresh `npm install` (confirmed directly: it was gone the
 * next time this file was inspected). Since patch-package's own install step
 * fails in this environment (peer-dependency resolution), this script
 * applies the fix directly and idempotently instead of via a patch-package
 * .patch file.
 *
 * Fix: resolve against the real page origin instead — the wasm file is
 * served from the site root in every build (confirmed present at both
 * dist/idkit_wasm_bg.wasm and public/idkit_wasm_bg.wasm).
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.join(__dirname, '..', 'node_modules', '@worldcoin', 'idkit-core', 'dist', 'index.js');
const BROKEN = 'new URL("idkit_wasm_bg.wasm", import.meta.url)';
const FIXED = 'new URL("/idkit_wasm_bg.wasm", window.location.origin)';

if (!fs.existsSync(TARGET)) {
  console.warn(`[patch-idkit-wasm-url] ${TARGET} not found — skipping (package may not be installed).`);
  process.exit(0);
}

const contents = fs.readFileSync(TARGET, 'utf8');

if (contents.includes(FIXED)) {
  console.log('[patch-idkit-wasm-url] already patched, nothing to do.');
  process.exit(0);
}

if (!contents.includes(BROKEN)) {
  console.warn(
    '[patch-idkit-wasm-url] expected string not found — @worldcoin/idkit-core may have changed. ' +
    'Re-check this script against the new source before assuming World ID still works.'
  );
  process.exit(0);
}

fs.writeFileSync(TARGET, contents.replace(BROKEN, FIXED));
console.log('[patch-idkit-wasm-url] patched @worldcoin/idkit-core WASM URL resolution.');
