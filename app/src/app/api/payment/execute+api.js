import { createClient } from '@supabase/supabase-js';
import { ethers } from 'ethers';

const getSupabase = () => {
  // Service-role key: this is trusted server-side code reading agent_key
  // (a real private key) for enrolled users. The anon key must never have
  // access to this table once RLS is enabled — see enrolled_users RLS policy.
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { vendorWallet, amountUsdc, biometricVerificationId, walletAddress, itemDescription, currency } = body;

    if (!vendorWallet || !walletAddress) {
      return Response.json({ error: "Missing vendorWallet or walletAddress." }, { status: 400 });
    }

    const selectedCurrency = currency || 'USDC';
    const TOKEN_ADDRESSES = {
      USDC: 'native',
      EURC: process.env.EXPO_PUBLIC_TOKEN_EURC || '0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a',
      cirBTC: process.env.EXPO_PUBLIC_TOKEN_CIRBTC || '0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF'
    };
    
    // Default decimals assuming 18 for testnet tokens
    const transferAmount = ethers.parseEther(amountUsdc.toString());

    // 1. Fetch User's Agent Key from Database
    const supabase = getSupabase();
    const { data: user, error } = await supabase
      .from('enrolled_users')
      .select('agent_key')
      .eq('wallet_address', walletAddress)
      .single();

    if (error || !user?.agent_key) {
      return Response.json({ error: "Agent Key not found for this wallet. User must re-enroll." }, { status: 404 });
    }

    const agentOwner = new ethers.Wallet(user.agent_key);
    const rpcUrl = "https://rpc.testnet.arc.network";
    const provider = new ethers.JsonRpcProvider(rpcUrl);

    const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
    const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454';

    const entryPointAbi = [
      'function getNonce(address sender, uint192 key) view returns (uint256 nonce)',
      'function getUserOpHash(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature) userOp) view returns (bytes32)'
    ];
    const accountAbi = ['function execute(address dest, uint256 value, bytes func)'];

    const entryPoint = new ethers.Contract(entryPointAddress, entryPointAbi, provider);

    // 2. Compute initCode
    const code = await provider.getCode(walletAddress);
    let initCode = '0x';
    if (code === '0x') {
      const factoryInterface = new ethers.Interface(['function createAccount(address owner, uint256 salt)']);
      const createAccountCall = factoryInterface.encodeFunctionData('createAccount', [agentOwner.address, 0]);
      initCode = ethers.concat([factoryAddress, createAccountCall]);
    }

    // 3. Construct CallData (Multi-Token Logic)
    const accountInterface = new ethers.Interface(accountAbi);
    let callData;

    if (TOKEN_ADDRESSES[selectedCurrency] === 'native') {
      // Native Arc Gas Token (USDC) Transfer
      callData = accountInterface.encodeFunctionData('execute', [vendorWallet, transferAmount, '0x']);
    } else {
      // Nested ERC-20 Token Transfer
      const erc20Interface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
      const tokenAddress = TOKEN_ADDRESSES[selectedCurrency];
      const erc20TransferData = erc20Interface.encodeFunctionData('transfer', [vendorWallet, transferAmount]);
      callData = accountInterface.encodeFunctionData('execute', [tokenAddress, 0, erc20TransferData]);
    }

    const nonce = await entryPoint.getNonce(walletAddress, 0);

    const userOp = {
      sender: walletAddress,
      nonce: nonce,
      initCode,
      callData,
      callGasLimit: 200000n,
      verificationGasLimit: 500000n,
      preVerificationGas: 100000n,
      maxFeePerGas: ethers.parseUnits('2', 'gwei'),
      maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
      paymasterAndData: '0x',
      signature: '0x'
    };

    // 4. Hash and Sign UserOperation
    const finalHash = await entryPoint.getUserOpHash(userOp);
    // SimpleAccount's _validateSignature wraps the hash with the EIP-191
    // personal-sign prefix (toEthSignedMessageHash()) before recovering the
    // signer — signing the raw hash directly fails validation with "AA24
    // signature error" even though the key is correct.
    userOp.signature = await agentOwner.signMessage(ethers.getBytes(finalHash));

    // Convert BigInts to strings for JSON payload
    const serializedUserOp = {
      ...userOp,
      nonce: userOp.nonce.toString(),
      callGasLimit: userOp.callGasLimit.toString(),
      verificationGasLimit: userOp.verificationGasLimit.toString(),
      preVerificationGas: userOp.preVerificationGas.toString(),
      maxFeePerGas: userOp.maxFeePerGas.toString(),
      maxPriorityFeePerGas: userOp.maxPriorityFeePerGas.toString()
    };

    // 5. Send to Paymaster (Bundler) Edge Node
    const paymasterUrl = "https://mandate-x402-paymaster.mandate-x402-fkqggy.workers.dev/";
    const proxyRes = await fetch(paymasterUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userOp: serializedUserOp, vendorWallet, amountUsdc, itemDescription, walletAddress })
    });

    if (!proxyRes.ok) {
      const errText = await proxyRes.text();
      return Response.json({ error: errText }, { status: proxyRes.status });
    }

    const json = await proxyRes.json();
    return Response.json(json, { status: 200 });
  } catch (err) {
    console.error('[API_PAYMENT_EXECUTE] Transaction Construction Failed:', err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
