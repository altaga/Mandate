const ALLOWED_ORIGINS = [
  "https://mandate.expo.app",
  "http://localhost:8081"
];

export function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (origin) return ALLOWED_ORIGINS.includes(origin);

  // No Origin header at all. Real browsers omit it on simple same-origin GET/HEAD
  // requests, so keep those permissive (read-only, lower risk either way).
  // But browsers ALWAYS attach Origin on same-origin POST/PUT/PATCH/DELETE, so a
  // state-changing request with no Origin isn't a real browser call — it's a
  // script/curl with no credentials. Deny it; it must use x-api-key instead
  // (checked earlier in +middleware.js), same as app/scripts/*.js already do.
  const method = (request.method || "GET").toUpperCase();
  return method === "GET" || method === "HEAD";
}

export function getCorsHeaders(request) {
  const origin = request.headers.get("origin");
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-API-Key, X-Timestamp, X-Signature",
  };
}

export default function CorsHelper() { return null; }
