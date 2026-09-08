import { ethers } from 'ethers';

/**
 * @file erc4337.js
 * @description Shared ERC-4337 UserOperation construction for Mandate's own
 * smart-account wallets (Treasury, Agent) — same mechanism as the POS
 * checkout flow in payment/execute+api.js, minus the Supabase-enrolled-user
 * lookup: here the signing key is one of Mandate's own owner keys
 * (MANDATE_TREASURY_PRIVATE_KEY / MANDATE_AGENT_PRIVATE_KEY), not a
 * customer's biometrically-enrolled agent_key.
 *
 * Gas is sponsored for real: the Paymaster Worker (a separate deployed
 * Cloudflare Worker, app/paymaster-worker/) submits the signed UserOp as the
 * bundler and deposits ETH into the EntryPoint on the smart account's behalf
 * from ITS OWN wallet (MANDATE_PAYMASTER_PRIVATE_KEY) — the owner key here
 * only ever signs, it never pays gas or submits a transaction directly.
 */

const ENTRY_POINT_ADDRESS = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
const FACTORY_ADDRESS = process.env.ARC_ACCOUNT_FACTORY || '0x9406Cc6185a346906296840746125a0E44976454';
const PAYMASTER_WORKER_URL = process.env.PAYMASTER_WORKER_URL
  || 'https://mandate-x402-paymaster.mandate-x402-fkqggy.workers.dev/';

const ENTRY_POINT_ABI = [
  'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
  'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)',
];
const ACCOUNT_ABI = ['function execute(address dest, uint256 value, bytes func)'];
const FACTORY_ABI = ['function createAccount(address owner, uint256 salt) returns (address)'];

/**
 * Sends a real, gas-sponsored native-token transfer FROM one of Mandate's own
 * ERC-4337 smart accounts (Treasury or Agent) to any destination address, by
 * building + signing a UserOperation and submitting it to the Paymaster
 * Worker bundler.
 *
 * @param {string} ownerPrivateKey   - signing key for the smart account owner
 * @param {string} smartAccountAddress - the smart account's own address (sender)
 * @param {string} to                - destination address
 * @param {number} amountUsdc        - native-token amount (this app treats
 *                                     native Arc token as "USDC")
 * @param {string} itemDescription   - human-readable memo for the receipt
 */
export async function sendSponsoredTransfer({ ownerPrivateKey, smartAccountAddress, to, amountUsdc, itemDescription }) {
  const rpcUrl = process.env.ARC_RPC_URL || process.env.EXPO_PUBLIC_ARC_RPC_URL;
  if (!rpcUrl) throw new Error('Missing ARC_RPC_URL');
  if (!ethers.isAddress(smartAccountAddress)) throw new Error('Missing or invalid smartAccountAddress');
  if (!ethers.isAddress(to)) throw new Error('Missing or invalid destination address');

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const owner = new ethers.Wallet(ownerPrivateKey, provider);
  const entryPoint = new ethers.Contract(ENTRY_POINT_ADDRESS, ENTRY_POINT_ABI, provider);

  // Deploy-on-first-use: only include initCode if the smart account has no
  // code yet, exactly like the POS checkout flow does.
  const code = await provider.getCode(smartAccountAddress);
  let initCode = '0x';
  if (code === '0x') {
    const factoryInterface = new ethers.Interface(FACTORY_ABI);
    const createAccountCall = factoryInterface.encodeFunctionData('createAccount', [owner.address, 0]);
    initCode = ethers.concat([FACTORY_ADDRESS, createAccountCall]);
  }

  const value = ethers.parseEther(Number(amountUsdc).toFixed(6));
  const accountInterface = new ethers.Interface(ACCOUNT_ABI);
  const callData = accountInterface.encodeFunctionData('execute', [to, value, '0x']);

  const nonce = await entryPoint.getNonce(smartAccountAddress, 0);

  const userOp = {
    sender: smartAccountAddress,
    nonce,
    initCode,
    callData,
    callGasLimit: 200000n,
    verificationGasLimit: 500000n,
    preVerificationGas: 100000n,
    maxFeePerGas: ethers.parseUnits('2', 'gwei'),
    maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
    paymasterAndData: '0x',
    signature: '0x',
  };

  const finalHash = await entryPoint.getUserOpHash(userOp);
  // SimpleAccount's _validateSignature wraps the hash with the EIP-191
  // personal-sign prefix (toEthSignedMessageHash()) before recovering the
  // signer — signing the raw hash directly fails validation with "AA24
  // signature error" even though the key is correct.
  userOp.signature = await owner.signMessage(ethers.getBytes(finalHash));

  const serializedUserOp = {
    ...userOp,
    nonce: userOp.nonce.toString(),
    callGasLimit: userOp.callGasLimit.toString(),
    verificationGasLimit: userOp.verificationGasLimit.toString(),
    preVerificationGas: userOp.preVerificationGas.toString(),
    maxFeePerGas: userOp.maxFeePerGas.toString(),
    maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString(),
  };

  const res = await fetch(PAYMASTER_WORKER_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userOp: serializedUserOp, vendorWallet: to, amountUsdc, itemDescription }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Paymaster worker error: ${errText}`);
  }
  return res.json();
}
