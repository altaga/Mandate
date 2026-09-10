// Service-role key: this route reads/writes agent_key (a real private key)
// and biometric face_vector data for every enrolled user. The anon key must
// never have access to this table once RLS is enabled — see enrolled_users
// RLS policy.
import { getSupabaseAdmin, getAllEnrolledUsersFromDb } from '../../../utilsAPI/enrolledUsersAdmin.js';

export async function GET(request) {
  try {
    const users = await getAllEnrolledUsersFromDb();
    return Response.json({ success: true, users });
  } catch (error) {
    console.error('Supabase GET Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const supabase = getSupabaseAdmin();
    const profile = await request.json();

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
