// Server-only: real on-chain verification that a submitted x402 payment tx
// actually pays a given vendor's cost to that vendor's own address, plus
// replay protection so one real payment can't be reused across many
// requests. Every Mandate payment (agent-pay, treasury/grant) is an ERC-4337
// UserOperation submitted to the shared EntryPoint via handleOps() — the
// top-level tx.to is the EntryPoint, not the vendor, and the real
// recipient/amount are wrapped inside the UserOp's callData
// (SimpleAccount.execute(dest, value, func)). Decoding that nested calldata
// with plain ethers.js (unlike AssemblyScript's ethereum.decode(), which the
// subgraph mapping had to work around by hand) is straightforward.

import { ethers } from 'ethers';

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const ENTRY_POINT_ABI = [
  'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
];
const ACCOUNT_ABI = ['function execute(address dest, uint256 value, bytes func)'];

const D1_DATABASE_ID = '15fa0b96-c498-402f-a4e5-361576b4a490';

async function queryD1(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('Replay-protection store is not configured (missing Cloudflare credentials).');
  }
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    const message = data.errors?.[0]?.message || '';
    if (/unique constraint/i.test(message)) {
      const err = new Error('duplicate');
      err.isDuplicate = true;
      throw err;
    }
    throw new Error('Replay-protection store query failed.');
  }
  return data.result?.[0] || {};
}

/**
 * Throws if paymentTx does not represent a real, successful Mandate
 * UserOperation paying at least vendor.costUsdc to vendor.recipient, or if
 * it has already been redeemed for a previous request.
 */
export async function verifyRealVendorPayment(paymentTx, vendor) {
  if (!ethers.isHexString(paymentTx, 32)) {
    throw new Error('paymentTx must be a real transaction hash.');
  }

  const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL || 'https://rpc.testnet.arc.network';
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const [receipt, tx] = await Promise.all([
    provider.getTransactionReceipt(paymentTx),
    provider.getTransaction(paymentTx),
  ]);

  if (!receipt || !tx) throw new Error('Transaction hash not found on the Arc Testnet.');
  if (receipt.status !== 1) throw new Error('Transaction was reverted or failed.');
  if (!tx.to || tx.to.toLowerCase() !== ENTRY_POINT_ADDRESS.toLowerCase()) {
    throw new Error('Transaction did not call the Mandate EntryPoint — not a real Mandate payment.');
  }

  const entryPointInterface = new ethers.Interface(ENTRY_POINT_ABI);
  const accountInterface = new ethers.Interface(ACCOUNT_ABI);

  let ops;
  try {
    [ops] = entryPointInterface.decodeFunctionData('handleOps', tx.data);
  } catch {
    throw new Error('Could not decode transaction as a Mandate UserOperation.');
  }

  const recipientLower = vendor.recipient.toLowerCase();
  const minValue = ethers.parseEther(Number(vendor.costUsdc).toFixed(6));

  const paysThisVendor = ops.some((op) => {
    try {
      const [dest, value] = accountInterface.decodeFunctionData('execute', op.callData);
      return dest.toLowerCase() === recipientLower && BigInt(value) >= minValue;
    } catch {
      return false;
    }
  });

  if (!paysThisVendor) {
    throw new Error(`Transaction does not pay at least ${vendor.costUsdc} USDC to ${vendor.name}'s address.`);
  }

  // Replay check: INSERT fails on the tx_hash PRIMARY KEY if it was already
  // redeemed for a previous request — atomic at the DB level, so two
  // concurrent requests reusing the same hash can't both win.
  const usedAt = Date.now();
  try {
    await queryD1(
      'INSERT INTO used_payments (tx_hash, vendor_id, used_at) VALUES (?, ?, ?)',
      [paymentTx.toLowerCase(), vendor.id, usedAt]
    );
  } catch (err) {
    if (err.isDuplicate) {
      throw new Error('This payment has already been redeemed for a previous request.');
    }
    throw err;
  }
}
