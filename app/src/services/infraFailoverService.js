/**
 * @file infraFailoverService.js
 * @description Client-side Infra Resilience Engine for Mandate.
 *
 * Responsibilities:
 *  1. Poll /api/infra/status for per-service health
 *  2. Detect threshold breaches and trigger failover payments
 *  3. Execute real sponsor calls (The Graph, Arc RPC) as fallbacks
 *  4. Detect Layer 0 recovery and return to free tier
 *  5. Emit structured events for Mission Control chat log
 *
 * Real sponsor calls:
 *  - The Graph  → GraphService.queryOnchainContext()  (reputation + health)
 *  - Arc Direct → ArcService.fetchOnchainBalance()    (balances)
 *  - Local JS   → deterministic fallback              (reason, catalog)
 */

import { ArcService } from './arcService.js';
import { STATIC_CATALOG_SAFE, SPONSOR_MAP } from '../constants/vendors.js';

const BASE = typeof window !== 'undefined' ? '' : (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8081');

// ─── Internal tracking (client-side) ─────────────────────────────────────────
// Tracks which services are already in-flight for failover to avoid double-firing.
const _inFlight = new Set();

// ─── API Helpers ──────────────────────────────────────────────────────────────

export async function pollInfraHealth() {
  try {
    const res = await fetch(`${BASE}/api/infra/status`);
    if (!res.ok) throw new Error(`/api/infra/status returned ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn('[infraFailoverService] poll error:', err.message);
    return null;
  }
}

async function callAgentReason(event, context, budget) {
  try {
    const res = await fetch(`${BASE}/api/agent/reason`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, context, budget, providers: [] }),
    });
    if (!res.ok) throw new Error(`reason API ${res.status}`);
    return await res.json();
  } catch {
    // Local deterministic fallback
    if (event === 'INFRA_DEGRADATION') {
      return {
        action: 'FAILOVER_SPONSOR',
        sponsor: context?.fallbackSponsor || 'The Graph',
        cost: context?.fallbackCost || 0,
        reply: `Threshold crossed on ${context?.path}. Switching to ${context?.fallbackSponsor || 'sponsor'} fallback.`,
        logs: [
          `Layer 0 ${context?.path} errorRate: ${((context?.errorRate || 0) * 100).toFixed(1)}%`,
          `Threshold breached. Sponsor fallback: ${context?.fallbackSponsor}.`,
          `Cost $${context?.fallbackCost || 0} within budget $${budget?.toFixed(4)}.`,
        ],
      };
    }
    return {
      action: 'RETURN_TO_LAYER0',
      reply: `Layer 0 ${context?.path} recovered. Returning to own server.`,
      logs: ['Recovery confirmed.'],
    };
  }
}

// ─── Sponsor Execution ────────────────────────────────────────────────────────

/**
 * Execute the real sponsor call for the given service path.
 * Returns { ok, data, source } where source is the sponsor name.
 */
export async function executeSponsorCall(path) {
  const sponsorCfg = SPONSOR_MAP[path];
  if (!sponsorCfg) return { ok: false, data: null, source: 'unknown' };

  try {
    if (sponsorCfg.method === 'subgraphQuery' || sponsorCfg.method === 'blockHeightCheck') {
      // Real The Graph call — routed through the server, since
      // GraphService.queryOnchainContext() needs GRAPH_API_KEY, which never
      // reaches this client-side code (correctly — see SECURITY.md).
      const res = await fetch(`${BASE}/api/graph/context`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error(`graph/context API ${res.status}`);
      const data = await res.json();
      return { ok: true, data, source: 'The Graph' };
    }
    if (sponsorCfg.method === 'directRpc') {
      // Real Arc RPC call bypassing the Expo proxy
      const treasury = process.env.EXPO_PUBLIC_MANDATE_TREASURY_ADDRESS || '';
      const agent = process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS || '';
      const [t, a] = await Promise.all([
        ArcService.fetchOnchainBalance(treasury),
        ArcService.fetchOnchainBalance(agent),
      ]);
      return { ok: true, data: { treasuryUsdc: t.usdcAmount, agentUsdc: a.usdcAmount }, source: 'Arc RPC' };
    }
    if (sponsorCfg.method === 'staticFallback') {
      return { ok: true, data: { vendors: STATIC_CATALOG_SAFE }, source: 'Built-in' };
    }
    if (sponsorCfg.method === 'deterministicFallback') {
      return { ok: true, data: { fallback: true }, source: 'Built-in' };
    }
  } catch (err) {
    console.warn(`[infraFailoverService] sponsor call failed for ${path}:`, err.message);
    return { ok: false, data: null, source: sponsorCfg.sponsor };
  }
  return { ok: false, data: null, source: 'unknown' };
}

// ─── Failover Orchestration ───────────────────────────────────────────────────

/**
 * Handle a degraded service: ask AI, pay if needed, activate sponsor.
 *
 * @param {object} service   - health object from /api/infra/status
 * @param {number} budget    - current agent USDC budget
 * @param {function} onSpend - callback(amount) to deduct from budget state
 * @returns {FailoverEvent}
 */
export async function executeFailover(service, budget, onSpend) {
  const { path } = service;
  if (_inFlight.has(path)) return null;
  _inFlight.add(path);

  const sponsorCfg = SPONSOR_MAP[path];
  const logs = [];

  try {
    // 1. Ask AI what to do
    const aiCtx = {
      path,
      errorRate: service.errorRate,
      avgLatencyMs: service.avgLatencyMs,
      consecutiveErrors: service.consecutiveErrors,
      fallbackSponsor: sponsorCfg?.sponsor || 'Built-in',
      fallbackCost: sponsorCfg?.costUsdc || 0,
    };
    const decision = await callAgentReason('INFRA_DEGRADATION', aiCtx, budget);

    for (const log of decision.logs || []) logs.push(log);

    if (decision.action === 'ESCALATE_HUMAN' || decision.action === 'HALT') {
      return {
        type: 'FAILOVER_BLOCKED',
        path,
        reason: decision.reply,
        logs,
      };
    }

    // 2. Pay for sponsor if it has a real cost
    const cost = Number(sponsorCfg?.costUsdc || 0);
    const vendorWallet = sponsorCfg?.recipient || null;
    let txHash = null;
    if (cost > 0 && cost <= budget) {
      if (!vendorWallet) {
        logs.push(`Payment skipped (no recipient configured for ${path}) — activating sponsor without on-chain record.`);
      } else {
        try {
          const receipt = await ArcService.executeAgentPayment({
            vendorWallet,
            amountUsdc: cost,
            itemDescription: `${sponsorCfg.sponsor} sponsor activation — ${path} failover`,
          });
          txHash = receipt?.txHash;
          if (onSpend) onSpend(cost);
          logs.push(`💸 $${cost} USDC → ${sponsorCfg.sponsor}. Tx: ${txHash}`);
        } catch (payErr) {
          logs.push(`Payment skipped (${payErr.message}) — activating sponsor without on-chain record.`);
        }
      }
    }

    // 3. Execute the real sponsor call to confirm it works
    const sponsorResult = await executeSponsorCall(path);
    logs.push(sponsorResult.ok
      ? `✓ ${sponsorResult.source} responding. Failover active.`
      : `⚠ Sponsor call failed — failover may be degraded.`
    );

    // 4. Notify server to mark sponsor active
    await fetch(`${BASE}/api/infra/activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, sponsor: sponsorCfg?.sponsor, cost }),
    }).catch(() => {}); // best-effort

    return {
      type: 'FAILOVER_ACTIVE',
      path,
      sponsor: sponsorCfg?.sponsor || 'Built-in',
      cost,
      txHash,
      reply: decision.reply,
      logs,
    };
  } finally {
    _inFlight.delete(path);
  }
}

/**
 * Handle recovery: confirm Layer 0 is stable, return to free tier.
 *
 * @param {object} service  - health object (mode === 'recovering', recoveryProbes >= needed)
 * @param {number} budget
 * @returns {RecoveryEvent}
 */
export async function executeRecovery(service, budget) {
  const { path } = service;

  const decision = await callAgentReason('INFRA_RECOVERY', {
    path,
    sponsor: service.sponsor,
    failoverDurationMs: service.failoverAt ? Date.now() - service.failoverAt : 0,
    totalSponsorCost: service.totalSponsorCost || 0,
  }, budget);

  // Notify server
  await fetch(`${BASE}/api/infra/recover`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  }).catch(() => {});

  return {
    type: 'LAYER0_RECOVERED',
    path,
    reply: decision.reply,
    logs: decision.logs || [],
  };
}
