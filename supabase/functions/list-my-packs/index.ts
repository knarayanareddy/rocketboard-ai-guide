import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS_ENV = Deno.env.get("ALLOWED_ORIGINS") || "http://localhost:5173,http://localhost:8080";
const ALLOWED_ORIGINS = ALLOWED_ORIGINS_ENV.split(",").map(o => o.trim());

function getCorsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin",
  };
  
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  
  return headers;
}

// Simple in-memory rate limiting (max 30 requests per minute per user)
const rateLimits = new Map<string, { count: number, resetAt: number }>();

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  let limit = rateLimits.get(userId);
  
  if (!limit || now > limit.resetAt) {
    limit = { count: 0, resetAt: now + 60000 };
    rateLimits.set(userId, limit);
  }
  
  limit.count++;
  if (limit.count > 30) {
    return false; // Rate limited
  }
  return true;
}

// Generate minimal UUID for logging
function generateTraceId() {
  return crypto.randomUUID();
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const traceId = generateTraceId();

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized: Missing or invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user via JWT
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.warn(`[${traceId}] Failed auth check.`);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(user.id)) {
      console.warn(`[${traceId}] Rate limit exceeded for user: ${user.id}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to bypass RLS and explicitly join pack_members
    const admin = createClient(supabaseUrl, supabaseServiceKey);
    
    // Explicitly query packs INNER JOIN pack_members for security
    // Only return non-sensitive fields
    const { data: packs, error: dbError } = await admin.from("packs")
      .select("id, title, description, org_id, updated_at, pack_members!inner(access_level, user_id)")
      .eq("pack_members.user_id", user.id)
      .order("title", { ascending: true });

    if (dbError) {
      console.error(`[${traceId}] DB Error:`, dbError.message);
      return new Response(JSON.stringify({ error: "Internal Server Error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Map to a cleaner minimal structure for the extension
    const mappedPacks = (packs || []).map(p => ({
      pack_id: p.id,
      title: p.title,
      description: p.description,
      org_id: p.org_id,
      access_level: p.pack_members?.[0]?.access_level || 'unknown',
      updated_at: p.updated_at
    }));

    console.log(`[${traceId}] User ${user.id} fetched ${mappedPacks.length} packs.`);

    return new Response(JSON.stringify({ packs: mappedPacks }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error(`[${traceId}] Unexpected error:`, err.message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
