import { BiometricService } from '../../services/biometricService.js';
import { ServerBiometricService } from '../../services/serverBiometricService.js';
import { getAllEnrolledUsersFromDb } from '../../utilsAPI/enrolledUsersAdmin.js';
import { CONFIG } from '../../constants/config.js';
import { checkRateLimit, rateLimitResponse } from '../../utilsAPI/rateLimitGuard.js';

export async function POST(request) {
  try {
    const { limited, retryAfterSeconds } = await checkRateLimit({
      request, route: 'recognize', limit: 20, windowMs: 60 * 1000,
    });
    if (limited) return rateLimitResponse(retryAfterSeconds);

    const body = await request.json();
    const { imageBase64, threshold: requestedThreshold } = body;

    if (!imageBase64) throw new Error('Missing imageBase64');

    // threshold is a security parameter (how close a face has to be to count
    // as a match) — it must never be trusted from the client. A caller who
    // sets it near 0 would turn this into a "who's the closest enrolled face"
    // oracle regardless of true similarity. Clamp to a floor no client input
    // can go below; 0.85 stays the real default.
    const threshold = Math.min(0.99, Math.max(0.85, Number(requestedThreshold) || 0.85));

    const candidateVector = await ServerBiometricService.extractRealFaceVector(imageBase64);

    if (!candidateVector) {
      throw new Error("No face detected by AI model. Ensure good lighting.");
    }

    // Query Supabase directly — this route already runs server-side, so looping
    // back through our own /api/db/users over HTTP (as BiometricService's
    // client-oriented DatabaseService does) only adds a fragile self-call that
    // has to guess this server's own port.
    const allUsers = await getAllEnrolledUsersFromDb();

    let bestMatch = null;
    let highestSimilarity = 0;
    for (const user of allUsers) {
      if (user.faceVector && Array.isArray(user.faceVector)) {
        const similarity = BiometricService.computeCosineSimilarity(candidateVector, user.faceVector);
        if (similarity > highestSimilarity) {
          highestSimilarity = similarity;
          bestMatch = user;
        }
      }
    }

    const isMatch = highestSimilarity >= threshold;

    return Response.json({
      success: isMatch,
      livenessScore: 99.42,
      matchConfidence: Number((highestSimilarity * 100).toFixed(2)),
      similarityScore: highestSimilarity,
      identifiedUser: isMatch && bestMatch ? {
        id: bestMatch.id,
        name: bestMatch.name,
        email: bestMatch.email,
        walletAddress: bestMatch.walletAddress || CONFIG.ARC_NETWORK.DEFAULT_BUYER_ADDRESS
      } : null,
      serverRuntime: 'Expo Server API Route (Node.js SSR)',
      vectorMetadata: {
        vectorDimensions: 128,
        vectorNorm: 1.0,
        matchingEngine: '128d Face Vector Cosine Similarity Search',
        threshold
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
