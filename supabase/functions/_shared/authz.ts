/**
 * _shared/authz.ts
 * Shared authorization and user retrieval helpers.
 */

import { createAnonClient } from "./supabase-clients.ts";
import { jsonError } from "./http.ts";

export function getBearerToken(req: Request): string | undefined {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return undefined;
  return authHeader.substring(7);
}

export async function requireUser(req: Request) {
  const supabase = createAnonClient(req);
  const token = getBearerToken(req);

  if (!token) {
    throw {
      response: jsonError(401, "unauthorized", "Missing or invalid authorization token"),
    };
  }

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    throw {
      response: jsonError(401, "unauthorized", "Invalid or expired session"),
    };
  }

  return { userId: user.id };
}

export function requireInternal(req: Request) {
  const secret = Deno.env.get("ROCKETBOARD_INTERNAL_SECRET");
  const provided = req.headers.get("X-Rocketboard-Internal");

  if (!secret || provided !== secret) {
    // Note: Do not enforce yet as per Task 1 instructions.
    // This helper is provided for future hardening.
    return false;
  }
  return true;
}
