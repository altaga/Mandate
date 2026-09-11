// Server-only: fixed-window, per-IP rate limiting backed by Cloudflare D1.
// Every route here is only CORS-gated (see SECURITY.md) — CORS stops a
// browser-based attacker from riding a victim's session, but does nothing to
// stop many direct calls back to back. Per-call amount caps (agent-pay,
// treasury/grant) bound each request; this bounds how often any single
// caller can make them at all.
//
// D1 gives one atomic statement per check (INSERT ... ON CONFLICT DO UPDATE
// ... RETURNING count), so concurrent requests from the same caller can't
// race past the limit the way an in-memory counter could across multiple
// server instances.

const D1_DATABASE_ID = '15fa0b96-c498-402f-a4e5-361576b4a490';

async function queryD1(sql, params = []) {
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
      // Log so a real bug here (bad SQL, wrong param count) is visible in
      // server logs instead of silently degrading into "never rate limited"
      // — fail-open is an intentional availability tradeoff, not a place to
      // hide mistakes.
      console.warn('[rateLimitGuard] D1 query failed:', JSON.stringify(data.errors));
      return null;
    }
    return data.result?.[0]?.results || [];
  } catch (err) {
    console.warn('[rateLimitGuard] D1 request error:', err.message);
    return null;
  }
}

export function resolveClientIp(request) {
  const headers = request.headers;
  const candidates = [
    headers.get('cf-connecting-ip'),
    headers.get('x-real-ip'),
    (headers.get('x-forwarded-for') || '').split(',')[0].trim(),
  ].filter(Boolean);
  // No IP header at all (e.g. same-machine testing) falls back to one shared
  // bucket per route — stricter than not limiting, never a bypass.
  return candidates[0] || 'unknown';
}

/**
 * Returns { limited: false } if the call is allowed, or
 * { limited: true, retryAfterSeconds } if the caller has exceeded `limit`
 * calls to `route` within the last `windowMs`. Fails open (never blocks) if
 * D1 is unreachable — availability of the demo matters more than a rate
 * limit staying perfectly enforced during a Cloudflare outage, and every
 * route this guards already has its own per-call amount/allowlist bound.
 */
export async function checkRateLimit({ request, route, limit, windowMs }) {
  const clientIp = resolveClientIp(request);
  const windowIndex = Math.floor(Date.now() / windowMs);
  const bucketKey = `${route}:${clientIp}:${windowIndex}`;

  const rows = await queryD1(
    `INSERT INTO rate_limits (bucket_key, window_start, count)
     VALUES (?, ?, 1)
     ON CONFLICT(bucket_key) DO UPDATE SET count = count + 1
     RETURNING count`,
    [bucketKey, Date.now()]
  );

  // Cheap, probabilistic cleanup of expired windows — no cron job available
  // here, so piggyback on ~2% of requests instead of growing the table
  // forever or paying a DELETE on every single call.
  if (Math.random() < 0.02) {
    queryD1('DELETE FROM rate_limits WHERE window_start < ?', [Date.now() - windowMs * 4]).catch(() => {});
  }

  if (rows === null) return { limited: false };

  const count = rows[0]?.count || 0;
  if (count > limit) {
    const retryAfterSeconds = Math.ceil(((windowIndex + 1) * windowMs - Date.now()) / 1000);
    return { limited: true, retryAfterSeconds };
  }
  return { limited: false };
}

export function rateLimitResponse(retryAfterSeconds) {
  return Response.json(
    { error: `Too many requests. Try again in ${retryAfterSeconds}s.` },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}
