import { ethers } from 'ethers';
import { sendSponsoredTransfer } from '../../../server/erc4337';

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
 */
function parseAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('amountUsdc must be greater than $0 USDC.');
  }
  return amount;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const vendorWallet = String(body?.vendorWallet || '');
    const itemDescription = body?.itemDescription || 'Mandate agent vendor payment';
    const amountUsdc = parseAmount(body?.amountUsdc);

    if (!ethers.isAddress(vendorWallet)) {
      return Response.json({ error: 'Missing or invalid vendorWallet.' }, { status: 400 });
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
