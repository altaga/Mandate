import { signRequest } from '@worldcoin/idkit/signing';

/**
 * GET /api/sign
 * Returns a signed rp_context for IDKitRequestWidget.
 * Action is timestamped so each run is unique (avoids replay / already-verified).
 */
export async function GET() {
  try {
    const signingKey = process.env.WORLD_SECRET_KEY;
    const rpId = process.env.WORLD_RP_ID;

    if (!signingKey) {
      return Response.json({ error: 'WORLD_SECRET_KEY missing in .env' }, { status: 500 });
    }
    if (!rpId) {
      return Response.json({ error: 'WORLD_RP_ID missing in .env' }, { status: 500 });
    }

    const action = `face-auth-checkout-${Date.now()}`;
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
