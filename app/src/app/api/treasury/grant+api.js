import { ethers } from 'ethers';

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
    const agentAddress = process.env.MANDATE_AGENT_ADDRESS || process.env.EXPO_PUBLIC_MANDATE_AGENT_ADDRESS;
    const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;

    if (!privateKey) throw new Error('Missing MANDATE_TREASURY_PRIVATE_KEY');
    if (!agentAddress) throw new Error('Missing MANDATE_AGENT_ADDRESS');
    if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    const value = ethers.parseEther(amountUsdc.toFixed(6));
    const balance = await provider.getBalance(wallet.address);
    const fee = await provider.getFeeData();
    const gasPrice = fee.gasPrice || fee.maxFeePerGas || 0n;
    const gasCost = 21000n * gasPrice;

    if (balance < value + gasCost) {
      throw new Error('Treasury native USDC is insufficient for grant plus gas.');
    }

    const tx = await wallet.sendTransaction({ to: agentAddress, value });
    const receipt = await tx.wait();
    const txHash = receipt?.hash || tx.hash;
    const explorerBase = (process.env.ARC_EXPLORER_URL || 'https://testnet.arcscan.app').replace(/\/$/, '');

    return Response.json({
      txHash,
      from: wallet.address,
      to: agentAddress,
      amountUsdc,
      explorerUrl: `${explorerBase}/tx/${txHash}`
    });
  } catch (error) {
    console.error('[TREASURY_GRANT]', error);
    return Response.json({ error: error.message }, { status: 400 });
  }
}
