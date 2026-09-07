import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnvFile(filePath) {
  const out = {};
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
    out[key] = val;
  }
  return out;
}

const envFile = loadEnvFile(path.resolve(__dirname, '..', '.env'));
const API_TOKEN = envFile.CLOUDFLARE_API_TOKEN;
const ACCOUNT_ID = envFile.CLOUDFLARE_ACCOUNT_ID;
const GATEWAY_KEY = envFile.X402_GATEWAY_KEY;
const RED_TEAM = envFile.RED_TEAM_BYPASS_KEY;
const MINIMAX_KEY = envFile.MINIMAX_API_KEY;
const MINIMAX_BASE = envFile.MINIMAX_BASE_URL;
const GRAPH_KEY = envFile.GRAPH_API_KEY;

if (!API_TOKEN || !ACCOUNT_ID || !GATEWAY_KEY) {
  console.error('Missing required env vars');
  process.exit(1);
}

console.log(`Gateway key length: ${GATEWAY_KEY.length}`);

const workers = [
  'mandate-x402-ai-inference',
  'mandate-x402-cloudburst',
  'mandate-x402-graph-oracle',
  'mandate-x402-megacompute',
  'mandate-x402-web-search',
  'mandate-x402-arc-bundler',
  'mandate-x402-resilientdb',
  'mandate-x402-quickscale',
];

const secrets = {
  X402_GATEWAY_KEY: GATEWAY_KEY,
  RED_TEAM_BYPASS_KEY: RED_TEAM,
  MINIMAX_API_KEY: MINIMAX_KEY,
  MINIMAX_BASE_URL: MINIMAX_BASE,
  GRAPH_API_KEY: GRAPH_KEY,
};

const procEnv = {
  ...process.env,
  CLOUDFLARE_API_TOKEN: API_TOKEN,
  CLOUDFLARE_ACCOUNT_ID: ACCOUNT_ID,
};

for (const worker of workers) {
  console.log(`\n── Secrets → ${worker}`);
  for (const [name, value] of Object.entries(secrets)) {
    if (!value) continue;
    const tmp = path.join(__dirname, `_sec_${name}.txt`);
    // Unix LF only, no trailing newline issues beyond one \n that wrangler trims
    fs.writeFileSync(tmp, value, { encoding: 'utf8' });
    const result = spawnSync(
      'npx',
      ['wrangler', 'secret', 'put', name, '--name', worker],
      {
        cwd: __dirname,
        env: procEnv,
        input: value,
        encoding: 'utf8',
        shell: true,
      }
    );
    try { fs.unlinkSync(tmp); } catch {}
    if (result.status === 0) {
      console.log(`  ✓ ${name}`);
    } else {
      console.log(`  ✗ ${name}: ${(result.stderr || result.stdout || '').slice(0, 200)}`);
    }
  }
}

console.log('\nDone.');
