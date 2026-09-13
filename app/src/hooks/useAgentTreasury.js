import { useCallback, useEffect, useState } from 'react';
import { ArcService } from '../services/arcService';
import { CONFIG } from '../constants/config';

export function useAgentTreasury() {
  const [address, setAddress] = useState(CONFIG.ARC_NETWORK.TREASURY_ADDRESS);
  const [agentAddress, setAgentAddress] = useState(CONFIG.ARC_NETWORK.AGENT_ADDRESS);
  const [treasury, setTreasury] = useState(0);
  const [budget, setBudget] = useState(0);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [lastRefresh, setLastRefresh] = useState(null);

  const refresh = useCallback(async () => {
    setStatus((prev) => (prev === 'ready' || prev === 'empty' ? prev : 'loading'));
    const result = await ArcService.fetchMandateBalances();
    if (result.error) {
      // A failed read means "couldn't check right now", NOT "the money is
      // gone" — so keep the last known figures instead of zeroing them.
      // /api/treasury/balances is one of the first-party paths the Fault
      // Injector can break, and zeroing here had a nasty consequence:
      // reading $0 budget made the agent's own reasoning refuse the only
      // failover that costs money (health → The Graph, $0.00004) as
      // unaffordable, so the one path with a paid sponsor could never
      // recover while the fault was up. Confirmed directly — health sat at
      // mode 'first-party' with consecutive errors climbing indefinitely while
      // the free failovers went through fine.
      setStatus('error');
      setError(result.error);
      return;
    }
    setAddress(result.treasuryAddress || CONFIG.ARC_NETWORK.TREASURY_ADDRESS);
    setAgentAddress(result.agentAddress || CONFIG.ARC_NETWORK.AGENT_ADDRESS);
    setTreasury(Number(result.treasuryUsdc) || 0);
    setBudget(Number(result.agentUsdc) || 0);
    setError('');
    setLastRefresh(Date.now());
    setStatus((Number(result.treasuryUsdc) || 0) > 0 ? 'ready' : 'empty');
  }, []);

  // Refreshed once on mount only, this went stale the moment anything went
  // wrong: one failed read (or one real grant/spend elsewhere) and the
  // displayed balances — and the budget the agent reasons against — stayed
  // wrong for the rest of the session. Chained, not setInterval, so a slow
  // read can't stack up on the next one.
  useEffect(() => {
    let alive = true;
    let timer = null;
    const tick = async () => {
      if (!alive) return;
      await refresh();
      if (alive) timer = setTimeout(tick, 15000);
    };
    tick();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [refresh]);

  const confirmGrant = useCallback((amount) => {
    const n = Number(amount) || 0;
    setBudget((b) => Number((b + n).toFixed(4)));
    setTreasury((t) => Math.max(0, Number((t - n).toFixed(4))));
  }, []);

  const spend = useCallback((amt) => {
    const n = Number(amt) || 0;
    setBudget((b) => Math.max(0, Number((b - n).toFixed(4))));
  }, []);

  const refund = useCallback((amt) => {
    const n = Number(amt) || 0;
    setBudget((b) => Number((b + n).toFixed(4)));
  }, []);

  const topUp = useCallback((amt) => {
    const n = Number(amt) || 0;
    const granted = Math.min(n, Math.max(0, treasury));
    if (granted <= 0) return 0;
    setBudget((b) => Number((b + granted).toFixed(4)));
    setTreasury((t) => Math.max(0, Number((t - granted).toFixed(4))));
    return granted;
  }, [treasury]);

  return {
    address,
    agentAddress,
    treasury,
    budget,
    // Whether `budget` reflects a balance we have actually read, as opposed
    // to the initial 0. Callers that gate spending decisions on it need the
    // difference: "I have no budget" and "I haven't been able to check yet"
    // lead to opposite correct actions.
    budgetKnown: lastRefresh != null,
    unallocated: Math.max(0, Number(treasury.toFixed(4))),
    status,
    error,
    lastRefresh,
    isRefreshing: status === 'loading' && lastRefresh != null,
    refresh,
    confirmGrant,
    spend,
    refund,
    topUp
  };
}
