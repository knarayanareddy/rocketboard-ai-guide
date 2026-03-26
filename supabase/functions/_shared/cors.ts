/**
 * _shared/cors.ts
 * Centralized CORS management.
 */

export function parseAllowedOrigins() {
  const env = Deno.env.get("ALLOWED_ORIGINS") ||
    "http://localhost:5173,http://localhost:8080,http://127.0.0.1:5173,http://127.0.0.1:8080";
  return env.split(",").map((o) => o.trim().replace(/\/$/, ""));
}

export function buildCorsHeaders(req: Request, allowedOrigins: string[]) {
  const origin = req.headers.get("Origin")?.replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, mcp-session-id",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE",
    "Vary": "Origin",
  };

  if (origin && allowedOrigins.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = req.headers.get("Origin")!;
  }
  // NEVER return "*" here, as per requirements.

  return headers;
}

export function handleCorsPreflight(req: Request, allowedOrigins: string[]) {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(req, allowedOrigins),
    });
  }
  return null;
}
