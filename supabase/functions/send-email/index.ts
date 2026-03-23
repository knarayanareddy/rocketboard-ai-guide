import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.6";
import { json, jsonError, readJson } from "../_shared/http.ts";
import { parseAllowedOrigins, buildCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getBearerToken } from "../_shared/authz.ts";

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

serve(async (req) => {
  const allowedOrigins = parseAllowedOrigins();
  const corsResponse = handleCorsPreflight(req, allowedOrigins);
  if (corsResponse) return corsResponse;

  const corsHeaders = buildCorsHeaders(req, allowedOrigins);

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // 1. Get the session or user object securely
    const token = getBearerToken(req);
    if (!token) {
      return jsonError(401, "unauthorized", "Missing Authorization header", {}, corsHeaders);
    }

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('Authentication error:', userError);
      return jsonError(401, "unauthorized", "Unauthorized", {}, corsHeaders);
    }

    // 2. Parse request
    const { to, subject, html, userId, type } = await readJson(req);

    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is not configured. Please add it to your Supabase project secrets.');
    }

    // 3. Optional: Check notification preferences (requires Admin access)
    if (userId && type) {
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
          return json(200, { skipped: true, reason: 'user preference' }, corsHeaders);
        }
        if (type === 'module_published' && !prefs.email_module_published) {
          return json(200, { skipped: true, reason: 'user preference' }, corsHeaders);
        }
        if (type === 'milestone' && !prefs.email_milestones) {
          return json(200, { skipped: true, reason: 'user preference' }, corsHeaders);
        }
        if (type === 'weekly_digest' && !prefs.email_weekly_digest) {
          return json(200, { skipped: true, reason: 'user preference' }, corsHeaders);
        }
      }
    }

    // 4. Deliver email
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

    return json(200, { success: true, data: resData }, corsHeaders);

  } catch (error: any) {
    console.error(`[INTERNAL ERROR] ${error.message}`);
    return jsonError(500, "internal_error", error.message, {}, corsHeaders);
  }
});
