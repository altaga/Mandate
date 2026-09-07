import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = {};
for (const line of fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8').split(/\r?\n/)) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) continue;
  const eq = trimmed.indexOf('=');
  if (eq < 0) continue;
  const key = trimmed.slice(0, eq).trim();
  let val = trimmed.slice(eq + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  env[key] = val;
}
console.log(`Using gateway key length=${env.X402_GATEWAY_KEY?.length || 0}`);

const sub = env.CLOUDFLARE_WORKER_SUBDOMAIN || 'mandate-x402-fkqggy.workers.dev';
const key = env.X402_GATEWAY_KEY;
const names = [
  'paymaster',
  'ai-inference',
  'cloudburst',
  'graph-oracle',
  'megacompute',
  'web-search',
  'arc-bundler',
  'resilientdb',
  'quickscale',
];

for (const n of names) {
  const url = `https://mandate-x402-${n}.${sub}`;
  try {
    if (n === 'paymaster') {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      const text = await r.text();
      console.log(`${n.padEnd(16)} POST ${r.status}  ${text.slice(0, 90)}`);
    } else {
      const g = await fetch(url);
      const p = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ vendorId: n.replace(/-/g, '_'), prompt: 'probe' }),
      });
      const pj = await p.json().catch(() => ({}));
      console.log(
        `${n.padEnd(16)} GET ${g.status}  POST ${p.status}  success=${pj.success}  ${pj.slaStatus || pj.error || ''}`
      );
    }
  } catch (e) {
    console.log(`${n.padEnd(16)} ERR ${e.message}`);
  }
}
