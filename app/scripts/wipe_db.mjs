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

async function wipeDb() {
  console.log("Wiping all users from enrolled_users...");
  // Neq dummy ensures all rows are deleted
  const { data, error } = await supabase.from('enrolled_users').delete().neq('id', 'dummy');
  
  if (error) {
    console.error("Error wiping db:", error);
  } else {
    console.log("Database wiped successfully.");
  }
}

wipeDb();
