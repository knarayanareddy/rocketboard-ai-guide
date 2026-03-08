const AI_TASK_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-task-router`;

export class AITaskError extends Error {
  constructor(
    message: string,
    public errorCode: string,
    public requestId: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = "AITaskError";
  }
}

export async function sendAITask(envelope: object): Promise<any> {
  const resp = await fetch(AI_TASK_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify(envelope),
  });

  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
    throw new AITaskError(
      body.error || `Request failed with status ${resp.status}`,
      body.error_code || "http_error",
      body.request_id || "",
      resp.status
    );
  }

  const data = await resp.json();

  if (data.type === "error") {
    throw new AITaskError(
      data.message || "AI task error",
      data.error_code || "task_error",
      data.request_id || ""
    );
  }

  return data;
}
