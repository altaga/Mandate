const ROUTES = {
  health: '/api/health',
  balances: '/api/treasury/balances',
  probe: '/api/traffic/probe'
};

const TARGETS = ['health', 'probe', 'balances'];

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

  async fetchStats() {
    const response = await fetch('/api/traffic/stats');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to read traffic stats');
    return data;
  },

  async setGlitch(mode, latencyMs) {
    const response = await fetch('/api/traffic/glitch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode, latencyMs })
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Failed to set glitch');
    return data;
  },

  async resetStats() {
    const response = await fetch('/api/traffic/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true })
    });
    return response.json();
  },

  nextTarget(index) {
    return TARGETS[index % TARGETS.length];
  }
};
