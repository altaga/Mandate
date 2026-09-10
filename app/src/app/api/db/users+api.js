import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) {
    throw new Error("[Configuration Error] Missing required environment variable: SUPABASE_URL or SUPABASE_SECRET_KEY. Please set them in app/.env");
  }
  // Service-role key: this route reads/writes agent_key (a real private key)
  // and biometric face_vector data for every enrolled user. The anon key must
  // never have access to this table once RLS is enabled — see enrolled_users
  // RLS policy.
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY);
};

export async function GET(request) {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('enrolled_users')
      .select('*')
      .order('enrolled_at', { ascending: false });

    if (error) throw error;

    const formattedUsers = (data || []).map(r => {
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
    });

    return Response.json({ success: true, users: formattedUsers });
  } catch (error) {
    console.error('Supabase GET Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabase();
    const profile = await request.json();

    if (!supabase) {
      return Response.json({ success: true, localOnly: true });
    }
    
    const vectorString = `[${(profile.faceVector || []).join(',')}]`;

    const { error } = await supabase
      .from('enrolled_users')
      .upsert({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        wallet_address: profile.walletAddress,
        agent_key: profile.agentKey || null,
        face_vector: vectorString,
        world_nullifier: profile.worldNullifier || null,
        enrolled_at: profile.enrolledAt || new Date().toISOString()
      });

    if (error) throw error;

    return Response.json({ success: true });
  } catch (error) {
    console.error('Supabase POST Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
