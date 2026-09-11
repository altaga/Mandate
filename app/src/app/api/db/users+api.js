// Cloudflare D1-backed (mandate-users): this route reads/writes agent_key (a real
// private key) and biometric face_vector data for every enrolled user.
import { getAllEnrolledUsersFromDb, upsertEnrolledUser } from '../../../utilsAPI/enrolledUsersAdmin.js';

export async function GET(request) {
  try {
    const users = await getAllEnrolledUsersFromDb();
    return Response.json({ success: true, users });
  } catch (error) {
    console.error('D1 GET Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const profile = await request.json();
    await upsertEnrolledUser(profile);
    return Response.json({ success: true });
  } catch (error) {
    console.error('D1 POST Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
