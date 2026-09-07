import { useCallback, useEffect, useRef, useState } from 'react';
import { TrafficLabService } from '../services/trafficLabService';

const EMPTY_STATS = {
  total: 0,
  ok: 0,
  errors: 0,
  timeouts: 0,
  avgLatencyMs: 0,
  lastLatencyMs: 0,
  lastPath: '—',
  rps: 0,
  byPath: {},
  events: [],
  glitch: { mode: 'off', latencyMs: 800 }
};

const INTENSITY_MS = { low: 700, medium: 280, high: 90 };

export function useTrafficLab() {
  const [running, setRunning] = useState(false);
  const [workerCount, setWorkerCount] = useState(3);
  const [intensity, setIntensity] = useState('medium');
  const [glitchMode, setGlitchMode] = useState('off');
  const [stats, setStats] = useState(EMPTY_STATS);
  const [error, setError] = useState('');
  const stopRef = useRef(null);

  const refreshStats = useCallback(async () => {
    try {
      const next = await TrafficLabService.fetchStats();
      setStats(next);
      if (next.glitch?.mode) setGlitchMode(next.glitch.mode);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    refreshStats();
    const id = setInterval(refreshStats, 900);
    return () => clearInterval(id);
  }, [refreshStats]);

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
          await TrafficLabService.probe({
            target: TrafficLabService.nextTarget(n),
            worker
          });
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
  }, [intensity, stopWorkers, workerCount]);

  useEffect(() => () => stopWorkers(), [stopWorkers]);

  const applyGlitch = useCallback(async (mode) => {
    try {
      const next = await TrafficLabService.setGlitch(mode, 800);
      setGlitchMode(next.mode);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const resetStats = useCallback(async () => {
    const next = await TrafficLabService.resetStats();
    setStats(next);
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
