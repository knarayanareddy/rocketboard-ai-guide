/**
 * _shared/http.ts
 * Standard HTTP response and request helpers for Edge Functions.
 */

export function json(status: number, body: any, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  extra: Record<string, any> = {},
  headers: Record<string, string> = {}
) {
  return json(
    status,
    {
      error: {
        code,
        message,
        ...extra,
      },
    },
    headers
  );
}

export async function readJson(req: Request) {
  try {
    return await req.json();
  } catch (err) {
    throw new Error("Invalid JSON body");
  }
}
