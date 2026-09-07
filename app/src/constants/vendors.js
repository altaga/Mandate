/**
 * @file vendors.js
 * @description Single source of truth for the Mandate vendor catalog.
 * Used by agentService.js, vendor+api.js, reputation+api.js, catalog+api.js,
 * and infraFailoverService.js — no more scattered duplicates.
 *
 * LAYER 0 FALLBACK SPONSORS (real services with existing credentials):
 *   - The Graph  → /api/vendor/reputation fallback (GRAPH_API_KEY in .env)
 *   - Arc RPC    → /api/treasury/balances fallback (ARC_RPC_URL in .env)
 *   - Local JS   → /api/agent/reason fallback (deterministic, no external call)
 *   - Static     → /api/vendor/catalog fallback (bundled in this file)
 */

// ─── SPONSOR FALLBACK MAP ────────────────────────────────────────────────────
// Which sponsor handles each Layer 0 path when it degrades.
export const SPONSOR_MAP = {
  health: {
    sponsor: 'The Graph',
    method: 'blockHeightCheck',
    costUsdc: 0.00004,
    recipient: process.env.VENDOR_ADDR_GRAPH_ORACLE || '0x3D611a9049681fdDb746B8E2A8970F07249013bf',
    description: 'Query The Graph for latest indexed block to confirm liveness',
  },
  balances: {
    sponsor: 'Arc',
    method: 'directRpc',
    costUsdc: 0,
    recipient: null,
    description: 'Call Arc RPC eth_getBalance directly, bypassing the Expo proxy',
  },
  reputation: {
    sponsor: 'The Graph',
    method: 'subgraphQuery',
    costUsdc: 0.00004,
    recipient: process.env.VENDOR_ADDR_GRAPH_ORACLE || '0x3D611a9049681fdDb746B8E2A8970F07249013bf',
    description: 'Query The Graph Subgraph for on-chain market data as reputation proxy',
  },
  catalog: {
    sponsor: 'Built-in',
    method: 'staticFallback',
    costUsdc: 0,
    description: 'Serve the static offline VENDOR_CATALOG bundled in vendors.js',
  },
  reason: {
    sponsor: 'Built-in',
    method: 'deterministicFallback',
    costUsdc: 0,
    description: 'Use getAIReasoning() local deterministic fallback in agentService.js',
  },
  probe: {
    sponsor: 'Arc',
    method: 'directRpc',
    costUsdc: 0,
    recipient: null,
    description: 'Prove network reachability via Arc RPC directly, bypassing the Expo proxy',
  },
};

// ─── HEURISTIC THRESHOLDS ────────────────────────────────────────────────────
// Per-path thresholds that trigger failover to sponsor.
export const THRESHOLDS = {
  health:     { errorRate: 0.40, avgLatencyMs: 2000, consecutiveErrors: 2 },
  balances:   { errorRate: 0.30, avgLatencyMs: 1500, consecutiveErrors: 3 },
  reputation: { errorRate: 0.25, avgLatencyMs: 1200, consecutiveErrors: 2 },
  catalog:    { errorRate: 0.35, avgLatencyMs: 1800, consecutiveErrors: 3 },
  reason:     { errorRate: 0.20, avgLatencyMs: 4000, consecutiveErrors: 2 },
  probe:      { errorRate: 0.30, avgLatencyMs: 1500, consecutiveErrors: 3 },
};

// ─── VENDOR CATALOG ──────────────────────────────────────────────────────────
// Source of truth. Imported by vendor+api.js (POST x402) and catalog+api.js (GET).
export const VENDOR_CATALOG = {
  ai_inference: {
    id: 'ai_inference',
    name: 'MiniMax LLM AI Inference Service',
    costUsdc: 0.0008,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_AI_INFERENCE || '0x0f8397Dd5604278AAa5eB7C6BB001F5361871347',
    normalLatencyMs: 2000,
    maxSlaLatencyMs: 12000,
    reputation: 99.1,
    specialty: 'Context Parsing & AI Generation',
    description: 'Real-time AI generation, code synthesis, and infrastructure diagnostics via MiniMax-M3',
  },
  cloudburst: {
    id: 'cloudburst',
    name: 'CloudBurst AI Ingress & Compute Scaling',
    costUsdc: 0.0008,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_CLOUDBURST || '0x0121F88DADDc9f13C865606C01eE41fbed430c5B',
    normalLatencyMs: 2000,
    maxSlaLatencyMs: 12000,
    reputation: 99.1,
    specialty: 'Edge Network Ingress',
    description: 'AI ingress load-balancing rules generated via MiniMax-M3',
  },
  graph_oracle: {
    id: 'graph_oracle',
    name: 'The Graph Decentralized Oracle',
    costUsdc: 0.00004,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_GRAPH_ORACLE || '0x3D611a9049681fdDb746B8E2A8970F07249013bf',
    normalLatencyMs: 120,
    maxSlaLatencyMs: 800,
    reputation: 98.9,
    specialty: 'Decentralized Data Oracle',
    description: 'Live on-chain market data & vendor reputation from The Graph Network Gateway',
    sponsor: true,
    sponsorFor: ['health', 'reputation'],
  },
  arc_rpc: {
    id: 'arc_rpc',
    name: 'Arc Direct RPC Node',
    costUsdc: 0,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: null,
    normalLatencyMs: 80,
    maxSlaLatencyMs: 300,
    reputation: 99.8,
    specialty: 'Blockchain RPC',
    description: 'Direct Arc testnet RPC bypassing the Expo proxy layer for balance reads',
    sponsor: true,
    sponsorFor: ['balances'],
  },
  megacompute: {
    id: 'megacompute',
    name: 'MegaCompute High-Throughput Cluster',
    costUsdc: 0.0021,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_MEGACOMPUTE || '0x8148BDC603F3f4851F8ee4AAC5F19a8Bbb92513d',
    normalLatencyMs: 120,
    maxSlaLatencyMs: 800,
    reputation: 98.7,
    specialty: 'High-Throughput Compute',
    description: 'Enterprise compute cluster for heavy parallel workloads',
  },
  arc_bundler: {
    id: 'arc_bundler',
    name: 'Gasless ERC-4337 Bundler & Paymaster',
    costUsdc: 0.0004,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_ARC_BUNDLER || '0x56d360f78E9E755e5132889b69fe5F20213Ec512',
    normalLatencyMs: 80,
    maxSlaLatencyMs: 400,
    reputation: 99.8,
    specialty: 'Gasless Transaction Relay',
    description: 'Relays gasless UserOperations to Arc EntryPoint with Circle Paymaster sponsorship',
  },
  resilientdb: {
    id: 'resilientdb',
    name: 'ResilientDB Failover Storage',
    costUsdc: 1.20,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_RESILIENTDB || '0x16BC60A6693D9978e1770603873436B5ecFA4F25',
    normalLatencyMs: 80,
    maxSlaLatencyMs: 400,
    reputation: 99.9,
    specialty: 'Disaster Recovery Storage',
    description: 'Multi-region disaster recovery. Requires human escalation (cost > $1.00).',
  },
  web_search: {
    id: 'web_search',
    name: 'Live Web Search Fact-Checker',
    costUsdc: 0.0005,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_WEB_SEARCH || '0x41ebbD7D29010DE2dAE524Af0F1d56960a66Dd3E',
    normalLatencyMs: 20,
    maxSlaLatencyMs: 400,
    reputation: 99.2,
    specialty: 'Cross-referencing Logic',
    description: 'Real-time web search for external world knowledge verification',
  },
  quickscale: {
    id: 'quickscale',
    name: 'QuickScale Spot Compute',
    costUsdc: 0.0005,
    currency: 'USDC',
    network: 'Arc Testnet (Chain ID: 5042002)',
    recipient: process.env.VENDOR_ADDR_QUICKSCALE || '0x8327BC1B2017AaF5b686285e09664a4B21456a48',
    normalLatencyMs: 20,
    maxSlaLatencyMs: 400,
    reputation: 82.3,
    specialty: 'Spot Compute',
    description: 'Budget unguaranteed spot compute. Rep < 95% — only usable as last resort.',
  },
};

// ─── PROVIDERS ARRAY (for agentService.js compatibility) ─────────────────────
export const PROVIDERS = Object.values(VENDOR_CATALOG);

// ─── STATIC CATALOG (offline fallback for /api/vendor/catalog) ───────────────
// Strip server-side fields (recipient addresses) for safe client-side use.
export const STATIC_CATALOG_SAFE = Object.values(VENDOR_CATALOG).map(
  ({ recipient: _r, ...safe }) => safe
);
