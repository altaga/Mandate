/**
 * @file infraHealthStore.js
 * @description Per-service infrastructure health state for Mandate.
 *
 * Was globalThis-backed, documented as "shared between all API route
 * handlers in the same Node.js process" — a real problem under EAS
 * Hosting, which doesn't guarantee one process serves every request. Now
 * backed by D1 (infra_health_state + infra_health_window) so the failover
 * heuristic sees the same state regardless of which instance handles a
 * given request.
 *
 * Tracks per-path: error rates, latency, consecutive failures, sponsor status.
 * Used by the heuristic engine (useInfraHealth) to decide autonomous failovers.
 */

import { THRESHOLDS, SPONSOR_MAP } from '../constants/vendors.js';
import { queryD1, queryD1Async } from './d1Client.js';

const TRACKED_PATHS = ['health', 'balances', 'reputation', 'catalog', 'reason', 'probe'];
const WINDOW = 20;      // rolling window size for error rate calc
const RECOVERY_N = 5;   // consecutive clean probes needed to return to Layer 0

const DEFAULT_STATE = {
  mode: 'layer0', consecutive_errors: 0, sponsor: null, sponsor_cost: 0,
  failover_at: null, total_sponsor_cost: 0, recovery_probes: 0,
  last_hit_at: 0, last_status: 0, last_latency_ms: 0,
};

// ─── WRITE ────────────────────────────────────────────────────────────────────

/**
 * Record a single request hit for a given path.
 * Called from withLabGlitch.js after each request completes. Must be
 * awaited, not fire-and-forget: EAS Hosting's runtime can freeze or tear
 * down the function as soon as the Response is returned, which silently
 * dropped every un-awaited write here in practice (confirmed directly).
 */
export async function recordServiceHit(path, status, latencyMs) {
  const ok = status >= 200 && status < 400;
  const ms = Number(latencyMs) || 0;
  const now = Date.now();

  const windowWrite = queryD1(
    'INSERT INTO infra_health_window (path, created_at, ok, latency_ms) VALUES (?, ?, ?, ?)',
    [path, now, ok ? 1 : 0, ms]
  );
  // Probabilistic cleanup — fire-and-forget is fine, nothing depends on it.
  if (Math.random() < 0.05) {
    queryD1Async(
      `DELETE FROM infra_health_window WHERE path = ? AND id NOT IN
       (SELECT id FROM infra_health_window WHERE path = ? ORDER BY id DESC LIMIT ?)`,
      [path, path, WINDOW]
    );
  }

  // One atomic UPDATE using CASE expressions over the OLD row's values, so
  // this reproduces the exact same state machine the original synchronous
  // (single-JS-tick, therefore atomic) globalThis version had, without a
  // separate read-then-write round trip that could race under concurrent hits.
  // Note the sponsor->recovering transition seeds recovery_probes at 1, not
  // 0 — the original code re-checked svc.mode === 'recovering' immediately
  // after setting it to 'recovering' in the same call, so the hit that
  // triggers the transition also counts as the first clean recovery probe.
  const okInt = ok ? 1 : 0;
  const stateWrite = queryD1(
    `INSERT INTO infra_health_state (path, last_hit_at, last_status, last_latency_ms)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       consecutive_errors = CASE WHEN ? THEN 0 ELSE consecutive_errors + 1 END,
       mode = CASE
         WHEN ? AND mode = 'sponsor' THEN 'recovering'
         WHEN (NOT ?) AND mode = 'recovering' THEN 'sponsor'
         ELSE mode
       END,
       recovery_probes = CASE
         WHEN ? AND mode = 'sponsor' THEN 1
         WHEN ? AND mode = 'recovering' THEN recovery_probes + 1
         WHEN NOT ? THEN 0
         ELSE recovery_probes
       END,
       last_hit_at = excluded.last_hit_at,
       last_status = excluded.last_status,
       last_latency_ms = excluded.last_latency_ms`,
    [path, now, status, ms, okInt, okInt, okInt, okInt, okInt, okInt]
  );

  await Promise.all([windowWrite, stateWrite]);
}

/**
 * Activate sponsor mode for a path.
 * Called by the agent after a successful failover payment.
 */
export async function markSponsorActive(path, sponsorName, costUsdc) {
  await queryD1(
    `INSERT INTO infra_health_state (path, mode, sponsor, sponsor_cost, failover_at, recovery_probes)
     VALUES (?, 'sponsor', ?, ?, ?, 0)
     ON CONFLICT(path) DO UPDATE SET
       mode = 'sponsor', sponsor = excluded.sponsor, sponsor_cost = excluded.sponsor_cost,
       failover_at = excluded.failover_at, recovery_probes = 0`,
    [path, sponsorName || 'Unknown', Number(costUsdc) || 0, Date.now()]
  );
}

/**
 * Begin the recovery phase — watching for RECOVERY_N consecutive clean probes.
 * Called when the glitch is removed and Layer 0 starts responding again.
 */
export async function startRecoveryMode(path) {
  await queryD1(
    `UPDATE infra_health_state SET mode = 'recovering', recovery_probes = 0
     WHERE path = ? AND mode = 'sponsor'`,
    [path]
  );
}

/**
 * Return to Layer 0 after recovery is confirmed.
 * Called by the agent when recoveryProbes >= RECOVERY_N.
 */
export async function markLayer0Recovered(path) {
  const rows = await queryD1(
    'SELECT sponsor_cost, failover_at, total_sponsor_cost FROM infra_health_state WHERE path = ?',
    [path]
  );
  const svc = rows?.[0];
  if (!svc) return;
  const minutesElapsed = svc.failover_at ? Math.ceil((Date.now() - svc.failover_at) / 1000 / 60) : 1;
  const newTotal = Number(svc.total_sponsor_cost || 0) + Number(svc.sponsor_cost || 0) * minutesElapsed;

  await queryD1(
    `UPDATE infra_health_state SET
       total_sponsor_cost = ?, mode = 'layer0', sponsor = NULL, sponsor_cost = 0,
       failover_at = NULL, recovery_probes = 0, consecutive_errors = 0
     WHERE path = ?`,
    [newTotal, path]
  );
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Compute derived health metrics for a single path.
 */
export async function getServiceHealth(path) {
  const [stateRows, windowRows] = await Promise.all([
    queryD1('SELECT * FROM infra_health_state WHERE path = ?', [path]),
    queryD1('SELECT ok, latency_ms FROM infra_health_window WHERE path = ? ORDER BY id DESC LIMIT ?', [path, WINDOW]),
  ]);
  const svc = stateRows?.[0] || DEFAULT_STATE;
  const window = windowRows || [];

  const total = window.length;
  const errors = window.filter((h) => !h.ok).length;
  const avgLatencyMs = total ? Math.round(window.reduce((s, h) => s + h.latency_ms, 0) / total) : 0;
  const errorRate = total ? errors / total : 0;

  const threshold = THRESHOLDS[path] || {};
  const sponsorCfg = SPONSOR_MAP[path] || {};

  let severity = 'ok';
  if (
    svc.consecutive_errors >= (threshold.consecutiveErrors || 3) ||
    errorRate > (threshold.errorRate || 0.30)
  ) {
    severity = 'critical';
  } else if (avgLatencyMs > (threshold.avgLatencyMs || 1500)) {
    severity = 'slow';
  }

  return {
    path,
    mode: svc.mode,
    severity,
    errorRate: Number(errorRate.toFixed(3)),
    avgLatencyMs,
    consecutiveErrors: svc.consecutive_errors,
    recoveryProbes: svc.recovery_probes,
    recoveryNeeded: RECOVERY_N,
    sponsor: svc.sponsor,
    sponsorCost: svc.sponsor_cost,
    totalSponsorCost: Number((svc.total_sponsor_cost || 0).toFixed(6)),
    failoverAt: svc.failover_at,
    lastHitAt: svc.last_hit_at,
    lastStatus: svc.last_status,
    lastLatencyMs: svc.last_latency_ms,
    fallbackSponsor: sponsorCfg.sponsor || null,
    fallbackCost: sponsorCfg.costUsdc || 0,
    needsFailover: severity === 'critical' && svc.mode === 'layer0',
    needsRecovery: svc.mode === 'recovering' && svc.recovery_probes >= RECOVERY_N,
  };
}

/**
 * Returns health status for all tracked services.
 */
export async function getAllHealth() {
  const results = await Promise.all(TRACKED_PATHS.map((path) => getServiceHealth(path)));
  return results.filter(Boolean);
}

/**
 * Reset all service states to initial (used for testing/reset button).
 */
export async function resetInfraHealth() {
  await Promise.all([
    queryD1('DELETE FROM infra_health_state'),
    queryD1('DELETE FROM infra_health_window'),
  ]);
}
