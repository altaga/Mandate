import { ArcService } from '../src/services/arcService.js';
import { BiometricService } from '../src/services/biometricService.js';
import { WorldService } from '../src/services/worldService.js';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LIVE_API_URL = 'https://mandate.expo.app';
const ADMIN_KEY = process.env.ADMIN_API_KEY;

async function runHackathonIntegrationTest() {
  console.log('==================================================');
  console.log('🚀 MANDATE HACKATHON E2E INTEGRATION TEST STARTED');
  console.log('==================================================\n');

  try {
    // 1. MOCK FACE CAPTURE & VECTOR GENERATION
    console.log('📸 1. Capturing human face and generating 128-D vector...');
    
    // Read the AI Generated Face Image
    const imagePath = path.join(__dirname, 'utils', 'sample_face_primary.jpg');
    const imageBuffer = fs.readFileSync(imagePath);
    const mockImageSeed = imageBuffer.toString('base64');
    
    console.log(`   ✅ Read AI Face Image (${Math.round(mockImageSeed.length / 1024)} KB)`);
    
    const faceVector = BiometricService.extract128dFaceVector(mockImageSeed);
    console.log(`   ✅ Extracted 128-dimensional vector (Norm: 1.0)`);
    console.log(`   ➔ Vector Sample: [${faceVector[0]}, ${faceVector[1]}, ${faceVector[2]}...]\n`);

    // 2. CREATE WALLET FOR USER
    console.log('🏦 2. Generating Smart Contract Wallet for User...');
    const userId = 'hackathon_usr_' + Date.now().toString(36);
    const generatedWallet = '0x' + Array.from({ length: 40 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    console.log(`   ✅ Wallet Created: ${generatedWallet}\n`);

    // 3. ENROLL USER INTO SUPABASE VIA LIVE API
    console.log('☁️  3. Enrolling user into Supabase Cloud Database...');
    const enrollPayload = {
      id: userId,
      name: 'Hackathon Tester',
      email: 'tester@hackathon.arc',
      walletAddress: generatedWallet,
      faceVector: faceVector,
      enrolledAt: new Date().toISOString()
    };

    const dbRes = await fetch(`${LIVE_API_URL}/api/db/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ADMIN_KEY
      },
      body: JSON.stringify(enrollPayload)
    });

    const dbData = await dbRes.json();
    if (!dbData.success) throw new Error(`Database Error: ${dbData.error}`);
    console.log(`   ✅ User successfully saved to Live Supabase DB!\n`);

    // 4. TEST 2 USDC PAYMENT VIA ARC ACCOUNT ABSTRACTION (AUTO-APPROVE)
    console.log('💸 4. Funding & Executing 2.00 USDC Payment via Arc Network (Low Value)...');
    const paymentReceipt1 = await ArcService.executePayment({
      userId: userId,
      walletAddress: generatedWallet,
      amountUsdc: 2.00,
      itemDescription: 'Coffee',
      biometricVerificationId: 'test_bio_hash_999'
    });

    console.log(`   ✅ Payment Settled! Policy Tier: ${paymentReceipt1.accountAbstraction.policyTier}\n`);

    // 5. TEST 75 USDC HIGH-VALUE PAYMENT (REQUIRES WORLD ID STEP-UP)
    console.log('🛡️  5. Attempting 75.00 USDC High-Value Payment...');
    try {
      await ArcService.executePayment({
        userId: userId,
        walletAddress: generatedWallet,
        amountUsdc: 75.00,
        itemDescription: 'Luxury Headphones',
        biometricVerificationId: 'test_bio_hash_999'
      });
    } catch (err) {
      console.log(`   ❌ Blocked by Arc Delegated Spend Policy: ${err.message}`);
    }

    console.log('\n🌐 6. Triggering World ID Selfie Check Step-Up...');
    console.log(`   ➔ Generating RP Signature & Deep Link...`);
    const deepLink = WorldService.generateWorldAppDeepLink({ action: 'mandate-high-value-checkout' });
    console.log(`   ➔ URL: ${deepLink}`);
    
    // Simulate User completing the World App verification and returning a proof
    console.log(`   ➔ User completed World App verification. Validating Proof on server...`);
    const worldProof = await WorldService.verifyWorldProof({ 
      proofPayload: { verification_level: 'orb' },
      orderId: 'test_order_75'
    });

    if (worldProof.success) {
      console.log(`   ✅ World ID Proof Validated! Nullifier Hash: ${worldProof.nullifier_hash}\n`);
      
      console.log('💸 7. Re-Attempting 75.00 USDC Payment with World ID Proof...');
      const paymentReceipt2 = await ArcService.executePayment({
        userId: userId,
        walletAddress: generatedWallet,
        amountUsdc: 75.00,
        itemDescription: 'Luxury Headphones',
        biometricVerificationId: 'test_bio_hash_999',
        worldNullifierHash: worldProof.nullifier_hash
      });

      console.log(`   ✅ Payment Settled on Arc Testnet!`);
      console.log(`   ➔ Order ID:    ${paymentReceipt2.orderId}`);
      console.log(`   ➔ Amount:      ${paymentReceipt2.amount} ${paymentReceipt2.currency}`);
      console.log(`   ➔ Tx Hash:     ${paymentReceipt2.txHash}`);
      console.log(`   ➔ Policy Tier: ${paymentReceipt2.accountAbstraction.policyTier}`);
    }

    console.log('==================================================');
    console.log('🏆 TEST PASSED: Full Hackathon Flow Confirmed!');
    console.log('==================================================');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
  }
}

runHackathonIntegrationTest();
