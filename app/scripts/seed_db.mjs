import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Names for our dummy users
const dummyNames = [
  "Alice Johnson",
  "Bob Smith",
  "Charlie Brown",
  "Diana Prince",
  "Ethan Hunt",
  "Fiona Gallagher",
  "George Costanza",
  "Hannah Montana",
  "Ian Malcolm",
  "Julia Roberts"
];

// Generates a random 128-dimensional vector
function generateRandomVector() {
  const vector = [];
  for (let i = 0; i < 128; i++) {
    // Generate values between -1 and 1
    vector.push(Math.random() * 2 - 1);
  }
  return vector;
}

async function seedDatabase() {
  console.log("🌱 Seeding database with 10 dummy users...");
  
  const usersToInsert = dummyNames.map((name, index) => {
    return {
      id: `dummy_${index + 1}_${Date.now()}`,
      name: name,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      wallet_address: `0xDummyWallet${index + 1}`,
      face_vector: `[${generateRandomVector().join(',')}]`,
      enrolled_at: new Date().toISOString()
    };
  });

  const { data, error } = await supabase
    .from('enrolled_users')
    .insert(usersToInsert);

  if (error) {
    console.error("❌ Error seeding database:", error.message);
  } else {
    console.log(`✅ Successfully inserted ${usersToInsert.length} dummy users!`);
  }
}

seedDatabase();
