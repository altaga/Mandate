import { getCorsHeaders, isAllowedOrigin } from "../utilsAPI/corsHelper";

export const unstable_settings = {
  matcher: {
    patterns: [
      "/api",           
      "/api/[...path]"  
    ],
  },
};

export default function middleware(request) {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: getCorsHeaders(request),
    });
  }

  const apiKey = request.headers.get("x-api-key");
  if (apiKey && apiKey === process.env.ADMIN_API_KEY) {
    return;
  }

  if (!isAllowedOrigin(request)) {
    return Response.json(
      { error: "CORS error: Origin not allowed" },
      { status: 403, headers: getCorsHeaders(request) }
    );
  }
}
