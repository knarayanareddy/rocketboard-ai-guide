import { validateAIOutput } from "./schema-validator";
import { AIError, parseAIError, parseHTTPError } from "./ai-errors";
import { supabase } from "@/integrations/supabase/client";

const AI_TASK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-task-router`;

export { AIError };

export async function sendAITask(envelope: object): Promise<any> {
  const taskType = (envelope as any)?.task?.type || "unknown";

  // Get the current user's session token for JWT auth
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  let resp: Response;
  try {
    resp = await fetch(AI_TASK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(envelope),
    });
  } catch (e) {
    throw new AIError({
      code: "network_error",
      message: "Could not reach the AI service. Check your connection and try again.",
    });
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw parseHTTPError(resp.status, body);
  }

  const data = await resp.json();

  // Check if the AI returned a structured error
  const aiError = parseAIError(data);
  if (aiError) throw aiError;

  // Validate the AI output against its schema
  const validation = validateAIOutput(taskType, data);

  if (validation.warnings.length > 0) {
    console.warn(`[AI Output] Warnings for "${taskType}":`, validation.warnings);
  }

  if (!validation.valid) {
    console.error(`[AI Output] Validation failed for "${taskType}":`, validation.errors);
    throw new AIError({
      code: "invalid_output",
      message: `AI output validation failed: ${validation.errors.join("; ")}`,
      requestId: data.request_id || "",
      warnings: validation.warnings,
    });
  }

  return data;
}
