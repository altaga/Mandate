/**
 * Deploys all Mandate x402 vendor Workers + prints live URLs.
 * Secrets are written to temp files and piped — never printed.
 *
 * Usage: node deploy-all.js
 * Requires app/.env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, X402_GATEWAY_KEY
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env) || !process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(path.resolve(__dirname, '..', '.env'));

const VENDORS = [
  'ai-inference',
  'cloudburst',
  'graph-oracle',
  'megacompute',
  'web-search',
  'arc-bundler',
  'resilientdb',
  'quickscale',
];

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN?.trim();
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const GATEWAY_KEY = process.env.X402_GATEWAY_KEY?.trim();
const RED_TEAM = process.env.RED_TEAM_BYPASS_KEY?.trim();
const MINIMAX_KEY = process.env.MINIMAX_API_KEY?.trim();
const MINIMAX_BASE = process.env.MINIMAX_BASE_URL?.trim();
const GRAPH_KEY = process.env.GRAPH_API_KEY?.trim();

if (!API_TOKEN || !ACCOUNT_ID || !GATEWAY_KEY) {
  console.error('Missing CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, or X402_GATEWAY_KEY in app/.env');
  process.exit(1);
}

const env = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
};

function run(cmd, args, opts = {}) {
  const result = spawnSync(cmd, args, {
    cwd: __dirname,
    env,
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with code ${result.status}`);
  }
  return result;
}

function putSecret(workerName, secretName, value) {
  if (!value) return;
  const tmp = path.join(__dirname, `.secret-${secretName}.tmp`);
  fs.writeFileSync(tmp, value, { encoding: 'utf8' });
  try {
    // Windows: type file | wrangler secret put
    const pipe = process.platform === 'win32'
      ? spawnSync('cmd', ['/c', `type "${tmp}" | npx wrangler secret put ${secretName} --name ${workerName}`], {
          cwd: __dirname,
          env,
          encoding: 'utf8',
          shell: false,
        })
      : spawnSync('bash', ['-c', `npx wrangler secret put ${secretName} --name ${workerName} < "${tmp}"`], {
          cwd: __dirname,
          env,
          encoding: 'utf8',
        });
    if (pipe.stdout) process.stdout.write(pipe.stdout);
    if (pipe.stderr) process.stderr.write(pipe.stderr);
    if (pipe.status !== 0) {
      console.warn(`  ⚠ secret ${secretName} for ${workerName} may need manual put`);
    } else {
      console.log(`  ✓ secret ${secretName}`);
    }
  } finally {
    fs.unlinkSync(tmp);
  }
}

function writeToml(workerName) {
  const toml = `name = "${workerName}"
main = "index.js"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[vars]
WORKER_NAME = "${workerName}"
`;
  fs.writeFileSync(path.join(__dirname, 'wrangler.toml'), toml);
}

const results = [];

for (const slug of VENDORS) {
  const workerName = `mandate-x402-${slug}`;
  console.log(`\n── Deploying ${workerName} ──`);
  writeToml(workerName);

  run('npx', ['wrangler', 'deploy']);

  if (process.env.SKIP_SECRETS === '1') {
    console.log('  skip secrets (code-only deploy)');
  } else {
    putSecret(workerName, 'X402_GATEWAY_KEY', GATEWAY_KEY);
    putSecret(workerName, 'RED_TEAM_BYPASS_KEY', RED_TEAM);
    putSecret(workerName, 'MINIMAX_API_KEY', MINIMAX_KEY);
    putSecret(workerName, 'MINIMAX_BASE_URL', MINIMAX_BASE);
    putSecret(workerName, 'GRAPH_API_KEY', GRAPH_KEY);
  }

  results.push(workerName);
}

console.log('\n✅ Vendor workers deployed:');
for (const name of results) console.log(`   - ${name}`);
console.log('\nNext: probe workers.dev URLs and set CLOUDFLARE_WORKER_SUBDOMAIN in app/.env');
