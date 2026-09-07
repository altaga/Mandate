/**
 * @file useInfraHealth.js
 * @description React hook that drives Mandate's autonomous infra resilience loop.
 *
 * Polls /api/infra/status every 3 s.
 * When a service crosses its threshold:
 *   → calls infraFailoverService.executeFailover() → real sponsor payment + call
 *   → emits event via onFailoverEvent callback
 * When a recovering service hits 5 clean probes:
 *   → calls infraFailoverService.executeRecovery()
 *   → emits event via onRecoveryEvent callback
 *
 * Returns:
 *   services[]       — current health of all 5 Layer 0 services
 *   overallStatus    — 'healthy' | 'degraded' | 'recovering'
 *   activeFailovers  — count of services on sponsor
 *   totalSponsorCost — cumulative USDC spent on sponsor fallbacks this session
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { pollInfraHealth, executeFailover, executeRecovery } from '../services/infraFailoverService.js';

const POLL_INTERVAL = 3000;

export function useInfraHealth({ budget, onSpend, onFailoverEvent, onRecoveryEvent } = {}) {
  const [services, setServices] = useState([]);
  const [overallStatus, setOverallStatus] = useState('healthy');
  const [activeFailovers, setActiveFailovers] = useState(0);
  const [totalSponsorCost, setTotalSponsorCost] = useState(0);

  // Keep callback refs stable
  const onFailoverRef = useRef(onFailoverEvent);
  const onRecoveryRef = useRef(onRecoveryEvent);
  const budgetRef = useRef(budget);
  const onSpendRef = useRef(onSpend);

  useEffect(() => { onFailoverRef.current = onFailoverEvent; }, [onFailoverEvent]);
  useEffect(() => { onRecoveryRef.current = onRecoveryEvent; }, [onRecoveryEvent]);
  useEffect(() => { budgetRef.current = budget; }, [budget]);
  useEffect(() => { onSpendRef.current = onSpend; }, [onSpend]);

  const poll = useCallback(async () => {
    const data = await pollInfraHealth();
    if (!data || !data.services) return;

    setServices(data.services);
    setOverallStatus(data.overallStatus || 'healthy');
    setActiveFailovers(data.summary?.activeFailovers || 0);
    setTotalSponsorCost(data.summary?.totalSponsorCost || 0);

    for (const svc of data.services) {
      // ── Needs failover ──────────────────────────────────────────────────────
      if (svc.needsFailover) {
        const event = await executeFailover(svc, budgetRef.current || 0, onSpendRef.current);
        if (event && onFailoverRef.current) {
          onFailoverRef.current(event);
        }
      }

      // ── Recovery confirmed ──────────────────────────────────────────────────
      if (svc.needsRecovery) {
        const event = await executeRecovery(svc, budgetRef.current || 0);
        if (event && onRecoveryRef.current) {
          onRecoveryRef.current(event);
        }
      }
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let timer = null;

    const tick = async () => {
      if (!alive) return;
      await poll();
      if (alive) timer = setTimeout(tick, POLL_INTERVAL);
    };

    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [poll]);

  return {
    services,
    overallStatus,
    activeFailovers,
    totalSponsorCost,
  };
}
