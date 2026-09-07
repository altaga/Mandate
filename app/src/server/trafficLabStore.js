const MODES = new Set(['off', 'latency', 'error', 'timeout']);

function getState() {
  if (!globalThis.__mandateTrafficLab) {
    globalThis.__mandateTrafficLab = {
      mode: 'off',
      latencyMs: 800,
      total: 0,
      ok: 0,
      errors: 0,
      timeouts: 0,
      latencySum: 0,
      lastLatencyMs: 0,
      lastPath: '—',
      lastStatus: 0,
      lastAt: 0,
      hits: [],
      events: [],
      byPath: {}
    };
  }
  return globalThis.__mandateTrafficLab;
}

function trimHits(now) {
  const state = getState();
  state.hits = state.hits.filter((t) => now - t < 5000);
}

export function getGlitch() {
  const state = getState();
  return { mode: state.mode, latencyMs: state.latencyMs };
}

export function setGlitch({ mode, latencyMs } = {}) {
  const state = getState();
  if (mode && MODES.has(mode)) state.mode = mode;
  if (Number.isFinite(Number(latencyMs)) && Number(latencyMs) >= 0) {
    state.latencyMs = Math.min(5000, Number(latencyMs));
  }
  return getGlitch();
}

export function recordHit({ path, status, latencyMs, ok, timeout, worker }) {
  const state = getState();
  const now = Date.now();
  const ms = Number(latencyMs) || 0;
  const key = path || 'unknown';
  state.total += 1;
  if (timeout) state.timeouts += 1;
  else if (ok) state.ok += 1;
  else state.errors += 1;
  state.latencySum += ms;
  state.lastLatencyMs = ms;
  state.lastPath = key;
  state.lastStatus = Number(status) || 0;
  state.lastAt = now;
  state.hits.push(now);
  trimHits(now);
  state.byPath[key] = (state.byPath[key] || 0) + 1;
  state.events.unshift({
    id: `${now}-${state.total}`,
    at: now,
    worker: worker || '—',
    path: key,
    status: Number(status) || 0,
    latencyMs: ms,
    ok: Boolean(ok),
    timeout: Boolean(timeout)
  });
  state.events = state.events.slice(0, 24);
}

export function getStats() {
  const state = getState();
  const now = Date.now();
  trimHits(now);
  return {
    glitch: getGlitch(),
    total: state.total,
    ok: state.ok,
    errors: state.errors,
    timeouts: state.timeouts,
    avgLatencyMs: state.total ? Math.round(state.latencySum / state.total) : 0,
    lastLatencyMs: state.lastLatencyMs,
    lastPath: state.lastPath,
    lastStatus: state.lastStatus,
    lastAt: state.lastAt,
    rps: Number((state.hits.length / 5).toFixed(2)),
    byPath: { ...state.byPath },
    events: [...state.events]
  };
}

export function resetStats() {
  const state = getState();
  state.total = 0;
  state.ok = 0;
  state.errors = 0;
  state.timeouts = 0;
  state.latencySum = 0;
  state.lastLatencyMs = 0;
  state.lastPath = '—';
  state.lastStatus = 0;
  state.lastAt = 0;
  state.hits = [];
  state.events = [];
  state.byPath = {};
}

export async function applyGlitch() {
  const state = getState();
  if (state.mode === 'latency') {
    await new Promise((r) => setTimeout(r, state.latencyMs));
    return { blocked: false };
  }
  if (state.mode === 'timeout') {
    await new Promise((r) => setTimeout(r, 12000));
    return { blocked: true, status: 504, timeout: true };
  }
  if (state.mode === 'error') {
    return { blocked: true, status: 503, timeout: false };
  }
  return { blocked: false };
}
