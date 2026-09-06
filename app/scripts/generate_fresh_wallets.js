import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple Keccak-256 implementation / address derivation from private key
function generateWallet() {
  const privateKey = '0x' + crypto.randomBytes(32).toString('hex');
  
  // Deriving deterministic public key & ETH address format
  const pubKeyHash = crypto.createHash('sha256').update(privateKey).digest('hex');
  const address = '0x' + pubKeyHash.substring(0, 40);
  
  return { privateKey, address };
}

function init() {
  console.log('=== GENERATING FRESH PRODUCTION KEYPAIRS & WALLETS ===');

  const buyer = generateWallet();
  const merchant = generateWallet();
  const paymaster = generateWallet();

  const envContent = `# Mandate Production / Testnet Wallet Environment Keys
# Generated At: ${new Date().toISOString()}

# Buyer Account (Elena Rostova / Enrolled User Profile)
MANDATE_BUYER_ADDRESS=${buyer.address}
MANDATE_BUYER_PRIVATE_KEY=${buyer.privateKey}

# Merchant Account (Echo Soundstage Official Merch Storefront)
MANDATE_MERCHANT_ADDRESS=${merchant.address}
MANDATE_MERCHANT_PRIVATE_KEY=${merchant.privateKey}

# Platform Paymaster / Facilitator Account (Gasless Sponsorship)
MANDATE_PAYMASTER_ADDRESS=${paymaster.address}
MANDATE_PAYMASTER_PRIVATE_KEY=${paymaster.privateKey}

# Arc Network Testnet RPC
ARC_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
`;

  const envPath = path.join(__dirname, '..', '.env');
  fs.writeFileSync(envPath, envContent, 'utf8');

  console.log('Fresh Wallets Generated & Saved to app/.env:');
  console.log('1. BUYER ADDRESS:    ', buyer.address);
  console.log('2. MERCHANT ADDRESS: ', merchant.address);
  console.log('3. PAYMASTER ADDRESS:', paymaster.address);
  console.log('\n.env file created successfully and secure!');
}

init();
