import { ethers } from 'ethers';

/**
 * @file agent-pay+api.js
 * @description Real on-chain payment from the Mandate agent's OWN prepaid spend
 * account (MANDATE_AGENT_PRIVATE_KEY, funded by treasury/grant+api.js) directly
 * to a vendor wallet. No Supabase lookup — the agent already custodies its own
 * signing key server-side, same pattern as treasury/grant+api.js.
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
    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;
    if (!privateKey) throw new Error('Missing MANDATE_AGENT_PRIVATE_KEY');
    if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const value = ethers.parseEther(amountUsdc.toFixed(6));
    const balance = await provider.getBalance(wallet.address);
    const fee = await provider.getFeeData();
    const gasPrice = fee.gasPrice || fee.maxFeePerGas || 0n;
    const gasCost = 21000n * gasPrice;

    if (balance < value + gasCost) {
      return Response.json({ error: 'Agent spend account has insufficient native USDC for this payment plus gas.' }, { status: 400 });
    }

    const tx = await wallet.sendTransaction({ to: vendorWallet, value });
    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;
    const explorerBase = (process.env.ARC_EXPLORER_URL || 'https://testnet.arcscan.app').replace(/\/$/, '');

    return Response.json({
      txHash,
      from: wallet.address,
      to: vendorWallet,
      amountUsdc,
      itemDescription,
      explorerUrl: `${explorerBase}/tx/${txHash}`,
    });
  } catch (error) {
    console.error('[AGENT_PAY]', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
