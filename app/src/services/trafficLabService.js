const ROUTES = {
  health: '/api/health',
  balances: '/api/treasury/balances',
  probe: '/api/traffic/probe'
};

// The simulator exists to put load on the services being chaos-tested and
// show what the fault does to them. 'balances' is deliberately excluded from
// the fault (it's how the agent reads its own budget — see FAULTABLE_PATHS in
// withLabGlitch.js), so including it here only diluted the log with rows that
// stay green no matter what the Fault Injector is set to.
const TARGETS = ['health', 'probe'];

export const TrafficLabService = {
  async probe({ target, worker, timeoutMs = 4000 }) {
    const route = ROUTES[target] || ROUTES.health;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const started = Date.now();
    const url = target === 'probe' ? `${route}?worker=${encodeURIComponent(worker)}` : route;
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'x-traffic-lab': '1',
          'x-traffic-worker': String(worker)
        }
      });
      const data = await response.json().catch(() => ({}));
      return {
        ok: response.ok,
        status: response.status,
        latencyMs: data.latencyMs ?? (Date.now() - started),
        target,
        timeout: false
      };
    } catch (error) {
      const timeout = error?.name === 'AbortError';
      return {
        ok: false,
        status: timeout ? 504 : 0,
        latencyMs: Date.now() - started,
        target,
        timeout
      };
    } finally {
      clearTimeout(timer);
    }
  },

  // A deploy cutover / cold start can briefly return an HTML edge error page
  // instead of JSON — response.json() then throws a raw
  // "Unexpected token '<'..." SyntaxError, which used to surface verbatim in
  // the panel's error banner. Parse defensively and raise a readable message
  // instead, the same way probe() above already handles it.
  async fetchStats() {
    // No timeout here used to mean a slow/stuck D1 round-trip on the server
    // could leave this fetch hanging well past the next 900ms poll tick —
    // confirmed directly: the panel froze on stale numbers for 20+ seconds
    // during the busiest recovery window, with no error shown at all
    // (nothing ever rejected to hit the catch below). A hard timeout means a
    // slow poll gets abandoned and the next tick gets a clean shot instead.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    let response;
    try {
      response = await fetch('/api/traffic/stats', { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Traffic stats temporarily unavailable');
    }
    if (!response.ok) throw new Error(data.error || 'Failed to read traffic stats');
    return data;
  },

  // Cheap single-row read (traffic_glitch, not the write-heavy traffic_hits
  // table) — used for a lightweight poll instead of the full fetchStats()
  // aggregate, which was firing far more often than the fault mode itself
  // ever actually changes.
  async fetchGlitchMode() {
    const response = await fetch('/api/traffic/glitch');
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Glitch state temporarily unavailable');
    }
    if (!response.ok) throw new Error(data.error || 'Failed to read glitch state');
    return data;
  },

  async setGlitch(mode, latencyMs) {
    const response = await fetch('/api/traffic/glitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, latencyMs })
    });
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('Server temporarily unavailable — try again');
    }
    if (!response.ok) throw new Error(data.error || 'Failed to set glitch');
    return data;
  },

  async resetStats() {
    const response = await fetch('/api/traffic/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true })
    });
    try {
      return await response.json();
    } catch {
      throw new Error('Server temporarily unavailable — try again');
    }
  },

  nextTarget(index) {
    return TARGETS[index % TARGETS.length];
  }
};
