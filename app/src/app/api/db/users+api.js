// Cloudflare D1-backed (mandate-users). Stores agent_key (a real private key)
// and biometric face_vector for every enrolled user — this GET is reachable
// from any browser (only CORS-gated, same caveat as everywhere else in this
// app: that's not authentication), so it must never return either field.
// Nothing live needs them here: the only code that ever read agentKey back
// was the deleted POS payment/execute route, and the only client-side
// consumer of faceVector (biometricService.js's identifyUserByFaceVector,
// a 1-tap face-login flow) has zero remaining callers since that screen was
// removed too. Real face matching still happens server-side, in
// recognize+api.js, which calls getAllEnrolledUsersFromDb() directly rather
// than going through this HTTP route — it still gets the real vector.
import { getAllEnrolledUsersFromDb, upsertEnrolledUser } from '../../../utilsAPI/enrolledUsersAdmin.js';
import { checkRateLimit, rateLimitResponse } from '../../../utilsAPI/rateLimitGuard.js';

function toPublicProfile({ agentKey, faceVector, ...safe }) {
  return safe;
}

export async function GET(request) {
  try {
    const users = await getAllEnrolledUsersFromDb();
    return Response.json({ success: true, users: users.map(toPublicProfile) });
  } catch (error) {
    console.error('D1 GET Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { limited, retryAfterSeconds } = await checkRateLimit({
      request, route: 'db/users', limit: 10, windowMs: 5 * 60 * 1000,
    });
    if (limited) return rateLimitResponse(retryAfterSeconds);

    const profile = await request.json();
    await upsertEnrolledUser(profile);
    return Response.json({ success: true });
  } catch (error) {
    console.error('D1 POST Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
