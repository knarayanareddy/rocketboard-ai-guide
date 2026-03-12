import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { packId, messageType, data } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: integration, error } = await supabaseAdmin
      .from('slack_integrations')
      .select('*')
      .eq('pack_id', packId)
      .maybeSingle();

    if (error || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let text = '';
    if (messageType === 'invite') {
      if (!integration.notify_on_invite) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
      text = `📧 New invite sent to ${data?.email} for the pack!`;
    } else if (messageType === 'module_complete') {
      if (!integration.notify_on_module_complete) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
      text = `🎉 A user completed the module: ${data?.moduleTitle}!`;
    } else if (messageType === 'new_source') {
      if (!integration.notify_on_new_source) return new Response(JSON.stringify({ skipped: true }), { headers: corsHeaders });
      text = `📚 New source added: ${data?.sourceLabel}!`;
    } else {
      text = `Notification: ${messageType}`;
    }

    const res = await fetch(integration.webhook_url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Slack API error: ${await res.text()}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
