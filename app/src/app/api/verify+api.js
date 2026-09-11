export async function POST(request) {
  try {
    const body = await request.json();
    const { proof, action, signal } = body;
    const appId = process.env.WORLD_APP_ID || process.env.WORLD_RP_ID;
    if (!appId) {
      return Response.json({
        error: "[Configuration Error] Missing required environment variable: WORLD_APP_ID. Please set WORLD_APP_ID in app/.env"
      }, { status: 500 });
    }
    
    const verifyRes = await fetch(`https://developer.world.org/api/v4/verify/${appId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Mandate-App/1.0",
      },
      body: JSON.stringify({
        ...proof,
        action: action || "mandate-operator-auth",
        signal: signal || "",
        verification_level: proof?.verification_level || "device",
      }),
    });

    const responseText = await verifyRes.text();
    let verifyData;
    try {
      verifyData = JSON.parse(responseText);
    } catch (e) {
      // World's verify endpoint returned something that isn't JSON (a gateway
      // error page, a timeout page, etc). This must fail closed — verification
      // is a security gate, and an upstream hiccup is not proof of a real
      // World ID proof. Never treat "we couldn't parse the response" as
      // "verified: true".
      return Response.json({
        success: false,
        verified: false,
        error: 'World ID verification service returned an unexpected response.',
      }, { status: 502 });
    }
    
    if (verifyRes.ok && verifyData.success) {
      return Response.json({ success: true, verified: true, data: verifyData });
    } else {
      return Response.json(
        { success: false, verified: false, error: verifyData },
        { status: 400 }
      );
    }
  } catch (error) {
    return Response.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
