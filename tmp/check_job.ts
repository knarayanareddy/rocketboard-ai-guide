
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = "https://ersqhobqaptsxqclawcc.supabase.co";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""; // Need to check if I have this

if (!serviceKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

const { data, error } = await supabase
  .from("ingestion_jobs")
  .select("*")
  .order("created_at", { ascending: false })
  .limit(1);

if (error) {
  console.error("DB Error:", error);
} else {
  console.log(JSON.stringify(data[0], null, 2));
}
