import { ethers } from 'ethers';
import { sendSponsoredTransfer } from '../../../server/erc4337';
import { checkRateLimit, rateLimitResponse } from '../../../utilsAPI/rateLimitGuard';

// This route is reachable directly from the browser (Mission Control's grant
// flow and the judge-facing Add User to Mandate screen both call it), so it
// can't rely on the caller being trustworthy. Bounded to the "$1 Survival
// Test" scale intentionally — a single call can never drain the whole
// treasury, regardless of what a client requests. Raise deliberately if the
// demo needs bigger grants, not by accident.
const MAX_GRANT_USDC = 5;

function parseGrantAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than $0 USDC.');
  }
  if (amount > MAX_GRANT_USDC) {
    throw new Error(`Amount exceeds the maximum single grant of $${MAX_GRANT_USDC} USDC.`);
  }
  return amount;
}

export async function POST(request) {
  try {
    // 20/5min, not 3/5min: this route is shared by two demo entry points
    // (Add User to Mandate onboarding + the demo-chat grant action), and at
    // a hackathon venue many judges testing from the same booth WiFi share
    // one public IP. The $5/call cap already bounds worst case to $100 per
    // window from a single IP — plenty tight against an automated drain
    // script, generous enough not to block real onboarding traffic.
    const { limited, retryAfterSeconds } = await checkRateLimit({
      request, route: 'treasury/grant', limit: 20, windowMs: 5 * 60 * 1000,
    });
    if (limited) return rateLimitResponse(retryAfterSeconds);

    const body = await request.json();
    const amountUsdc = parseGrantAmount(body?.amountUsdc);

    const privateKey = process.env.MANDATE_TREASURY_PRIVATE_KEY;
    const treasuryAddress = process.env.MANDATE_TREASURY_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_TREASURY_ADDRESS;
    const agentAddress = process.env.MANDATE_AGENT_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS;
    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;

    if (!privateKey) throw new Error('Missing MANDATE_TREASURY_PRIVATE_KEY');
    if (!treasuryAddress) throw new Error('Missing MANDATE_TREASURY_ADDRESS');
    if (!agentAddress) throw new Error('Missing MANDATE_AGENT_ADDRESS');
    if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const value = ethers.parseEther(amountUsdc.toFixed(6));
    const balance = await provider.getBalance(treasuryAddress);
    if (balance < value) {
      throw new Error('Treasury smart account has insufficient native USDC for this grant.');
    }

    const receipt = await sendSponsoredTransfer({
      ownerPrivateKey: privateKey,
      smartAccountAddress: treasuryAddress,
      to: agentAddress,
      amountUsdc,
      itemDescription: 'Treasury grant to Agent spend account',
    });

    return Response.json({
      txHash: receipt.txHash,
      from: treasuryAddress,
      to: agentAddress,
      amountUsdc,
      gasSponsored: true,
      explorerUrl: receipt.networkMeta?.explorerUrl,
    });
  } catch (error) {
    console.error('[TREASURY_GRANT]', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
