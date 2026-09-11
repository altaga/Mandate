// Server-only: reads the Cloudflare API token, must never be imported from a client component.
// Enrolled users now live in Cloudflare D1 (mandate-users) instead of Supabase — this app
// runs as a normal Node/Expo server (not a Cloudflare Worker), so there's no native D1
// binding available; we talk to D1 over its REST query API instead.

const D1_DATABASE_ID = 'a3f5a426-5495-4ba3-af34-830777b38b1a';

async function queryD1(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) {
    throw new Error('[Configuration Error] Missing required environment variable: CLOUDFLARE_ACCOUNT_ID or CLOUDFLARE_API_TOKEN. Please set them in app/.env');
  }

  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sql, params }),
    }
  );

  const data = await res.json();
  if (!res.ok || !data.success) {
    const message = data.errors?.[0]?.message || `D1 query failed with HTTP ${res.status}`;
    throw new Error(message);
  }
  return data.result?.[0]?.results || [];
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
    enrolledAt: r.enrolled_at,
  };
}

export async function getAllEnrolledUsersFromDb() {
  const rows = await queryD1('SELECT * FROM enrolled_users ORDER BY enrolled_at DESC');
  return rows.map(mapEnrolledUserRow);
}

export async function getEnrolledUserByWallet(walletAddress) {
  const rows = await queryD1(
    'SELECT * FROM enrolled_users WHERE wallet_address = ? LIMIT 1',
    [walletAddress]
  );
  return rows[0] ? mapEnrolledUserRow(rows[0]) : null;
}

export async function upsertEnrolledUser(profile) {
  const vectorString = JSON.stringify(profile.faceVector || []);
  await queryD1(
    `INSERT INTO enrolled_users (id, name, email, wallet_address, agent_key, face_vector, world_nullifier, enrolled_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       email = excluded.email,
       wallet_address = excluded.wallet_address,
       agent_key = excluded.agent_key,
       face_vector = excluded.face_vector,
       world_nullifier = excluded.world_nullifier,
       enrolled_at = excluded.enrolled_at`,
    [
      profile.id,
      profile.name || null,
      profile.email || null,
      profile.walletAddress || null,
      profile.agentKey || null,
      vectorString,
      profile.worldNullifier || null,
      profile.enrolledAt || new Date().toISOString(),
    ]
  );
}
