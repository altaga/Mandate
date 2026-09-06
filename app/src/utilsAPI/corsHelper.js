const ALLOWED_ORIGINS = [
  "https://YOUR_WEBSITE_URL.com", 
  "http://localhost:8081" 
];

export function isAllowedOrigin(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return ALLOWED_ORIGINS.includes(origin);
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
