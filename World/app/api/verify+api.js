/**
 * POST /api/verify
 * Forwards the IDKit proof to World Developer API v4.
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { proof, action, signal } = body;
    const appId = process.env.WORLD_APP_ID;

    if (!appId) {
      return Response.json({ error: 'WORLD_APP_ID missing in .env' }, { status: 500 });
    }
    if (!proof) {
      return Response.json({ error: 'Missing proof payload' }, { status: 400 });
    }

    const verifyRes = await fetch(`https://developer.world.org/api/v4/verify/${appId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'world-id-blueprint/1.0',
      },
      body: JSON.stringify({
        ...proof,
        action: action || proof.action || '',
        signal: signal || '',
        verification_level: proof?.verification_level || 'device',
      }),
    });

    const verifyData = await verifyRes.json().catch(() => null);

    if (verifyRes.ok && verifyData?.success) {
      return Response.json({ success: true, verified: true, data: verifyData });
    }

    return Response.json(
      { success: false, verified: false, error: verifyData || { status: verifyRes.status } },
      { status: 400 }
    );
  } catch (error) {
    console.error('Verification Error:', error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
