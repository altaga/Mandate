import { createClient } from '@supabase/supabase-js';

// Server-only: reads the service-role key, must never be imported from a client component.
export function getSupabaseAdmin() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("[Configuration Error] Missing required environment variable: SUPABASE_URL or SUPABASE_SECRET_KEY. Please set them in app/.env");
  }
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
}

function mapEnrolledUserRow(r) {
  let vectorArray = [];
  try {
    if (typeof r.face_vector === 'string') {
      vectorArray = JSON.parse(r.face_vector);
    } else if (Array.isArray(r.face_vector)) {
      vectorArray = r.face_vector;
    }
  } catch (e) {
    console.error('Failed to parse vector for user', r.id);
  }

  return {
    id: r.id,
    name: r.name,
    email: r.email,
    walletAddress: r.wallet_address,
    agentKey: r.agent_key,
    worldNullifier: r.world_nullifier,
    faceVector: vectorArray,
    enrolledAt: r.enrolled_at
  };
}

// Queries Supabase directly instead of looping back through this app's own
// /api/db/users route — a same-process HTTP self-call has to guess its own
// port/host, which silently breaks whenever the dev server isn't on the
// assumed default port (or in any deployment where the internal port differs).
export async function getAllEnrolledUsersFromDb() {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('enrolled_users')
    .select('*')
    .order('enrolled_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapEnrolledUserRow);
}
