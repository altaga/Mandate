import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function runTest() {
  console.log("🚀 Starting Face AI Algorithm Test...");

  // Load the Server Biometric Service dynamically to execute the model
  const { ServerBiometricService } = await import('../src/services/serverBiometricService.js');
  const { BiometricService } = await import('../src/services/biometricService.js');

  const imgPath1 = path.join(process.cwd(), 'scripts/utils/sample_face_primary.jpg');
  const imgPath2 = path.join(process.cwd(), 'scripts/utils/sample_face_secondary.jpg');
  const imgPath3 = path.join(process.cwd(), 'scripts/utils/sample_face_verification.jpg');

  console.log("📸 Loading images from disk...");
  const base64Img1 = "data:image/jpeg;base64," + fs.readFileSync(imgPath1).toString('base64');
  const base64Img2 = "data:image/jpeg;base64," + fs.readFileSync(imgPath2).toString('base64');
  const base64Img3 = "data:image/jpeg;base64," + fs.readFileSync(imgPath3).toString('base64');

  console.log("🧠 Loading AI Models...");
  await ServerBiometricService.loadModels();

  console.log("🔍 Extracting Vector for Image 1 (Enrollment)...");
  const vector1 = await ServerBiometricService.extractRealFaceVector(base64Img1);
  if (!vector1) throw new Error("Could not detect face in Image 1");
  console.log(`✅ Extracted Vector 1 (Dimensions: ${vector1.length})`);

  console.log("🔍 Extracting Vector for Image 2 (Test 1)...");
  const vector2 = await ServerBiometricService.extractRealFaceVector(base64Img2);
  if (!vector2) throw new Error("Could not detect face in Image 2");
  
  console.log("🔍 Extracting Vector for Image 3 (Test 2)...");
  const vector3 = await ServerBiometricService.extractRealFaceVector(base64Img3);
  if (!vector3) throw new Error("Could not detect face in Image 3");

  console.log("\n🤖 Testing Recognition Algorithm...");
  
  const sim1 = BiometricService.computeCosineSimilarity(vector1, vector2);
  console.log(`📊 Similarity Image 1 vs Image 2: ${(sim1 * 100).toFixed(2)}%`);
  
  const sim2 = BiometricService.computeCosineSimilarity(vector1, vector3);
  console.log(`📊 Similarity Image 1 vs Image 3: ${(sim2 * 100).toFixed(2)}%`);

  const sim3 = BiometricService.computeCosineSimilarity(vector2, vector3);
  console.log(`📊 Similarity Image 2 vs Image 3: ${(sim3 * 100).toFixed(2)}%`);

  if (sim1 > 0.85 && sim2 > 0.85) {
    console.log("🎉 SUCCESS! The algorithm accurately recognizes you across all photos!");
  } else {
    console.log("⚠️ Similarity below 85% threshold. Lighting or angle variations might be extreme.");
  }

  console.log("\n💾 Saving Vector 1 to Supabase...");
  // Clear DB for test
  await supabase.from('enrolled_users').delete().neq('id', '0');

  const userId = 'usr_' + Date.now().toString(36);
  const profilePayload = {
    id: userId,
    name: 'Victor Alonso',
    email: 'v.a.i@hotmail.com',
    wallet_address: '0xTestAddress123',
    face_vector: JSON.stringify(vector1),
    world_nullifier: null,
    world_verified: false,
    risk_tier: 'LOW'
  };

  const { error } = await supabase.from('enrolled_users').insert([profilePayload]);
  if (error) console.error(`Supabase Insert Error: ${error.message}`);
  else console.log(`✅ Saved User ${userId} successfully to Supabase!`);

}

runTest().catch(console.error);
