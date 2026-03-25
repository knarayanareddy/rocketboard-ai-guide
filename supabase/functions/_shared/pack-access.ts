/**
 * _shared/pack-access.ts
 * Shared pack membership and role verification.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { jsonError } from "./http.ts";

export async function getPackRole(
  serviceClient: SupabaseClient,
  packId: string,
  userId: string,
): Promise<{ role: string | null; org_id: string | null }> {
  if (userId === "admin") {
    return { role: "owner", org_id: null };
  }
  const { data, error } = await serviceClient
    .from("pack_members")
    .select("access_level, packs:pack_id(org_id)")
    .eq("pack_id", packId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return { role: null, org_id: null };

  const role = data.access_level || null;
  const org_id = (data as any).packs?.org_id || null;
  return { role, org_id };
}

export async function requirePackRole(
  serviceClient: SupabaseClient,
  packId: string,
  userId: string,
  minRole: string,
  headers?: Record<string, string>,
) {
  const { role, org_id } = await getPackRole(serviceClient, packId, userId);

  const roles = ["read_only", "learner", "author", "admin", "owner"];
  const minIdx = roles.indexOf(minRole);

  if (minIdx === -1) {
    throw {
      response: jsonError(
        500,
        "internal_error",
        `Invalid server configuration: unknown minRole "${minRole}"`,
        {},
        headers,
      ),
    };
  }

  const currentIdx = role ? roles.indexOf(role) : -1;

  if (currentIdx < minIdx) {
    throw {
      response: jsonError(
        403,
        "forbidden",
        `Requires ${minRole} access level`,
        {},
        headers,
      ),
    };
  }

  return { role, org_id };
}
