import { ethers } from 'ethers';
import { sendSponsoredTransfer } from '../../../server/erc4337';

function parseGrantAmount(raw) {
  const amount = Number(raw);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Amount must be greater than $0 USDC.');
  }
  return amount;
}

export async function POST(request) {
  try {
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
