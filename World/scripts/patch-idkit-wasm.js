/**
 * Metro breaks `new URL("idkit_wasm_bg.wasm", import.meta.url)`.
 * Rewrite to load the static file from /public/idkit_wasm_bg.wasm.
 *
 * Run automatically via package.json "postinstall".
 */
const fs = require('fs');
const path = require('path');

const TARGET = path.join(
  __dirname,
  '..',
  'node_modules',
  '@worldcoin',
  'idkit-core',
  'dist',
  'index.js'
);

const FROM = 'new URL("idkit_wasm_bg.wasm", import.meta.url)';
const TO = 'new URL("/idkit_wasm_bg.wasm", window.location.origin)';

if (!fs.existsSync(TARGET)) {
  console.warn('[patch-idkit-wasm] idkit-core not installed yet — skip');
  process.exit(0);
}

const source = fs.readFileSync(TARGET, 'utf8');

if (source.includes(TO)) {
  console.log('[patch-idkit-wasm] already patched');
  process.exit(0);
}

if (!source.includes(FROM)) {
  console.warn('[patch-idkit-wasm] expected WASM URL pattern not found — skip');
  process.exit(0);
}

fs.writeFileSync(TARGET, source.replace(FROM, TO), 'utf8');
console.log('[patch-idkit-wasm] patched idkit-core WASM loader → /idkit_wasm_bg.wasm');
