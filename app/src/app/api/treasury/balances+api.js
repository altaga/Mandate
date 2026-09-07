import { ethers } from 'ethers';
import { withLabGlitch } from '../../../server/withLabGlitch';

function toUsdc(wei) {
  // 6 decimals so sub-cent sponsor payments ($0.00004, $0.0008, ...) are
  // actually visible in the real on-chain balance instead of rounding to $0.00.
  return Number(Number(ethers.formatEther(wei)).toFixed(6));
}

// This IS the "Arc direct RPC" sponsor implementation (SPONSOR_MAP.balances) —
// a raw eth_getBalance call bypassing any Expo-side simulation. Glitch only
// ever intercepts BEFORE this runs, so once failed-over there's nothing extra
// to build: re-running this same real handler as the sponsor fallback in
// withLabGlitch is the correct fix, not a duplicate.
async function fetchRealBalances() {
  try {
    const treasuryAddress = process.env.MANDATE_TREASURY_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_TREASURY_ADDRESS;
    const agentAddress = process.env.MANDATE_AGENT_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS;
    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;

    if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');
    if (!treasuryAddress) throw new Error('Missing MANDATE_TREASURY_ADDRESS');
    if (!agentAddress) throw new Error('Missing MANDATE_AGENT_ADDRESS');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const [treasuryWei, agentWei] = await Promise.all([
      provider.getBalance(treasuryAddress),
      provider.getBalance(agentAddress)
    ]);

    return Response.json({
      treasuryAddress,
      agentAddress,
      treasuryUsdc: toUsdc(treasuryWei),
      agentUsdc: toUsdc(agentWei)
    });
  } catch (error) {
    console.error('[TREASURY_BALANCES]', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}

export async function GET(request) {
  return withLabGlitch(request, 'balances', fetchRealBalances, fetchRealBalances);
}
