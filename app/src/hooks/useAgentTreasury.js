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
      setTreasury(0);
      setBudget(0);
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

  useEffect(() => {
    refresh();
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
