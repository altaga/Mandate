import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("Missing Supabase credentials in .env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function fetchDb() {
  console.log("Fetching all users from enrolled_users...");
  const { data, error } = await supabase.from('enrolled_users').select('*');
  
  if (error) {
    console.error("Error fetching db:", error);
  } else {
    if (data.length === 0) {
      console.log("The table is empty.");
    } else {
      console.log(`Found ${data.length} user(s):`);
      data.forEach(user => {
        console.log(`- ID: ${user.id}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Email: ${user.email}`);
        console.log(`  Wallet: ${user.wallet_address}`);
        console.log(`  World Nullifier: ${user.world_nullifier ? 'Yes' : 'No'}`);
        console.log(`  Face Vector: ${user.face_vector ? 'Yes (length: ' + JSON.parse(user.face_vector).length + ')' : 'No'}`);
        console.log(`  Created At: ${user.created_at}`);
        console.log('-----------------------------------');
      });
    }
  }
}

fetchDb();
