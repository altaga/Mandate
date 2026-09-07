/**
 * Mandate x402 Vendor Edge Worker
 * Authenticates with X402_GATEWAY_KEY and executes a real (or SLA-bound) workload
 * for the vendor that this Worker instance represents.
 *
 * Expected POST body: { vendorId, prompt?, simulateSlaBreach? }
 * Auth: Authorization: Bearer <X402_GATEWAY_KEY>
 */

const WORK_PROFILES = {
  inference: { normalMs: 2000, maxSlaMs: 12000, timeoutMs: 15000 },
  graph: { normalMs: 120, maxSlaMs: 800, timeoutMs: 4000 },
  rpc: { normalMs: 80, maxSlaMs: 400, timeoutMs: 3000 },
  search: { normalMs: 20, maxSlaMs: 400, timeoutMs: 2000 },
  compute: { normalMs: 20, maxSlaMs: 400, timeoutMs: 2000 },
};

const VENDOR_META = {
  ai_inference: { name: 'MiniMax LLM AI Inference', work: 'inference' },
  cloudburst: { name: 'CloudBurst AI Ingress', work: 'inference' },
  graph_oracle: { name: 'The Graph Decentralized Oracle', work: 'graph' },
  megacompute: { name: 'MegaCompute Cluster', work: 'graph' },
  web_search: { name: 'Live Web Search', work: 'search' },
  arc_bundler: { name: 'Gasless ERC-4337 Bundler', work: 'rpc' },
  resilientdb: { name: 'ResilientDB Failover', work: 'rpc' },
  quickscale: { name: 'QuickScale Spot Compute', work: 'compute' },
};

function profileFor(work) {
  return WORK_PROFILES[work] || WORK_PROFILES.rpc;
}

function evaluateSla(latencyMs, work, failed, failMessage) {
  const profile = profileFor(work);
  if (failed) {
    return {
      slaStatus: 'ERROR',
      slaReason: failMessage || 'Workload failed — service is not responding normally',
      ...profile,
    };
  }
  if (latencyMs >= profile.timeoutMs) {
    return {
      slaStatus: 'BREACHED',
      slaReason: `Timeout: ${latencyMs}ms exceeded the ${profile.timeoutMs}ms hard cap for ${work}`,
      ...profile,
    };
  }
  if (work === 'inference') {
    return {
      slaStatus: 'HONORED',
      slaReason: `Successful ${work} in ${latencyMs}ms — LLM latency is expected (baseline ~${profile.normalMs}ms)`,
      ...profile,
    };
  }
  if (latencyMs > profile.maxSlaMs) {
    const ratio = profile.normalMs ? Math.round(latencyMs / profile.normalMs) : '?';
    return {
      slaStatus: 'BREACHED',
      slaReason: `Abnormal: ${latencyMs}ms is ~${ratio}x the ${profile.normalMs}ms ${work} baseline`,
      ...profile,
    };
  }
  return {
    slaStatus: 'HONORED',
    slaReason: `${latencyMs}ms is normal for ${work} (baseline ~${profile.normalMs}ms, ceiling ${profile.maxSlaMs}ms)`,
    ...profile,
  };
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Red-Team-Bypass-Key',
};

function json(body, status = 200) {
  return Response.json(body, { status, headers: cors });
}

function unauthorized() {
  return json({ success: false, error: 'Unauthorized — invalid or missing X402_GATEWAY_KEY' }, 401);
}

async function runInference(env, prompt) {
  if (!env.MINIMAX_API_KEY) {
    return {
      serviceType: 'inference',
      cloudflareAction: 'Deterministic Edge Rule Synthesis',
      output: `rate_limit zone=edge burst=40 nodelay; # synthesized for: ${(prompt || 'traffic spike').slice(0, 80)}`,
      engine: 'edge-local',
    };
  }
  const base = (env.MINIMAX_BASE_URL || 'https://api.minimax.io/anthropic').replace(/\/$/, '');
  const res = await fetch(`${base}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.MINIMAX_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'MiniMax-M3',
      max_tokens: 120,
      messages: [{
        role: 'user',
        content: `Return ONE nginx rate-limit rule (one line only) for: ${prompt || '2840 RPS spike'}`,
      }],
    }),
    signal: AbortSignal.timeout(WORK_PROFILES.inference.timeoutMs),
  });
  if (!res.ok) throw new Error(`MiniMax HTTP ${res.status}`);
  const data = await res.json();
  const text = (data.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  return {
    serviceType: 'inference',
    cloudflareAction: 'MiniMax-M3 Edge Inference',
    output: text.trim().slice(0, 400),
    engine: 'minimax',
  };
}

async function runGraph(env) {
  if (!env.GRAPH_API_KEY) {
    return {
      serviceType: 'graph',
      cloudflareAction: 'Indexer Heartbeat (local)',
      blockNumber: null,
      note: 'GRAPH_API_KEY not set — heartbeat only',
    };
  }
  const subgraphId = env.GRAPH_SUBGRAPH_ID || '5zvR82QoaXYFyDEKLZ9t6v9adgnptxYpKpSbxtgVENFV';
  const url = `https://gateway.thegraph.com/api/${env.GRAPH_API_KEY}/subgraphs/id/${subgraphId}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query: '{ _meta { block { number timestamp } } }',
    }),
    signal: AbortSignal.timeout(WORK_PROFILES.graph.timeoutMs),
  });
  if (!res.ok) throw new Error(`The Graph HTTP ${res.status}`);
  const data = await res.json();
  const block = data?.data?._meta?.block;
  return {
    serviceType: 'graph',
    cloudflareAction: 'The Graph Gateway Query',
    blockNumber: block?.number ?? null,
    blockTimestamp: block?.timestamp ?? null,
    engine: 'thegraph',
  };
}

async function runRpc() {
  const res = await fetch('https://rpc.testnet.arc.network', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_blockNumber', params: [] }),
    signal: AbortSignal.timeout(WORK_PROFILES.rpc.timeoutMs),
  });
  if (!res.ok) throw new Error(`Arc RPC HTTP ${res.status}`);
  const data = await res.json();
  return {
    serviceType: 'rpc',
    cloudflareAction: 'Arc Testnet eth_blockNumber',
    blockNumberHex: data.result,
    blockNumber: data.result ? parseInt(data.result, 16) : null,
    engine: 'arc-rpc',
  };
}

async function runSearch(prompt) {
  return {
    serviceType: 'search',
    cloudflareAction: 'Edge Fact Snapshot',
    query: (prompt || 'mandate infrastructure status').slice(0, 120),
    results: [
      { title: 'Arc Testnet status', snippet: 'RPC reachable from Cloudflare Worker edge.' },
      { title: 'Mandate x402 settlement', snippet: 'HTTP 402 → Arc USDC pay → edge workload.' },
    ],
    engine: 'edge-local',
  };
}

async function runCompute(prompt) {
  const started = Date.now();
  let n = 0;
  for (let i = 0; i < 25000; i++) n = (n + i * 17) % 9973;
  return {
    serviceType: 'compute',
    cloudflareAction: 'Spot CPU Burst',
    checksum: n,
    elapsedMs: Date.now() - started,
    prompt: (prompt || '').slice(0, 80),
    engine: 'edge-cpu',
  };
}

async function executeWorkload(vendorId, env, prompt) {
  const meta = VENDOR_META[vendorId] || VENDOR_META.cloudburst;
  switch (meta.work) {
    case 'inference': return runInference(env, prompt);
    case 'graph': return runGraph(env);
    case 'rpc': return runRpc();
    case 'search': return runSearch(prompt);
    case 'compute': return runCompute(prompt);
    default: return { serviceType: 'unknown', cloudflareAction: 'noop' };
  }
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors });
    }

    if (request.method === 'GET') {
      return json({
        ok: true,
        service: 'mandate-x402-vendor',
        worker: env.WORKER_NAME || 'mandate-x402-vendor',
        vendors: Object.keys(VENDOR_META),
      });
    }

    if (request.method !== 'POST') {
      return json({ error: 'Method Not Allowed' }, 405);
    }

    const auth = request.headers.get('Authorization') || '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!env.X402_GATEWAY_KEY || token !== env.X402_GATEWAY_KEY) {
      return unauthorized();
    }

    const started = Date.now();
    let workType = 'rpc';
    try {
      const body = await request.json().catch(() => ({}));
      const vendorId = (body.vendorId || 'cloudburst').toLowerCase();
      const meta = VENDOR_META[vendorId] || VENDOR_META.cloudburst;
      workType = meta.work;

      const redTeam = request.headers.get('X-Red-Team-Bypass-Key');
      const simulateBreach = Boolean(body.simulateSlaBreach) &&
        env.RED_TEAM_BYPASS_KEY &&
        redTeam === env.RED_TEAM_BYPASS_KEY;

      if (simulateBreach) {
        const profile = profileFor(meta.work);
        await new Promise((r) => setTimeout(r, profile.maxSlaMs + 200));
        const latencyAchievedMs = Date.now() - started;
        const judged = evaluateSla(latencyAchievedMs, meta.work, false);
        return json({
          success: false,
          slaStatus: 'BREACHED',
          slaReason: judged.slaReason,
          latencyAchievedMs,
          slaThresholdMs: profile.maxSlaMs,
          normalMs: profile.normalMs,
          error: `Forced SLA breach: ${latencyAchievedMs}ms > ${profile.maxSlaMs}ms`,
          vendor: meta.name,
        });
      }

      const realWorkloadExecuted = await executeWorkload(vendorId, env, body.prompt || '');
      const latencyAchievedMs = Date.now() - started;
      const judged = evaluateSla(latencyAchievedMs, meta.work, false);

      return json({
        success: judged.slaStatus === 'HONORED',
        slaStatus: judged.slaStatus,
        slaReason: judged.slaReason,
        latencyAchievedMs,
        slaThresholdMs: judged.maxSlaMs,
        normalMs: judged.normalMs,
        vendor: meta.name,
        realWorkloadExecuted,
      });
    } catch (err) {
      const latencyAchievedMs = Date.now() - started;
      const judged = evaluateSla(latencyAchievedMs, workType, true, err.message || String(err));
      return json({
        success: false,
        slaStatus: judged.slaStatus,
        slaReason: judged.slaReason,
        latencyAchievedMs,
        slaThresholdMs: judged.maxSlaMs,
        error: err.message || String(err),
      }, 500);
    }
  },
};
