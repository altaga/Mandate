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

const SUB = env.CLOUDFLARE_WORKER_SUBDOMAIN || 'mandate-x402-fkqggy.workers.dev';
const KEY = env.X402_GATEWAY_KEY;
const ROUNDS = 3;

const SERVICES = [
  { slug: 'ai-inference', vendorId: 'ai_inference', name: 'MiniMax LLM AI Inference', slaMs: 12000, normalMs: 2000, work: 'inference' },
  { slug: 'cloudburst', vendorId: 'cloudburst', name: 'CloudBurst AI Ingress', slaMs: 12000, normalMs: 2000, work: 'inference' },
  { slug: 'graph-oracle', vendorId: 'graph_oracle', name: 'The Graph Oracle', slaMs: 800, normalMs: 120, work: 'graph' },
  { slug: 'megacompute', vendorId: 'megacompute', name: 'MegaCompute Cluster', slaMs: 800, normalMs: 120, work: 'graph' },
  { slug: 'web-search', vendorId: 'web_search', name: 'Live Web Search', slaMs: 400, normalMs: 20, work: 'search' },
  { slug: 'arc-bundler', vendorId: 'arc_bundler', name: 'ERC-4337 Bundler', slaMs: 400, normalMs: 80, work: 'rpc' },
  { slug: 'resilientdb', vendorId: 'resilientdb', name: 'ResilientDB Failover', slaMs: 400, normalMs: 80, work: 'rpc' },
  { slug: 'quickscale', vendorId: 'quickscale', name: 'QuickScale Spot Compute', slaMs: 400, normalMs: 20, work: 'compute' },
];

function stats(nums) {
  const sorted = [...nums].sort((a, b) => a - b);
  const sum = nums.reduce((s, n) => s + n, 0);
  return {
    min: Math.min(...nums),
    max: Math.max(...nums),
    avg: Math.round(sum / nums.length),
    p50: sorted[Math.floor((sorted.length - 1) * 0.5)],
  };
}

async function hitVendor(svc) {
  const url = `https://mandate-x402-${svc.slug}.${SUB}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${KEY}`,
    },
    body: JSON.stringify({
      vendorId: svc.vendorId,
      prompt: 'SLA bench: generate one-line nginx rate-limit for 2840 RPS',
    }),
  });
  const rttMs = Date.now() - started;
  const body = await res.json().catch(() => ({}));
  return {
    http: res.status,
    rttMs,
    edgeMs: Number.isFinite(Number(body.latencyAchievedMs)) ? Number(body.latencyAchievedMs) : null,
    slaStatus: body.slaStatus || null,
    slaReason: body.slaReason || null,
    success: Boolean(body.success),
    error: body.error || null,
    engine: body.realWorkloadExecuted?.engine || body.realWorkloadExecuted?.cloudflareAction || null,
  };
}

async function hitPaymaster() {
  const url = `https://mandate-x402-paymaster.${SUB}`;
  const started = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  const rttMs = Date.now() - started;
  const text = await res.text();
  return { http: res.status, rttMs, body: text.slice(0, 80) };
}

console.log(`SLA bench  ·  ${ROUNDS} rounds  ·  ${SUB}\n`);
console.log(`${'SERVICE'.padEnd(28)} ${'BASE'.padStart(6)} ${'CEIL'.padStart(6)}  ${'EDGE'.padStart(7)}  ${'RTT'.padStart(7)}  RESULT`);
console.log('-'.repeat(88));

const rows = [];

for (const svc of SERVICES) {
  const edge = [];
  const rtt = [];
  const statuses = [];
  let engine = '—';
  let lastError = null;

  for (let i = 0; i < ROUNDS; i++) {
    try {
      const hit = await hitVendor(svc);
      if (hit.edgeMs != null) edge.push(hit.edgeMs);
      rtt.push(hit.rttMs);
      statuses.push(hit.slaStatus || (hit.success ? 'OK' : 'FAIL'));
      if (hit.engine) engine = hit.engine;
      if (hit.error) lastError = hit.error;
    } catch (err) {
      lastError = err.message;
      statuses.push('ERR');
    }
  }

  const e = edge.length ? stats(edge) : { avg: null, p50: null, min: null, max: null };
  const r = rtt.length ? stats(rtt) : { avg: null, p50: null };
  const honored = statuses.length > 0 && statuses.every((s) => s === 'HONORED');
  const label = honored ? 'HONORED' : lastError ? `ERROR` : 'BREACHED';

  rows.push({
    name: svc.name,
    slaMs: svc.slaMs,
    edgeAvg: e.avg,
    rttAvg: r.avg,
    honored,
    engine,
    work: svc.work,
  });

  const edgeStr = e.avg == null ? 'n/a' : `${e.avg}ms`;
  const rttStr = r.avg == null ? 'n/a' : `${r.avg}ms`;
  console.log(
    `${svc.name.padEnd(28)} ${String(svc.normalMs + 'ms').padStart(6)} ${String(svc.slaMs + 'ms').padStart(6)}  ${edgeStr.padStart(7)}  ${rttStr.padStart(7)}  ${label}  ${engine}`
  );
}

console.log('\n── Paymaster liveness (no workload SLA) ──');
try {
  const p = await hitPaymaster();
  const alive = p.http === 400 && p.body.includes('vendorWallet');
  console.log(`mandate-x402-paymaster   HTTP ${p.http}  RTT ${p.rttMs}ms  ${alive ? 'ALIVE (validates input)' : 'UNEXPECTED'}`);
} catch (err) {
  console.log(`mandate-x402-paymaster   ERR ${err.message}`);
}

const passed = rows.filter((r) => r.honored).length;
const failed = rows.length - passed;
console.log(`\nSummary: ${passed}/${rows.length} vendors HONORED SLA   ·   ${failed} BREACHED`);
process.exit(failed > 0 ? 2 : 0);
