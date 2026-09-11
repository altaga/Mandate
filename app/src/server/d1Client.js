// Shared server-only D1 REST client. Every store in this directory that
// needs state shared across concurrent server instances (not just
// globalThis, which only holds for one process — see trafficLabStore.js and
// infraHealthStore.js's original comments, both wrong under EAS Hosting's
// actual multi-instance runtime) goes through this.
const D1_DATABASE_ID = '15fa0b96-c498-402f-a4e5-361576b4a490';

export async function queryD1(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return null;

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${D1_DATABASE_ID}/query`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql, params }),
      }
    );
    const data = await res.json();
    if (!res.ok || !data.success) {
      console.warn('[d1Client] query failed:', JSON.stringify(data.errors));
      return null;
    }
    return data.result?.[0]?.results || [];
  } catch (err) {
    console.warn('[d1Client] request error:', err.message);
    return null;
  }
}

// Fire-and-forget write — callers that are in the hot path of a real user
// request (recording a hit, logging an outcome) should never let a D1
// round-trip add latency to the actual response. Errors are already logged
// inside queryD1.
export function queryD1Async(sql, params = []) {
  queryD1(sql, params).catch(() => {});
}
