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
import { pollInfraHealth, executeFailover, executeRecovery, beatOwnServices } from '../services/infraFailoverService.js';

const POLL_INTERVAL = 3000;
// One service touched per beat, round-robin over three, so each is checked
// roughly every 4.5s on its own — independent of whether anyone has the
// Traffic panel open. That lands detection (2-3 consecutive errors,
// per-path thresholds in constants/vendors.js) around 9-14s after a fault
// starts with nothing else running, and faster when the simulator is adding
// load on top.
const HEARTBEAT_INTERVAL = 1500;

export function useInfraHealth({ budget, budgetKnown, trafficRunning, onSpend, onFailoverEvent, onRecoveryEvent } = {}) {
  const [services, setServices] = useState([]);
  const [overallStatus, setOverallStatus] = useState('healthy');
  const [activeFailovers, setActiveFailovers] = useState(0);
  const [totalSponsorCost, setTotalSponsorCost] = useState(0);

  // Keep callback refs stable
  const onFailoverRef = useRef(onFailoverEvent);
  const onRecoveryRef = useRef(onRecoveryEvent);
  const budgetRef = useRef(budget);
  const budgetKnownRef = useRef(budgetKnown);
  const trafficRunningRef = useRef(trafficRunning);
  const onSpendRef = useRef(onSpend);

  useEffect(() => { onFailoverRef.current = onFailoverEvent; }, [onFailoverEvent]);
  useEffect(() => { onRecoveryRef.current = onRecoveryEvent; }, [onRecoveryEvent]);
  useEffect(() => { budgetRef.current = budget; }, [budget]);
  useEffect(() => { budgetKnownRef.current = budgetKnown; }, [budgetKnown]);
  useEffect(() => { trafficRunningRef.current = trafficRunning; }, [trafficRunning]);
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
        // Don't decide affordability against a budget we haven't read yet.
        // /api/treasury/balances is itself one of the paths a fault can break,
        // so the very first read can fail — and reasoning over the resulting
        // 0 made the agent refuse its only PAID sponsor (health → The Graph,
        // $0.00004) as unaffordable and post a "failover blocked" it then
        // contradicted seconds later. Free failovers still proceed
        // immediately, and one of those (balances → Arc RPC) is exactly what
        // restores the ability to read the budget.
        if (svc.fallbackCost > 0 && !budgetKnownRef.current) continue;

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

  // The agent's own pulse, on its own schedule — this is what makes its
  // awareness of Layer 0 independent of the Traffic Simulator. Chained
  // (not setInterval) so a slow beat can never stack up on the next one.
  useEffect(() => {
    let alive = true;
    let timer = null;

    // Stay quiet while the Traffic Simulator is running: it already exercises
    // every path constantly, so beating on top of it adds load for no signal
    // — enough of it, with the workers, to push past the edge's rate limit
    // and draw real 429s into the demo's own traffic log.
    //
    // Gated on the simulator's actual running state rather than on how long
    // ago each service was last hit. The obvious version of that check reads
    // lastHitAt out of the health payload, which comes from D1 — and D1's
    // read replicas lag exactly when write load is heaviest, so the freshness
    // signal goes stale precisely when traffic is heaviest, and the heartbeat
    // wakes up and piles on at the worst possible moment.
    const shouldBeat = () => !trafficRunningRef.current;

    const beat = async () => {
      if (!alive) return;
      await beatOwnServices(shouldBeat);
      if (alive) timer = setTimeout(beat, HEARTBEAT_INTERVAL);
    };

    beat();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return {
    services,
    overallStatus,
    activeFailovers,
    totalSponsorCost,
  };
}
