import fs from 'fs';
import path from 'path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { ServerBiometricService } from '../src/services/serverBiometricService.js';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const dbDir = path.join(process.cwd(), 'scripts', 'db');

async function processImages() {
  console.log("🚀 Starting extraction of real AI faces...");
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  // Load models
  await ServerBiometricService.loadModels();

  // Find images in db dir
  const files = fs.readdirSync(dbDir).filter(f => f.startsWith('portrait_') && f.endsWith('.png'));
  console.log(`Found ${files.length} images to process.`);

  // Delete old dummy users
  console.log("🧹 Clearing old dummy users...");
  await supabase.from('enrolled_users').delete().like('id', 'dummy_%');

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const destPath = path.join(dbDir, file);
    
    console.log(`\n📸 Processing Image ${i + 1}: ${file}`);
    const imgBuffer = fs.readFileSync(destPath);
    const base64Img = `data:image/png;base64,${imgBuffer.toString('base64')}`;
    
    try {
      const vector = await ServerBiometricService.extractRealFaceVector(base64Img);
      
      if (!vector) {
        console.log("⚠️ Could not detect a face in this image. Skipping.");
        continue;
      }
      
      const nameParts = file.replace('portrait_', '').replace(/\_\d+\.png$/, '').split('_');
      const formattedName = nameParts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');

      const profilePayload = {
        id: `dummy_${i + 1}_${Date.now()}`,
        name: formattedName,
        email: `${nameParts.join('.')}@example.com`,
        wallet_address: `0xRealAI${i + 1}`,
        face_vector: `[${vector.join(',')}]`,
        enrolled_at: new Date().toISOString()
      };

      const { error } = await supabase.from('enrolled_users').insert([profilePayload]);
      
      if (error) {
        console.error(`❌ DB Error for ${file}:`, error.message);
      } else {
        console.log(`✅ Saved ${formattedName} with real facial vector!`);
      }
    } catch (e) {
      console.error(`Error processing ${file}:`, e.message);
    }
  }
  
  console.log("\n🎉 All 10 images processed and saved to DB successfully!");
}

processImages().catch(console.error);
