/**
 * _shared/pack-access.ts
 * Shared pack membership and role verification.
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { jsonError } from "./http.ts";

export async function getPackRole(
  serviceClient: SupabaseClient,
  packId: string,
  userId: string
): Promise<string | null> {
  const { data, error } = await serviceClient
    .from("pack_members")
    .select("role, access_level")
    .eq("pack_id", packId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) return null;

  // Handle schema drift: prioritize access_level if present, fallback to role.
  return data.access_level || data.role || null;
}

export async function requirePackRole(
  serviceClient: SupabaseClient,
  packId: string,
  userId: string,
  minRole: string
) {
  const role = await getPackRole(serviceClient, packId, userId);

  const roles = ["read_only", "learner", "author", "admin", "owner"];
  const minIdx = roles.indexOf(minRole);
  const currentIdx = role ? roles.indexOf(role) : -1;

  if (currentIdx < minIdx) {
    throw {
      response: jsonError(403, "forbidden", `Requires ${minRole} access level`),
    };
  }

  return { role };
}
