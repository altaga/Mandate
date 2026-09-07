const { ethers } = require('ethers');

async function main() {
  const rpcUrl = 'https://rpc.testnet.arc.network';
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  
  // The Paymaster / Bundler EOA (which has testnet funds)
  const paymasterKey = process.env.MANDATE_PAYMASTER_PRIVATE_KEY;
  if (!paymasterKey) {
    console.error('ERROR: MANDATE_PAYMASTER_PRIVATE_KEY is required. Set it in app/.env or the shell environment.');
    process.exit(1);
  }
  const bundlerWallet = new ethers.Wallet(paymasterKey, provider);
  
  const entryPointAddress = '0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789';
  const factoryAddress = '0x9406Cc6185a346906296840746125a0E44976454'; // SimpleAccountFactory

  const entryPointAbi = [
    'function handleOps(tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData, bytes signature)[] ops, address beneficiary)',
    'function depositTo(address account) payable',
    'function balanceOf(address account) view returns (uint256)'
  ];
  const factoryAbi = [
    'function getAddress(address owner, uint256 salt) view returns (address)'
  ];
  const accountAbi = [
    'function execute(address dest, uint256 value, bytes func)'
  ];

  const entryPoint = new ethers.Contract(entryPointAddress, entryPointAbi, bundlerWallet);
  const factory = new ethers.Contract(factoryAddress, factoryAbi, provider);

  // 1. Generate an Agent Owner Key
  const agentOwner = ethers.Wallet.createRandom();
  console.log("Agent Owner:", agentOwner.address);

  // 2. Predict Smart Account Address
  const salt = 0;
  const smartAccountAddress = await factory.getAddress(agentOwner.address, salt);
  console.log("Predicted Smart Account:", smartAccountAddress);

  // 3. Deposit Gas to EntryPoint for the Smart Account
  console.log("Depositing gas to EntryPoint...");
  const depositTx = await entryPoint.depositTo(smartAccountAddress, { value: ethers.parseEther('0.01') });
  await depositTx.wait();
  console.log("Gas deposited.");

  // 4. Construct InitCode (if not deployed)
  const code = await provider.getCode(smartAccountAddress);
  let initCode = '0x';
  if (code === '0x') {
    const factoryInterface = new ethers.Interface(['function createAccount(address owner, uint256 salt)']);
    const createAccountCall = factoryInterface.encodeFunctionData('createAccount', [agentOwner.address, salt]);
    initCode = ethers.concat([factoryAddress, createAccountCall]);
  }

  // 5. Construct CallData (Paying a vendor)
  const vendorWallet = '0xbb76A14337379Fd1AC7ffDbE2790841C806f620E';
  const accountInterface = new ethers.Interface(accountAbi);
  const callData = accountInterface.encodeFunctionData('execute', [vendorWallet, 0, '0x']);

  // 6. Build UserOperation
  const userOp = {
    sender: smartAccountAddress,
    nonce: 0n,
    initCode,
    callData,
    callGasLimit: 200000n,
    verificationGasLimit: 200000n,
    preVerificationGas: 50000n,
    maxFeePerGas: ethers.parseUnits('2', 'gwei'),
    maxPriorityFeePerGas: ethers.parseUnits('1', 'gwei'),
    paymasterAndData: '0x',
    signature: '0x'
  };

  // 7. Calculate UserOpHash and Sign
  const abiCoder = new ethers.AbiCoder();
  const userOpType = 'tuple(address sender, uint256 nonce, bytes initCode, bytes callData, uint256 callGasLimit, uint256 verificationGasLimit, uint256 preVerificationGas, uint256 maxFeePerGas, uint256 maxPriorityFeePerGas, bytes paymasterAndData)';
  
  const hashedInitCode = ethers.keccak256(userOp.initCode);
  const hashedCallData = ethers.keccak256(userOp.callData);
  const hashedPaymasterAndData = ethers.keccak256(userOp.paymasterAndData);

  const encodedUserOp = abiCoder.encode(
    ['address', 'uint256', 'bytes32', 'bytes32', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'bytes32'],
    [
      userOp.sender, userOp.nonce, hashedInitCode, hashedCallData,
      userOp.callGasLimit, userOp.verificationGasLimit, userOp.preVerificationGas,
      userOp.maxFeePerGas, userOp.maxPriorityFeePerGas, hashedPaymasterAndData
    ]
  );
  
  const userOpHash = ethers.keccak256(encodedUserOp);
  const chainId = (await provider.getNetwork()).chainId;
  const enc = abiCoder.encode(['bytes32', 'address', 'uint256'], [userOpHash, entryPointAddress, chainId]);
  const finalHash = ethers.keccak256(enc);

  // Sign with Agent Owner
  const signature = await agentOwner.signMessage(ethers.getBytes(finalHash));
  userOp.signature = signature;

  console.log("Submitting handleOps...");
  try {
    // 8. Submit via handleOps
    const handleOpsTx = await entryPoint.handleOps([userOp], bundlerWallet.address);
    const receipt = await handleOpsTx.wait();
    console.log("✅ Success! Transaction Hash:", receipt.hash);
  } catch (err) {
    console.error("❌ Failed:", err);
  }
}

main();
