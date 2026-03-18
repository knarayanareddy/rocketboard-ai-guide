
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Langfuse } from "npm:langfuse@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    console.log("[sync-feedback] Received payload:", payload);

    // Supabase Webhooks send the row in payload.record
    const record = payload.record || payload;
    const { trace_id, rating, feedback_text, category } = record;

    if (!trace_id) {
      return new Response(JSON.stringify({ skipped: "No trace_id found in record" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const langfuse = new Langfuse({
      publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY")!,
      secretKey: Deno.env.get("LANGFUSE_SECRET_KEY")!,
      baseUrl: Deno.env.get("LANGFUSE_BASE_URL") || "https://cloud.langfuse.com",
    });

    // Map rating/category to numeric score if possible
    // e.g. Positive = 1, Negative = -1
    let scoreValue = 0;
    if (rating === "positive") scoreValue = 1;
    if (rating === "negative") scoreValue = -1;
    
    // We can also emit a boolean score for "has-comment"
    if (feedback_text) {
      await langfuse.score({
        traceId: trace_id,
        name: "user-comment-provided",
        value: 1,
        comment: feedback_text.slice(0, 100),
      });
    }

    await langfuse.score({
      traceId: trace_id,
      name: "user-feedback",
      value: scoreValue,
      comment: category || rating,
    });

    await langfuse.shutdownAsync();

    return new Response(JSON.stringify({ success: true, trace_id, score: scoreValue }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-feedback] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
