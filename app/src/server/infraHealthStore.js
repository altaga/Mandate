/**
 * @file infraHealthStore.js
 * @description Per-service infrastructure health state for Mandate.
 *
 * Uses globalThis so state persists across hot-reloads and is shared between
 * all API route handlers in the same Node.js process (same pattern as trafficLabStore.js).
 *
 * Tracks per-path: error rates, latency, consecutive failures, sponsor status.
 * Used by the heuristic engine (useInfraHealth) to decide autonomous failovers.
 */

import { THRESHOLDS, SPONSOR_MAP } from '../constants/vendors.js';

const TRACKED_PATHS = ['health', 'balances', 'reputation', 'catalog', 'reason', 'probe'];
const WINDOW = 20;      // rolling window size for error rate calc
const RECOVERY_N = 5;   // consecutive clean probes needed to return to Layer 0

function makeServiceState() {
  return {
    // Rolling window — last WINDOW hits: { ok, latencyMs }
    window: [],
    // Consecutive failure counter (reset on any 2xx)
    consecutiveErrors: 0,
    // Current operating mode
    mode: 'layer0',  // 'layer0' | 'sponsor' | 'recovering'
    // Sponsor info (set when mode === 'sponsor')
    sponsor: null,
    sponsorCost: 0,
    failoverAt: null,
    totalSponsorCost: 0,
    // Recovery probe counter (increments on clean hits after failover)
    recoveryProbes: 0,
    // Timestamp of last hit
    lastHitAt: 0,
    lastStatus: 0,
    lastLatencyMs: 0,
  };
}

function getStore() {
  if (!globalThis.__mandateInfraHealth) {
    globalThis.__mandateInfraHealth = {};
    for (const path of TRACKED_PATHS) {
      globalThis.__mandateInfraHealth[path] = makeServiceState();
    }
  }
  return globalThis.__mandateInfraHealth;
}

// ─── WRITE ────────────────────────────────────────────────────────────────────

/**
 * Record a single request hit for a given path.
 * Called from withLabGlitch.js after each request completes.
 *
 * @param {string} path  - one of TRACKED_PATHS
 * @param {number} status - HTTP status code
 * @param {number} latencyMs
 */
export function recordServiceHit(path, status, latencyMs) {
  const store = getStore();
  const svc = store[path];
  if (!svc) return;

  const ok = status >= 200 && status < 400;
  const ms = Number(latencyMs) || 0;

  // Rolling window
  svc.window.push({ ok, latencyMs: ms });
  if (svc.window.length > WINDOW) svc.window.shift();

  // Consecutive error tracking
  if (ok) {
    svc.consecutiveErrors = 0;
    // A sponsor-mode service starts its recovery watch on its first clean hit —
    // nothing else transitions 'sponsor' -> 'recovering', so without this a
    // failed-over service would stay on sponsor forever even once Layer 0 heals.
    if (svc.mode === 'sponsor') {
      svc.mode = 'recovering';
      svc.recoveryProbes = 0;
    }
    if (svc.mode === 'recovering') svc.recoveryProbes += 1;
  } else {
    svc.consecutiveErrors += 1;
    // A failure mid-recovery means Layer 0 isn't actually stable yet — drop back
    // to sponsor and restart the clean-streak count on the next recovery attempt.
    if (svc.mode === 'recovering') svc.mode = 'sponsor';
    svc.recoveryProbes = 0;
  }

  svc.lastHitAt = Date.now();
  svc.lastStatus = status;
  svc.lastLatencyMs = ms;
}

/**
 * Activate sponsor mode for a path.
 * Called by the agent after a successful failover payment.
 */
export function markSponsorActive(path, sponsorName, costUsdc) {
  const store = getStore();
  const svc = store[path];
  if (!svc) return;
  svc.mode = 'sponsor';
  svc.sponsor = sponsorName;
  svc.sponsorCost = Number(costUsdc) || 0;
  svc.failoverAt = Date.now();
  svc.recoveryProbes = 0;
}

/**
 * Begin the recovery phase — watching for RECOVERY_N consecutive clean probes.
 * Called when the glitch is removed and Layer 0 starts responding again.
 */
export function startRecoveryMode(path) {
  const store = getStore();
  const svc = store[path];
  if (!svc || svc.mode !== 'sponsor') return;
  svc.mode = 'recovering';
  svc.recoveryProbes = 0;
}

/**
 * Return to Layer 0 after recovery is confirmed.
 * Called by the agent when recoveryProbes >= RECOVERY_N.
 */
export function markLayer0Recovered(path) {
  const store = getStore();
  const svc = store[path];
  if (!svc) return;
  svc.totalSponsorCost += svc.sponsorCost * (
    svc.failoverAt ? Math.ceil((Date.now() - svc.failoverAt) / 1000 / 60) : 1
  );
  svc.mode = 'layer0';
  svc.sponsor = null;
  svc.sponsorCost = 0;
  svc.failoverAt = null;
  svc.recoveryProbes = 0;
  svc.consecutiveErrors = 0;
}

// ─── READ ─────────────────────────────────────────────────────────────────────

/**
 * Compute derived health metrics for a single path.
 */
export function getServiceHealth(path) {
  const store = getStore();
  const svc = store[path];
  if (!svc) return null;

  const total = svc.window.length;
  const errors = svc.window.filter((h) => !h.ok).length;
  const avgLatencyMs = total
    ? Math.round(svc.window.reduce((s, h) => s + h.latencyMs, 0) / total)
    : 0;
  const errorRate = total ? errors / total : 0;

  const threshold = THRESHOLDS[path] || {};
  const sponsor = SPONSOR_MAP[path] || {};

  // Severity evaluation
  let severity = 'ok';
  if (
    svc.consecutiveErrors >= (threshold.consecutiveErrors || 3) ||
    errorRate > (threshold.errorRate || 0.30)
  ) {
    severity = 'critical';
  } else if (avgLatencyMs > (threshold.avgLatencyMs || 1500)) {
    severity = 'slow';
  }

  return {
    path,
    mode: svc.mode,           // 'layer0' | 'sponsor' | 'recovering'
    severity,                 // 'ok' | 'slow' | 'critical'
    errorRate: Number(errorRate.toFixed(3)),
    avgLatencyMs,
    consecutiveErrors: svc.consecutiveErrors,
    recoveryProbes: svc.recoveryProbes,
    recoveryNeeded: RECOVERY_N,
    sponsor: svc.sponsor,
    sponsorCost: svc.sponsorCost,
    totalSponsorCost: Number(svc.totalSponsorCost.toFixed(6)),
    failoverAt: svc.failoverAt,
    lastHitAt: svc.lastHitAt,
    lastStatus: svc.lastStatus,
    lastLatencyMs: svc.lastLatencyMs,
    // From vendor map
    fallbackSponsor: sponsor.sponsor || null,
    fallbackCost: sponsor.costUsdc || 0,
    // Threshold breach flags
    needsFailover: severity === 'critical' && svc.mode === 'layer0',
    needsRecovery: svc.mode === 'recovering' && svc.recoveryProbes >= RECOVERY_N,
  };
}

/**
 * Returns health status for all tracked services.
 */
export function getAllHealth() {
  return TRACKED_PATHS.map((path) => getServiceHealth(path)).filter(Boolean);
}

/**
 * Reset all service states to initial (used for testing/reset button).
 */
export function resetInfraHealth() {
  globalThis.__mandateInfraHealth = null;
}
