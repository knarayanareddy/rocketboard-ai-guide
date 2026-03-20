import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { parsePatch, applyPatch } from "https://esm.sh/diff@5.1.0";
import { getSourceCredential } from "../_shared/credentials.ts";
import { parseAndValidateExternalUrl } from "../_shared/external-url-policy.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, proposal_id } = await req.json();

    if (!pack_id || !proposal_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // 1. Authenticate & Check Author Access
    const authHeader = req.headers.get("Authorization")!;
    const { data: { user }, error: authError } = await adminClient.auth.getUser(authHeader.replace("Bearer ", ""));
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }

    const { data: member, error: memberError } = await adminClient
      .from("pack_members")
      .select("access_level")
      .eq("pack_id", pack_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (memberError || !member || !['author', 'admin'].includes(member.access_level)) {
      return new Response(JSON.stringify({ error: "Forbidden: Author access required" }), { status: 403, headers: corsHeaders });
    }

    // 2. Fetch Proposal
    const { data: proposal, error: proposalError } = await adminClient
      .from("change_proposals")
      .select("*")
      .eq("id", proposal_id)
      .single();

    if (proposalError || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: corsHeaders });
    }

    if (proposal.status !== 'approved') {
      return new Response(JSON.stringify({ error: "Only approved proposals can be turned into PRs" }), { status: 400, headers: corsHeaders });
    }

    // 3. Get GitHub Credentials
    const githubToken = await getSourceCredential(adminClient, proposal.source_id);
    if (!githubToken) {
      return new Response(JSON.stringify({ error: "GitHub credentials not found for this source" }), { status: 500, headers: corsHeaders });
    }

    // 4. Fetch Source Info
    const { data: source } = await adminClient
      .from("pack_sources")
      .select("source_uri")
      .eq("id", proposal.source_id)
      .single();

    if (!source || !source.source_uri) {
      throw new Error("Source URI not found");
    }

    // Parse owner/repo from source_uri (e.g., https://github.com/owner/repo)
    const urlParts = new URL(source.source_uri).pathname.split('/').filter(Boolean);
    const owner = urlParts[0];
    const repo = urlParts[1];
    const baseBranch = proposal.target_base_branch || 'main';
    const newBranch = `rocketboard/proposal-${proposal_id.slice(0, 8)}`;

    const githubHeaders = {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    };

    const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

    // Helper for GitHub API calls with SSRF protection
    const ghFetch = async (path: string, options: RequestInit = {}) => {
      const url = parseAndValidateExternalUrl(`${apiBase}${path}`, {
        allowedHostSuffixes: ["api.github.com"],
      });
      const res = await fetch(url, { ...options, headers: { ...githubHeaders, ...options.headers } });
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${err}`);
      }
      return res.json();
    };

    console.log(`[WRITE-BACK] Creating PR for ${owner}/${repo} from proposal ${proposal_id}`);

    // A. Get Base Branch SHA
    const baseRef = await ghFetch(`/git/refs/heads/${baseBranch}`);
    const baseSha = baseRef.object.sha;

    // B. Apply Multi-file Patch & Create Blobs
    const patches = parsePatch(proposal.patch_unified);
    const treeItems = [];

    if (patches.length === 0) {
      throw new Error("No patches found in proposal. Unified diff might be malformed.");
    }

    for (const patch of patches) {
      // Robust path detection from patch headers
      const rawPath = patch.newFileName || patch.oldFileName;
      if (!rawPath) continue;

      // Strip common prefixes like a/ and b/ from git diffs
      const normalizedPath = rawPath.replace(/^[ab]\//, "");
      
      // 1. Get current content from GitHub
      let currentContent = "";
      try {
        const fileData = await ghFetch(`/contents/${normalizedPath}?ref=${baseSha}`);
        // GitHub returns base64 with newlines. 
        // Robust base64 to utf8 decoding:
        const binary = atob(fileData.content.replace(/\n/g, ""));
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        currentContent = new TextDecoder().decode(bytes);
      } catch (e) {
        console.warn(`[WRITE-BACK] File ${normalizedPath} not found, assuming new file creation.`);
      }

      // 2. Apply patch to content
      const result = applyPatch(currentContent, patch);
      
      if (result === false) {
        throw new Error(`Conflict: Failed to apply patch to "${normalizedPath}".`);
      }

      // 3. Create Blob for the new content
      const blob = await ghFetch(`/git/blobs`, {
        method: "POST",
        body: JSON.stringify({
          content: result,
          encoding: "utf-8"
        })
      });
      
      treeItems.push({
        path: normalizedPath,
        mode: "100644",
        type: "blob",
        sha: blob.sha
      });
    }

    // C. Create Tree
    const tree = await ghFetch(`/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: baseSha,
        tree: treeItems
      })
    });

    // D. Create Commit
    const commit = await ghFetch(`/git/commits`, {
      method: "POST",
      body: JSON.stringify({
        message: proposal.title,
        tree: tree.sha,
        parents: [baseSha]
      })
    });

    // E. Create Branch Ref
    await ghFetch(`/git/refs`, {
      method: "POST",
      body: JSON.stringify({
        ref: `refs/heads/${newBranch}`,
        sha: commit.sha
      })
    });

    // F. Create Pull Request
    const pr = await ghFetch(`/pulls`, {
      method: "POST",
      body: JSON.stringify({
        title: proposal.title,
        body: proposal.description || `Proposal created via RocketBoard.\n\nProposal ID: ${proposal_id}`,
        head: newBranch,
        base: baseBranch
      })
    });

    // 5. Update Proposal & Audit
    await adminClient
      .from("change_proposals")
      .update({
        status: 'pr_opened',
        pr_url: pr.html_url
      })
      .eq("id", proposal_id);

    // Audit Event
    await adminClient.from("lifecycle_audit_events").insert({
        pack_id: pack_id,
        event_type: 'proposal_pr_created',
        details: {
            proposal_id: proposal_id,
            pr_url: pr.html_url,
            owner,
            repo,
            branch: newBranch
        }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      pr_url: pr.html_url,
      branch: newBranch
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (err: any) {
    console.error("[WRITE-BACK] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});
