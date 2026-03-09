import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, html, userId, type } = await req.json();

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured. Please add it to your Supabase project secrets.');
    }

    if (userId && type) {
      // Check notification preferences
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: prefs } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (prefs) {
        if (type === 'invite' && !prefs.email_invites) {
          return new Response(JSON.stringify({ skipped: true, reason: 'user preference' }), { headers: corsHeaders });
        }
        if (type === 'module_published' && !prefs.email_module_published) {
          return new Response(JSON.stringify({ skipped: true, reason: 'user preference' }), { headers: corsHeaders });
        }
        if (type === 'milestone' && !prefs.email_milestones) {
          return new Response(JSON.stringify({ skipped: true, reason: 'user preference' }), { headers: corsHeaders });
        }
        if (type === 'weekly_digest' && !prefs.email_weekly_digest) {
          return new Response(JSON.stringify({ skipped: true, reason: 'user preference' }), { headers: corsHeaders });
        }
      }
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'RocketBoard <onboarding@resend.dev>',
        to: [to],
        subject: subject,
        html: html,
      }),
    });

    const resData = await res.json();
    if (!res.ok) {
      throw new Error(`Resend API error: ${JSON.stringify(resData)}`);
    }

    return new Response(JSON.stringify({ success: true, data: resData }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
