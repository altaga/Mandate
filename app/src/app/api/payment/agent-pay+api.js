import { ethers } from 'ethers';
import { sendSponsoredTransfer } from '../../../server/erc4337';
import { VENDOR_CATALOG, SPONSOR_MAP } from '../../../constants/vendors';
import { checkRateLimit, rateLimitResponse } from '../../../utilsAPI/rateLimitGuard';

/**
 * @file agent-pay+api.js
 * @description Real, gas-sponsored ERC-4337 payment from the Mandate agent's
 * OWN smart-account spend wallet (MANDATE_AGENT_ADDRESS, owned by
 * MANDATE_AGENT_PRIVATE_KEY) to a vendor wallet. No Supabase lookup — the
 * agent already custodies its own signing key server-side. Gas is fronted by
 * the Paymaster Worker's own wallet, never the agent's.
 *
 * This is distinct from payment/execute+api.js, which signs on behalf of an
 * enrolled biometric POS customer (looked up in Supabase by wallet address) —
 * that path doesn't apply here, the agent is paying for its own infra/vendors.
 *
 * Bounded on purpose: this route is reachable from the browser (the demo chat
 * calls it directly), so a request here can't be trusted the way a truly
 * server-only caller could be. It only ever pays a recipient + amount that
 * appear in our own known catalog (VENDOR_CATALOG / SPONSOR_MAP) — never an
 * arbitrary address or amount a client happens to send.
 */
function parseAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amountUsdc must be greater than $0 USDC.');
  }
  return amount;
}

// Every address this route is allowed to pay, and the maximum USDC each may
// receive per call — sourced from the same catalog the agent's own decisions
// are made from, not from anything the client supplies.
function buildAllowlist() {
  const allowed = new Map();
  for (const v of Object.values(VENDOR_CATALOG)) {
    if (v.recipient) allowed.set(v.recipient.toLowerCase(), Number(v.costUsdc) || 0);
  }
  for (const s of Object.values(SPONSOR_MAP)) {
    if (s.recipient) {
      const existing = allowed.get(s.recipient.toLowerCase()) || 0;
      allowed.set(s.recipient.toLowerCase(), Math.max(existing, Number(s.costUsdc) || 0));
    }
  }
  return allowed;
}

export async function POST(request) {
  try {
    const { limited, retryAfterSeconds } = await checkRateLimit({
      request, route: 'payment/agent-pay', limit: 15, windowMs: 60 * 1000,
    });
    if (limited) return rateLimitResponse(retryAfterSeconds);

    const body = await request.json();
    const vendorWallet = String(body?.vendorWallet || '');
    const itemDescription = body?.itemDescription || 'Mandate agent vendor payment';
    const amountUsdc = parseAmount(body?.amountUsdc);

    if (!ethers.isAddress(vendorWallet)) {
      return Response.json({ error: 'Missing or invalid vendorWallet.' }, { status: 400 });
    }

    const allowlist = buildAllowlist();
    const maxAllowed = allowlist.get(vendorWallet.toLowerCase());
    if (maxAllowed === undefined) {
      return Response.json({ error: 'Recipient is not a known Mandate vendor or sponsor.' }, { status: 403 });
    }
    if (amountUsdc > maxAllowed) {
      return Response.json({ error: `Amount exceeds this vendor's listed cost of $${maxAllowed} USDC.` }, { status: 403 });
    }

    const privateKey = process.env.MANDATE_AGENT_PRIVATE_KEY;
    const smartAccountAddress = process.env.MANDATE_AGENT_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS;
    if (!privateKey) throw new Error('Missing MANDATE_AGENT_PRIVATE_KEY');
    if (!smartAccountAddress) throw new Error('Missing MANDATE_AGENT_ADDRESS');

    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;
    if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const balance = await provider.getBalance(smartAccountAddress);
    const value = ethers.parseEther(amountUsdc.toFixed(6));
    if (balance < value) {
      return Response.json({ error: 'Agent smart account has insufficient native USDC for this payment.' }, { status: 400 });
    }

    const receipt = await sendSponsoredTransfer({
      ownerPrivateKey: privateKey,
      smartAccountAddress,
      to: vendorWallet,
      amountUsdc,
      itemDescription,
    });

    return Response.json({
      txHash: receipt.txHash,
      from: smartAccountAddress,
      to: vendorWallet,
      amountUsdc,
      itemDescription,
      gasSponsored: true,
      explorerUrl: receipt.networkMeta?.explorerUrl,
    });
  } catch (error) {
    console.error('[AGENT_PAY]', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
