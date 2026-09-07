import { ethers } from 'ethers';

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method Not Allowed', { status: 405 });
    }

    try {
      const body = await request.json();
      const { vendorWallet, amountUsdc, userOp } = body;

      if (!vendorWallet || !vendorWallet.startsWith('0x') || vendorWallet.length !== 42) {
        return Response.json({ error: 'Invalid or missing vendorWallet address' }, { status: 400 });
      }

      if (!userOp) {
        return Response.json({ error: 'Missing signed userOp payload' }, { status: 400 });
      }

      if (!env.MANDATE_PAYMASTER_PRIVATE_KEY) {
        return Response.json({ error: 'Missing environment keys.' }, { status: 500 });
      }

      const rpcUrl = "https://rpc.testnet.arc.network";
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const bundlerWallet = new ethers.Wallet(env.MANDATE_PAYMASTER_PRIVATE_KEY, provider);

      const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';

      const entryPointAbi = [
        'function depositTo(address account) payable',
        'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)'
      ];
      const entryPoint = new ethers.Contract(entryPointAddress, entryPointAbi, bundlerWallet);

      // Convert stringified BigInts back to BigInt
      const formattedUserOp = {
        ...userOp,
        nonce: BigInt(userOp.nonce),
        callGasLimit: BigInt(userOp.callGasLimit),
        verificationGasLimit: BigInt(userOp.verificationGasLimit),
        preVerificationGas: BigInt(userOp.preVerificationGas),
        maxFeePerGas: BigInt(userOp.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(userOp.maxPriorityFeePerGas)
      };

      // Ensure Smart Account is funded before execution
      const depositTx = await entryPoint.depositTo(formattedUserOp.sender, { value: ethers.parseEther('0.005') });
      await depositTx.wait(1);

      // Submit the pre-signed UserOperation as the Bundler
      const handleOpsTx = await entryPoint.handleOps([formattedUserOp], bundlerWallet.address, { gasLimit: 2000000 });
      const receipt = await handleOpsTx.wait(1);

      const finalizedReceipt = {
        orderId: 'ord_' + Date.now().toString(36),
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        timestamp: new Date().toISOString(),
        status: 'CONFIRMED',
        amount: Number(amountUsdc || 24.99),
        currency: 'USDC (Native Arc)',
        vendorWallet: vendorWallet,
        accountAbstraction: {
          entryPoint: entryPointAddress,
          paymaster: bundlerWallet.address,
          gasSponsored: true,
          smartAccount: formattedUserOp.sender
        },
        networkMeta: {
          chain: 'Arc Testnet',
          chainId: 5042002,
          gasFeeUsdc: 'Sponsored via Paymaster Edge Node',
          explorerUrl: `https://testnet.arcscan.app/tx/${receipt.hash}`
        }
      };

      return Response.json(finalizedReceipt, {
        status: 200,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });

    } catch (err) {
      console.error(err);
      return Response.json({ error: err.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } });
    }
  }
};
