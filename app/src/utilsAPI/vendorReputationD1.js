// Server-only: reads the Cloudflare API token. Computes REAL vendor reputation
// from the outcomes actually logged by the deployed x402 vendor Workers into
// the mandate-reputation D1 database — not a static number.

const D1_DATABASE_ID = '15fa0b96-c498-402f-a4e5-361576b4a490';
const MIN_SAMPLES_FOR_LIVE_SCORE = 3;

async function queryD1(sql, params = []) {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;
  if (!accountId || !apiToken) return [];

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
    if (!res.ok || !data.success) return [];
    return data.result?.[0]?.results || [];
  } catch (err) {
    console.warn('[vendorReputationD1] query failed:', err.message);
    return [];
  }
}

/**
 * Returns { [vendorId]: { successRate, avgLatencyMs, sampleSize, source: 'live_d1' } }
 * for every vendor with at least MIN_SAMPLES_FOR_LIVE_SCORE real logged outcomes
 * in the last 50 rows. Vendors below that threshold are simply absent from the
 * result — callers should keep their static catalog reputation for those.
 */
export async function getLiveVendorReputation() {
  const rows = await queryD1(
    `SELECT vendor_id,
            AVG(success) * 100.0 AS success_rate,
            AVG(latency_ms) AS avg_latency_ms,
            COUNT(*) AS sample_size
     FROM (SELECT * FROM outcomes ORDER BY id DESC LIMIT 200)
     GROUP BY vendor_id`
  );

  const result = {};
  for (const row of rows) {
    if (Number(row.sample_size) < MIN_SAMPLES_FOR_LIVE_SCORE) continue;
    result[row.vendor_id] = {
      successRate: Math.round(Number(row.success_rate) * 10) / 10,
      avgLatencyMs: Math.round(Number(row.avg_latency_ms)),
      sampleSize: Number(row.sample_size),
      source: 'live_d1',
    };
  }
  return result;
}
