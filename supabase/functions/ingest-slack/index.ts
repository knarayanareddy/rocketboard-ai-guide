import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const REDACTION_PATTERNS = [
  /AKIA[0-9A-Z]{16}/g,
  /sk-[A-Za-z0-9]{32,}/g,
  /xox[bpas]-[A-Za-z0-9-]{10,}/g,
  /ghp_[A-Za-z0-9]{36}/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
];

const VALUE_KEYWORDS = [
  "decision", "architecture", "we decided", "going forward", "convention",
  "standard", "how to", "runbook", "process", "migration", "deprecated",
  "breaking change", "announcement", "important", "fyi", "heads up"
];

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redactSecrets(text: string): string {
  let result = text;
  for (const pattern of REDACTION_PATTERNS) {
    pattern.lastIndex = 0;
    result = result.replace(pattern, "***REDACTED***");
  }
  return result;
}

function isHighValueMessage(msg: any): boolean {
  if (!msg.text) return false;
  
  // Has thread replies (discussion)
  if (msg.reply_count && msg.reply_count >= 2) return true;
  
  // Has reactions (engagement)
  if (msg.reactions && msg.reactions.length >= 2) return true;
  
  // Contains code or doc links
  if (msg.text.match(/github\.com|gitlab\.com|notion\.so|confluence|figma\.com|docs\./i)) return true;
  
  // Contains valuable keywords
  const lowerText = msg.text.toLowerCase();
  if (VALUE_KEYWORDS.some(kw => lowerText.includes(kw))) return true;
  
  // Has file attachments
  if (msg.files && msg.files.length > 0) return true;
  
  return false;
}

function formatTimestamp(ts: string): string {
  const date = new Date(parseFloat(ts) * 1000);
  return date.toISOString().split("T")[0];
}

async function slackAPI(token: string, method: string, params: Record<string, any> = {}) {
  const url = new URL(`https://slack.com/api/${method}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) url.searchParams.set(k, String(v));
  }
  const resp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await resp.json();
  if (!data.ok) throw new Error(`Slack API error: ${data.error}`);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { pack_id, source_id, source_config } = await req.json();
    const {
      bot_token,
      channel_ids = [],
      days_back = 30,
      threaded_only = false,
      pinned_only = false,
      min_reactions = 0,
    } = source_config || {};

    if (!bot_token || channel_ids.length === 0) {
      return new Response(JSON.stringify({ error: "Missing bot_token or channel_ids" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: job } = await supabase.from("ingestion_jobs")
      .insert({ pack_id, source_id, status: "processing", started_at: new Date().toISOString() })
      .select().single();
    const jobId = job!.id;

    // Build user cache for display names
    const userCache: Record<string, string> = {};
    try {
      const usersResp = await slackAPI(bot_token, "users.list", { limit: 200 });
      for (const user of usersResp.members || []) {
        userCache[user.id] = user.profile?.display_name || user.real_name || user.name || "Unknown";
      }
    } catch { /* ignore - will use IDs */ }

    // Get channel info
    const channelNames: Record<string, string> = {};
    for (const channelId of channel_ids) {
      try {
        const info = await slackAPI(bot_token, "conversations.info", { channel: channelId });
        channelNames[channelId] = info.channel?.name || channelId;
      } catch {
        channelNames[channelId] = channelId;
      }
    }

    const chunks: any[] = [];
    let chunkIdx = 0;
    const oldest = Math.floor((Date.now() - days_back * 24 * 60 * 60 * 1000) / 1000);

    for (const channelId of channel_ids) {
      const channelName = channelNames[channelId];
      
      // Get pinned messages if requested
      let pinnedTs = new Set<string>();
      if (pinned_only) {
        try {
          const pins = await slackAPI(bot_token, "pins.list", { channel: channelId });
          for (const item of pins.items || []) {
            if (item.message?.ts) pinnedTs.add(item.message.ts);
          }
        } catch { /* ignore */ }
      }

      // Fetch message history
      let messages: any[] = [];
      let cursor: string | undefined;
      let fetchCount = 0;
      const maxFetches = 10; // Max 1000 messages per channel

      while (fetchCount < maxFetches) {
        const historyResp = await slackAPI(bot_token, "conversations.history", {
          channel: channelId,
          oldest,
          limit: 100,
          cursor,
        });
        messages.push(...(historyResp.messages || []));
        cursor = historyResp.response_metadata?.next_cursor;
        if (!cursor) break;
        fetchCount++;
      }

      // Filter high-value messages
      const valuableMessages = messages.filter(msg => {
        if (msg.subtype === "channel_join" || msg.subtype === "channel_leave") return false;
        if (pinned_only && !pinnedTs.has(msg.ts)) return false;
        if (threaded_only && !msg.reply_count) return false;
        if (min_reactions > 0 && (!msg.reactions || msg.reactions.length < min_reactions)) return false;
        return isHighValueMessage(msg);
      });

      // Process each valuable message (with threads if applicable)
      for (const msg of valuableMessages) {
        let content = "";
        const date = formatTimestamp(msg.ts);
        const userName = userCache[msg.user] || "[team member]";

        if (msg.reply_count && msg.reply_count > 0) {
          // Fetch thread
          try {
            const threadResp = await slackAPI(bot_token, "conversations.replies", {
              channel: channelId,
              ts: msg.ts,
              limit: 50,
            });
            
            content = `# Thread in #${channelName} (${date})\n\n`;
            for (const reply of threadResp.messages || []) {
              const replyUser = userCache[reply.user] || "[team member]";
              const replyText = redactSecrets(reply.text || "");
              content += `**${replyUser}**: ${replyText}\n\n`;
            }
          } catch {
            content = `# Message in #${channelName} (${date})\n\n**${userName}**: ${redactSecrets(msg.text || "")}\n`;
          }
        } else {
          content = `# Message in #${channelName} (${date})\n\n**${userName}**: ${redactSecrets(msg.text || "")}\n`;
        }

        // Add reaction info
        if (msg.reactions?.length) {
          const reactions = msg.reactions.map((r: any) => `:${r.name}: (${r.count})`).join(" ");
          content += `\nReactions: ${reactions}\n`;
        }

        chunkIdx++;
        const hash = await sha256(content);
        chunks.push({
          chunk_id: `C${String(chunkIdx).padStart(5, "0")}`,
          path: `slack:${channelName}/${date}/${msg.ts}`,
          start_line: 1,
          end_line: content.split("\n").length,
          content,
          content_hash: hash,
          is_redacted: false,
          pack_id,
          source_id,
          metadata: {
            channel_id: channelId,
            channel_name: channelName,
            message_ts: msg.ts,
            reply_count: msg.reply_count || 0,
            reaction_count: msg.reactions?.length || 0,
          },
        });
      }

      await supabase.from("ingestion_jobs").update({ processed_chunks: chunks.length }).eq("id", jobId);
    }

    await supabase.from("ingestion_jobs").update({ total_chunks: chunks.length }).eq("id", jobId);

    // Upsert chunks
    for (let i = 0; i < chunks.length; i += 100) {
      await supabase.from("knowledge_chunks").upsert(chunks.slice(i, i + 100), { onConflict: "pack_id,chunk_id" });
    }

    await supabase.from("pack_sources").update({ last_synced_at: new Date().toISOString() }).eq("id", source_id);
    await supabase.from("ingestion_jobs").update({
      status: "completed",
      processed_chunks: chunks.length,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    return new Response(JSON.stringify({ success: true, job_id: jobId, chunks: chunks.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Slack ingestion error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
