import { useCallback, useEffect, useRef, useState } from 'react';
import { TrafficLabService } from '../services/trafficLabService';

const EMPTY_STATS = {
  total: 0,
  ok: 0,
  errors: 0,
  timeouts: 0,
  throttled: 0,
  avgLatencyMs: 0,
  lastLatencyMs: 0,
  lastPath: '—',
  lastStatus: 0,
  rps: 0,
  byPath: {},
  events: [],
};

const INTENSITY_MS = { low: 700, medium: 280, high: 90 };
const RECENT_EVENTS = 24;
const RPS_WINDOW_MS = 5000;

export function useTrafficLab() {
  const [running, setRunning] = useState(false);
  const [workerCount, setWorkerCount] = useState(3);
  const [intensity, setIntensity] = useState('medium');
  const [glitchMode, setGlitchMode] = useState('off');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [error, setError] = useState('');
  const stopRef = useRef(null);

  // The panel's own counters (total/ok/fail/RPS/live log) used to come from
  // re-reading an aggregate over the shared traffic_hits D1 table every
  // 900ms. Under real concurrent write load (workers firing, plus the
  // agent's own reasoning/payment/status traffic hitting the same database)
  // that read was landing on a lagging D1 read replica — confirmed directly
  // by tracing the network: individual traffic requests were completing
  // successfully in real time while the displayed TOTAL sat frozen for
  // 20-25+ seconds, then jumped by the full missed amount all at once once
  // the replica caught up. That's a replica-consistency limit of D1's REST
  // API under heavy writes, not a query or timeout bug — no amount of query
  // batching fixes a stale read.
  //
  // Fix: every worker already gets its own request's real outcome directly
  // (it awaited the fetch) — accumulate the displayed stats from that,
  // client-side, instead of re-deriving them from a shared table read. This
  // trades "correct across every browser tab watching the demo" (never
  // actually needed here — it's a single-viewer panel) for "always reflects
  // what this tab's own requests actually did," which is immune to replica
  // lag by construction.
  const accRef = useRef({ total: 0, ok: 0, errors: 0, timeouts: 0, throttled: 0, latencySum: 0, byPath: {}, events: [], hitTimes: [] });

  const recordLocalHit = useCallback((result, worker) => {
    const acc = accRef.current;
    acc.total += 1;
    // A throttled hit is the hosting plan's rate limit, not the service
    // failing — kept out of the failure count so a hosting ceiling can't
    // read as the injected fault's work.
    if (result.throttled) acc.throttled += 1;
    else if (result.timeout) acc.timeouts += 1;
    else if (result.ok) acc.ok += 1;
    else acc.errors += 1;
    acc.latencySum += Number(result.latencyMs) || 0;
    acc.byPath[result.target] = (acc.byPath[result.target] || 0) + 1;

    const now = Date.now();
    acc.hitTimes.push(now);
    acc.hitTimes = acc.hitTimes.filter((t) => now - t <= RPS_WINDOW_MS);

    acc.events = [
      { id: `${now}-${Math.random().toString(36).slice(2, 8)}`, worker, path: result.target, status: result.status, latencyMs: result.latencyMs, ok: result.ok, timeout: result.timeout, throttled: result.throttled },
      ...acc.events,
    ].slice(0, RECENT_EVENTS);

    if (result.throttled) {
      setError('Hosting rate limit reached (EAS free tier) — lower the worker count or intensity. Not a first-party fault.');
    }

    setStats({
      total: acc.total,
      ok: acc.ok,
      errors: acc.errors,
      timeouts: acc.timeouts,
      throttled: acc.throttled,
      avgLatencyMs: acc.total ? Math.round(acc.latencySum / acc.total) : 0,
      lastLatencyMs: result.latencyMs,
      lastPath: result.target,
      lastStatus: result.status,
      rps: Number((acc.hitTimes.length / (RPS_WINDOW_MS / 1000)).toFixed(2)),
      byPath: { ...acc.byPath },
      events: acc.events,
    });
  }, []);

  // Glitch mode itself lives in a single small row (traffic_glitch), rarely
  // written — a plain poll of it isn't subject to the same replica-lag
  // problem, so this still goes to the server. Same stale-response race
  // guard as before: a response only applies if newer than the last one
  // actually APPLIED, not just the last one issued.
  const glitchSeqRef = useRef(0);
  const glitchAppliedRef = useRef(0);

  const pollGlitchMode = useCallback(async () => {
    const ticket = ++glitchSeqRef.current;
    try {
      const next = await TrafficLabService.fetchGlitchMode();
      if (next?.mode && ticket > glitchAppliedRef.current) {
        glitchAppliedRef.current = ticket;
        setGlitchMode(next.mode);
      }
    } catch (err) {
      console.warn('[useTrafficLab] glitch poll failed:', err.message);
    }
  }, []);

  useEffect(() => {
    pollGlitchMode();
    const id = setInterval(pollGlitchMode, 2000);
    return () => clearInterval(id);
  }, [pollGlitchMode]);

  const stopWorkers = useCallback(() => {
    if (stopRef.current) stopRef.current.abort();
    stopRef.current = null;
    setRunning(false);
  }, []);

  const startWorkers = useCallback(() => {
    stopWorkers();
    const ac = new AbortController();
    stopRef.current = ac;
    setRunning(true);
    const count = Math.min(8, Math.max(1, Number(workerCount) || 1));
    const delayMs = INTENSITY_MS[intensity] || INTENSITY_MS.medium;

    Array.from({ length: count }).forEach((_, index) => {
      const worker = `agent-${index + 1}`;
      const loop = async () => {
        let n = index;
        while (!ac.signal.aborted) {
          const target = TrafficLabService.nextTarget(n);
          const result = await TrafficLabService.probe({ target, worker });
          if (!ac.signal.aborted) recordLocalHit(result, worker);
          n += 1;
          await new Promise((resolve) => {
            const t = setTimeout(resolve, delayMs);
            ac.signal.addEventListener('abort', () => {
              clearTimeout(t);
              resolve();
            }, { once: true });
          });
        }
      };
      loop();
    });
  }, [intensity, stopWorkers, workerCount, recordLocalHit]);

  useEffect(() => () => stopWorkers(), [stopWorkers]);

  const applyGlitch = useCallback(async (mode) => {
    const ticket = ++glitchSeqRef.current;
    try {
      const next = await TrafficLabService.setGlitch(mode, 800);
      if (ticket > glitchAppliedRef.current) {
        glitchAppliedRef.current = ticket;
        setGlitchMode(next.mode);
      }
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const resetStats = useCallback(() => {
    accRef.current = { total: 0, ok: 0, errors: 0, timeouts: 0, throttled: 0, latencySum: 0, byPath: {}, events: [], hitTimes: [] };
    setStats(EMPTY_STATS);
    setError('');
    // Best-effort: also clear the shared D1 counters so other viewers /
    // Internal Services' byPath cards aren't left showing this session's
    // stale totals. Not awaited for the display — that's already reset
    // above, immediately, regardless of how long this round-trip takes.
    TrafficLabService.resetStats().catch(() => {});
  }, []);

  return {
    running,
    workerCount,
    setWorkerCount,
    intensity,
    setIntensity,
    glitchMode,
    stats,
    error,
    startWorkers,
    stopWorkers,
    applyGlitch,
    resetStats
  };
}
