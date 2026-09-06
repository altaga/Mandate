import { getCorsHeaders } from "./corsHelper";

export function withSecurity(handler) {
  return async (request) => {
    try {
      const response = await handler(request);
      const cors = getCorsHeaders(request);
      return new Response(response.body, {
        ...response,
        headers: {
          ...Object.fromEntries(response.headers.entries()),
          ...cors,
        },
      });
    } catch (_err) {
      return Response.json({ error: "Internal Error" }, { status: 500 });
    }
  };
}

export default function WithSecurity() { return null; }
