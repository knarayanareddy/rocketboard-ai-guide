import {
  buildCorsHeaders,
  handleCorsPreflight,
  parseAllowedOrigins,
} from "../_shared/cors.ts";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { createServiceClient } from "../_shared/supabase-clients.ts";

function hexToUint8Array(hex: string): Uint8Array {
  const view = new Uint8Array(hex.length / 2);
  for (let i = 0; i < view.length; i++) {
    view[i] = parseInt(hex.substring(i * 2, i * 2 + 2), 16);
  }
  return view;
}

Deno.serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const serviceClient = createServiceClient();

    // GitHub sends events as POST
    const signature = req.headers.get("x-hub-signature-256");
    const event = req.headers.get("x-github-event");

    if (event !== "push") {
      return json(200, { message: "Ignored event" }, corsHeaders);
    }

    // 1. Verify Signature
    const webhookSecret = Deno.env.get("GITHUB_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.warn(
        "[WEBHOOK WARNING] GITHUB_WEBHOOK_SECRET not set, bypassing signature check (INSECURE)",
      );
    } else if (!signature) {
      console.error("[WEBHOOK ERROR] Missing x-hub-signature-256 header");
      return jsonError(
        401,
        "unauthorized",
        "Missing signature",
        {},
        corsHeaders,
      );
    } else {
      const bodyText = await req.text();
      const hmac = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(webhookSecret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["verify"],
      );
      const isVerified = await crypto.subtle.verify(
        "HMAC",
        hmac,
        hexToUint8Array(signature.replace("sha256=", "")).buffer,
        new TextEncoder().encode(bodyText),
      );

      if (!isVerified) {
        console.error("[WEBHOOK ERROR] Invalid HMAC signature");
        return jsonError(
          401,
          "unauthorized",
          "Invalid signature",
          {},
          corsHeaders,
        );
      }

      var payload = JSON.parse(bodyText);
    }

    if (typeof payload === "undefined") {
      payload = await readJson(req, corsHeaders);
    }
    const repoUrl = payload.repository?.html_url;

    if (!repoUrl) {
      return new Response(JSON.stringify({ error: "Invalid payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find all packs that use this repository as a source
    const { data: sources, error: sErr } = await supabase
      .from("pack_sources")
      .select("pack_id")
      .ilike("source_uri", `%${repoUrl}%`);

    if (sErr) throw sErr;

    const packIds = [...new Set((sources || []).map((s) => s.pack_id))];
    console.log(
      `[WEBHOOK] Push to ${repoUrl} affects ${packIds.length} pack(s)`,
    );

    const commits = payload.commits || [];
    const changedFiles = new Set<string>();
    commits.forEach((c: any) => {
      (c.added || []).forEach((f: string) => changedFiles.add(f));
      (c.modified || []).forEach((f: string) => changedFiles.add(f));
      (c.removed || []).forEach((f: string) => changedFiles.add(f));
    });
    const changedFilesList = Array.from(changedFiles);
    const compareUrl = payload.compare;

    // Trigger staleness check and remediation for each affected pack
    for (const packId of packIds) {
      // 1. Mark as stale
      await fetch(`${supabaseUrl}/functions/v1/check-staleness`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({ pack_id: packId }),
      });
      console.log(`[WEBHOOK] Triggered staleness check for pack ${packId}`);

      // 2. Trigger async remediation drafting
      if (changedFilesList.length > 0 && compareUrl) {
        await fetch(`${supabaseUrl}/functions/v1/auto-remediate-module`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            pack_id: packId,
            changed_files: changedFilesList,
            compare_url: compareUrl,
          }),
        });
        console.log(`[WEBHOOK] Triggered auto-remediation for pack ${packId}`);
      }
    }

    return json(
      200,
      { success: true, affected_packs: packIds.length },
      corsHeaders,
    );
  } catch (err: any) {
    console.error("Webhook error:", err);
    return jsonError(500, "internal_error", err.message, {}, corsHeaders);
  }
});
