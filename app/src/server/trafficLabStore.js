/**
 * @file trafficLabStore.js
 * @description Traffic Simulator + Glitch Injector state for Mandate.
 *
 * Was globalThis-backed — correct only if every request in a session hits
 * the same Node.js process. EAS Hosting doesn't guarantee that, so the live
 * counters could non-deterministically show 0 while real faults were
 * genuinely happening (reproduced directly: 65 real 503s in the browser
 * console while the panel read "0 failures"). Now backed by D1 so every
 * instance reads/writes the same state.
 */

import { queryD1, queryD1Async } from './d1Client.js';

const MODES = new Set(['off', 'latency', 'error', 'timeout']);
const GLITCH_ROW_ID = 'current';
const RECENT_EVENTS = 24;
const RPS_WINDOW_MS = 5000;

export async function getGlitch() {
  const rows = await queryD1('SELECT mode, latency_ms FROM traffic_glitch WHERE id = ?', [GLITCH_ROW_ID]);
  if (!rows || !rows.length) return { mode: 'off', latencyMs: 800 };
  return { mode: rows[0].mode, latencyMs: rows[0].latency_ms };
}

export async function setGlitch({ mode, latencyMs } = {}) {
  const current = await getGlitch();
  const nextMode = mode && MODES.has(mode) ? mode : current.mode;
  const nextLatency = Number.isFinite(Number(latencyMs)) && Number(latencyMs) >= 0
    ? Math.min(5000, Number(latencyMs))
    : current.latencyMs;

  await queryD1(
    `INSERT INTO traffic_glitch (id, mode, latency_ms) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET mode = excluded.mode, latency_ms = excluded.latency_ms`,
    [GLITCH_ROW_ID, nextMode, nextLatency]
  );
  return { mode: nextMode, latencyMs: nextLatency };
}

// Must be awaited, not fire-and-forget: EAS Hosting's runtime can freeze or
// tear down the function as soon as the Response is returned, which was
// silently dropping every un-awaited write here (confirmed directly — a
// real faulted request returned a real 503, but /api/traffic/stats read
// back total:0 afterward). A few tens of ms of added latency on lab-traffic
// requests is the correct trade for the counters actually being real.
export async function recordHit({ path, status, latencyMs, ok, timeout, worker }) {
  await queryD1(
    `INSERT INTO traffic_hits (created_at, path, status, latency_ms, ok, is_timeout, worker)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [Date.now(), path || 'unknown', Number(status) || 0, Number(latencyMs) || 0, ok ? 1 : 0, timeout ? 1 : 0, worker || '—']
  );
  // Cheap, probabilistic cleanup so this append-only log doesn't grow forever
  // across a long demo session — fire-and-forget is fine here since nothing
  // downstream depends on it completing before the response returns.
  if (Math.random() < 0.02) {
    queryD1Async('DELETE FROM traffic_hits WHERE created_at < ?', [Date.now() - 30 * 60 * 1000]);
  }
}

// Polled every 900ms by the client — was firing 5 concurrent D1 REST calls
// per invocation (getGlitch, an aggregate query, an RPS-window query, a
// per-path GROUP BY, and the recent-events query). Under real load (workers
// firing, plus the agent's own reasoning/payment/status traffic all hitting
// D1 concurrently too) this was confirmed directly to make the traffic
// panel's numbers freeze solid for 20+ seconds at a time — precisely during
// the busiest window, when the fault was live and the agent was failing 3
// paths over. Same root cause as the /api/infra/status fix: too many
// concurrent D1 REST calls, not a broken query. Collapsing the three
// traffic_hits queries into one conditional-aggregation query (the RPS
// window and the 3 known lab targets — health/probe/balances, matching
// TrafficLabService.TARGETS — as CASE-summed columns) cuts this from 5
// round trips to 3.
export async function getStats() {
  const now = Date.now();

  const [glitch, aggRows, eventRows] = await Promise.all([
    getGlitch(),
    queryD1(
      `SELECT
        COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN is_timeout = 1 THEN 1 ELSE 0 END), 0) AS timeouts,
        COALESCE(SUM(CASE WHEN is_timeout = 0 AND ok = 1 THEN 1 ELSE 0 END), 0) AS ok,
        COALESCE(SUM(CASE WHEN is_timeout = 0 AND ok = 0 THEN 1 ELSE 0 END), 0) AS errors,
        COALESCE(AVG(latency_ms), 0) AS avg_latency_ms,
        COALESCE(SUM(CASE WHEN created_at > ? THEN 1 ELSE 0 END), 0) AS recent_count,
        COALESCE(SUM(CASE WHEN path = 'health' THEN 1 ELSE 0 END), 0) AS path_health,
        COALESCE(SUM(CASE WHEN path = 'probe' THEN 1 ELSE 0 END), 0) AS path_probe,
        COALESCE(SUM(CASE WHEN path = 'balances' THEN 1 ELSE 0 END), 0) AS path_balances
      FROM traffic_hits`,
      [now - RPS_WINDOW_MS]
    ),
    queryD1(
      `SELECT id, created_at, path, status, latency_ms, ok, is_timeout, worker
       FROM traffic_hits ORDER BY id DESC LIMIT ?`,
      [RECENT_EVENTS]
    ),
  ]);

  const agg = aggRows?.[0] || { total: 0, ok: 0, errors: 0, timeouts: 0, avg_latency_ms: 0, recent_count: 0, path_health: 0, path_probe: 0, path_balances: 0 };
  const last = eventRows?.[0] || null;
  const byPath = {
    health: Number(agg.path_health) || 0,
    probe: Number(agg.path_probe) || 0,
    balances: Number(agg.path_balances) || 0,
  };

  return {
    glitch,
    total: Number(agg.total) || 0,
    ok: Number(agg.ok) || 0,
    errors: Number(agg.errors) || 0,
    timeouts: Number(agg.timeouts) || 0,
    avgLatencyMs: Math.round(Number(agg.avg_latency_ms) || 0),
    lastLatencyMs: last ? last.latency_ms : 0,
    lastPath: last ? last.path : '—',
    lastStatus: last ? last.status : 0,
    lastAt: last ? last.created_at : 0,
    rps: Number(((Number(agg.recent_count) || 0) / (RPS_WINDOW_MS / 1000)).toFixed(2)),
    byPath,
    events: (eventRows || []).map((row) => ({
      id: `${row.created_at}-${row.id}`,
      at: row.created_at,
      worker: row.worker || '—',
      path: row.path,
      status: row.status,
      latencyMs: row.latency_ms,
      ok: Boolean(row.ok),
      timeout: Boolean(row.is_timeout),
    })),
  };
}

export async function resetStats() {
  await queryD1('DELETE FROM traffic_hits');
}

export async function applyGlitch() {
  const glitch = await getGlitch();
  if (glitch.mode === 'latency') {
    await new Promise((r) => setTimeout(r, glitch.latencyMs));
    return { blocked: false };
  }
  if (glitch.mode === 'timeout') {
    await new Promise((r) => setTimeout(r, 12000));
    return { blocked: true, status: 504, timeout: true };
  }
  if (glitch.mode === 'error') {
    return { blocked: true, status: 503, timeout: false };
  }
  return { blocked: false };
}
