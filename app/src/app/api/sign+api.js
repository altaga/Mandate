import { signRequest } from '@worldcoin/idkit/signing';

export async function GET(request) {
  try {
    const signingKey = process.env.WORLD_SECRET_KEY;
    const rpId = process.env.WORLD_RP_ID;

    if (!signingKey) {
      return Response.json({ error: 'WORLD_SECRET_KEY not found in .env' }, { status: 500 });
    }
    if (!rpId) {
      return Response.json({ error: 'WORLD_RP_ID not found in .env' }, { status: 500 });
    }

    // ?purpose=recognition → fixed action (enrollment/login), so nullifier_hash is deterministic
    // for a given person and enrolled_users.world_nullifier can be matched on a later login.
    // Default (checkout) keeps a timestamped action per attempt — nullifier_hash there is a
    // per-transaction anti-replay token, not meant to be recognized/reused across attempts.
    const { searchParams } = new URL(request.url);
    const purpose = searchParams.get('purpose');
    const action = purpose === 'recognition'
      ? (process.env.WORLD_RECOGNITION_ACTION || 'mandate-user-recognition')
      : `face-auth-checkout-${Date.now()}`;

    const { sig, nonce, createdAt, expiresAt } = signRequest({
      signingKeyHex: signingKey,
      action,
      ttl: 300,
    });

    return Response.json({
      rp_id: rpId,
      action,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
      signature: sig,
    });
  } catch (error) {
    console.error('Signature Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
