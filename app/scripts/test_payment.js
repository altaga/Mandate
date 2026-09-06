
import { ArcService } from '../src/services/arcService.js';

async function testPayment() {
  try {
    console.log("Starting Arc Testnet Payment...");
    const receipt = await ArcService.executePayment({
      userId: 'test_user',
      walletAddress: '0x123...',
      amountUsdc: 24.99,
      itemDescription: 'Test Payment'
    });
    console.log("Success! Receipt:");
    console.log(receipt);
  } catch (err) {
    console.error("Payment failed:", err);
  }
}

testPayment();
