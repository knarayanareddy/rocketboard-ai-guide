import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";
import { readJson } from "../_shared/http.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGINS")?.split(",")[0] || "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, changed_files, compare_url } = await readJson(req, corsHeaders);

    if (!pack_id || !compare_url) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Fetch the actual diff from GitHub
    // Assuming compare_url is something like https://github.com/owner/repo/compare/hash1...hash2
    const githubToken = Deno.env.get("GITHUB_TOKEN");
    const headers: Record<string, string> = { Accept: "application/vnd.github.v3.diff" };
    if (githubToken) headers.Authorization = `token ${githubToken}`;

    // Convert github.com to api.github.com for diff parsing and format properly
    // This is a naive translation; robust implementations would parse owner/repo/shas
    const apiUrl = compare_url.replace("github.com", "api.github.com/repos");
    
    // SSRF Protection
    const validatedApiUrl = parseAndValidateExternalUrl(apiUrl, {
      allowAnyHost: false,
      allowedHostSuffixes: ["api.github.com"],
      allowHttps: true,
      disallowPrivateIPs: true,
    });

    const diffResp = await fetch(validatedApiUrl, { headers });
    if (!diffResp.ok) throw new Error("Failed to fetch diff");
    const diffText = await diffResp.text();

    if (!diffText || diffText.trim().length === 0) {
      return new Response(JSON.stringify({ message: "Empty diff" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 2. Identify which modules need remediation based on content_freshness or knowledge_chunks
    // For simplicity, we just look up modules that are marked as stale (`content_freshness.is_stale = true`)
    const { data: staleModules, error: staleErr } = await supabase
      .from("content_freshness")
      .select("module_key, section_id, staleness_details")
      .eq("pack_id", pack_id)
      .eq("is_stale", true);

    if (staleErr || !staleModules || staleModules.length === 0) {
      return new Response(JSON.stringify({ message: "No stale modules to remediate" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // 3. For each stale module section, contact LLM to draft an update
    const openAIApiKey = Deno.env.get("OPENAI_API_KEY") || Deno.env.get("LOVABLE_API_KEY");
    if (!openAIApiKey) throw new Error("Missing LLM API Key");

    for (const stale of staleModules) {
      // Fetch current module data
      const { data: mod } = await supabase
        .from("generated_modules")
        .select("module_data")
        .eq("pack_id", pack_id)
        .eq("module_key", stale.module_key)
        .single();
        
      if (!mod) continue;
      const section = (mod.module_data as any).sections?.find((s: any) => s.id === stale.section_id);
      if (!section) continue;

      const originalContent = section.content;

      // Ask LLM to propose a change
      const prompt = `The source code supporting this documentation has changed. Here is the exact diff of the changes:\n\n${diffText.substring(0, 4000)}\n\nHere is the original documentation section:\n\n${originalContent}\n\nPlease completely rewrite this documentation section so it is accurate based on the git diff. Return ONLY the new markdown content. Do NOT include any intro or conversational text.`;

      const llmResp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openAIApiKey}` },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.2
        })
      });

      if (!llmResp.ok) {
        console.error("LLM Error:", await llmResp.text());
        continue;
      }

      const llmData = await llmResp.json();
      const proposedContent = llmData.choices[0].message.content.trim();

      const diffSummary = `Updated based on ${changed_files.length} changed files in recent push.`;

      // Save to module_remediations
      await supabase.from("module_remediations").insert({
        module_key: stale.module_key,
        section_id: stale.section_id,
        original_content: originalContent,
        proposed_content: proposedContent,
        diff_summary: diffSummary,
        status: "pending"
      });
      console.log(`[REMEDIATION] Draft created for ${stale.module_key}/${stale.section_id}`);
    }

    return new Response(JSON.stringify({ success: true, processed: staleModules.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("Remediation error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
