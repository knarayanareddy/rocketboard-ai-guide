/**
 * _shared/telemetry.ts
 * 
 * Shared Langfuse telemetry wrapper for all Supabase Edge Functions.
 * Provides structured tracing for AI tasks with domain-specific metadata.
 *
 * Usage:
 *   import { createTrace, withTelemetry } from "../_shared/telemetry.ts";
 */

// ─── Types ───
export interface TraceMetadata {
  taskType: string;
  requestId: string;
  userId?: string;
  packId?: string;
  orgId?: string;
  moduleKey?: string;
  trackKey?: string;
  environment?: string;
  [key: string]: unknown;
}

export interface GenerationMetrics {
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  latencyMs: number;
  costUsd?: number;
}

export interface SpanEvent {
  name: string;
  startTime: number;
  endTime?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  level?: "DEBUG" | "DEFAULT" | "WARNING" | "ERROR";
  statusMessage?: string;
}

export interface TraceData {
  traceId: string;
  metadata: TraceMetadata;
  spans: SpanEvent[];
  generation?: GenerationMetrics & {
    input?: unknown;
    output?: unknown;
  };
  status: "success" | "error";
  errorMessage?: string;
  startTime: number;
  endTime?: number;
}

// ─── Langfuse Client (lazy singleton) ───
let _langfuseClient: any = null;

function getLangfuseEnabled(): boolean {
  return !!(
    Deno.env.get("LANGFUSE_SECRET_KEY") &&
    Deno.env.get("LANGFUSE_PUBLIC_KEY")
  );
}

async function getLangfuseClient() {
  if (!getLangfuseEnabled()) return null;
  if (_langfuseClient) return _langfuseClient;

  try {
    const { Langfuse } = await import("npm:langfuse@2");
    _langfuseClient = new Langfuse({
      secretKey: Deno.env.get("LANGFUSE_SECRET_KEY")!,
      publicKey: Deno.env.get("LANGFUSE_PUBLIC_KEY")!,
      baseUrl: Deno.env.get("LANGFUSE_BASE_URL") || "https://cloud.langfuse.com",
      flushAt: 1,       // Flush after every event (critical for edge functions)
      flushInterval: 0, // No batching delay
    });
    return _langfuseClient;
  } catch (e) {
    console.warn("[telemetry] Failed to init Langfuse:", e);
    return null;
  }
}

// ─── Cost Calculator ───
const COST_PER_1K_TOKENS: Record<string, { input: number; output: number }> = {
  "google/gemini-3-flash-preview": { input: 0.00015, output: 0.0006 },
  "google/gemini-2.5-flash-preview-05-20": { input: 0.00015, output: 0.0006 },
  // Add more models as needed
};

export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const rates = COST_PER_1K_TOKENS[model];
  if (!rates) return 0;
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

// ─── Trace Builder (fluent API) ───
export function createTrace(metadata: TraceMetadata): TraceBuilder {
  return new TraceBuilder(metadata);
}

export class TraceBuilder {
  private data: TraceData;

  constructor(metadata: TraceMetadata) {
    this.data = {
      traceId: metadata.requestId || crypto.randomUUID(),
      metadata,
      spans: [],
      status: "success",
      startTime: Date.now(),
    };
  }

  /** Add a timed span (e.g., "input-sanitization", "evidence-retrieval") */
  addSpan(event: SpanEvent): this {
    this.data.spans.push(event);
    return this;
  }

  /** Start a span and return a handle to end it later */
  startSpan(name: string, input?: Record<string, unknown>): SpanHandle {
    const event: SpanEvent = { name, startTime: Date.now(), input };
    this.data.spans.push(event);
    return new SpanHandle(event);
  }

  /** Record the core LLM generation */
  setGeneration(metrics: GenerationMetrics & { input?: unknown; output?: unknown }): this {
    this.data.generation = metrics;
    return this;
  }

  /** Mark the trace as errored */
  setError(message: string): this {
    this.data.status = "error";
    this.data.errorMessage = message;
    return this;
  }

  /** Finalize and flush to Langfuse */
  async flush(): Promise<string> {
    this.data.endTime = Date.now();

    const langfuse = await getLangfuseClient();
    if (!langfuse) {
      // Langfuse not configured — log structured JSON to console instead
      console.log(JSON.stringify({
        _telemetry: true,
        traceId: this.data.traceId,
        taskType: this.data.metadata.taskType,
        status: this.data.status,
        latencyMs: this.data.endTime - this.data.startTime,
        spanCount: this.data.spans.length,
        generation: this.data.generation
          ? {
              model: this.data.generation.model,
              inputTokens: this.data.generation.inputTokens,
              outputTokens: this.data.generation.outputTokens,
              latencyMs: this.data.generation.latencyMs,
            }
          : null,
        error: this.data.errorMessage || null,
      }));
      return this.data.traceId;
    }

    try {
      const trace = langfuse.trace({
        id: this.data.traceId,
        name: `ai-task-router/${this.data.metadata.taskType}`,
        userId: this.data.metadata.userId,
        sessionId: this.data.metadata.packId
          ? `${this.data.metadata.userId}-${this.data.metadata.packId}`
          : undefined,
        metadata: this.data.metadata,
        tags: [
          this.data.metadata.taskType,
          this.data.metadata.environment || "production",
          ...(this.data.metadata.packId ? [`pack:${this.data.metadata.packId}`] : []),
        ],
      });

      // Add observation spans
      for (const span of this.data.spans) {
        trace.span({
          name: span.name,
          startTime: new Date(span.startTime),
          endTime: span.endTime ? new Date(span.endTime) : new Date(),
          input: span.input,
          output: span.output,
          metadata: span.metadata,
          level: span.level,
          statusMessage: span.statusMessage,
        });
      }

      // Add the LLM generation observation
      if (this.data.generation) {
        const gen = this.data.generation;
        trace.generation({
          name: "llm-call",
          model: gen.model,
          input: gen.input,
          output: gen.output,
          startTime: new Date(this.data.startTime),
          endTime: new Date(this.data.endTime),
          usage: {
            input: gen.inputTokens || 0,
            output: gen.outputTokens || 0,
            total: gen.totalTokens || 0,
          },
          metadata: {
            latencyMs: gen.latencyMs,
            costUsd: gen.costUsd,
          },
        });
      }

      // Set final trace status
      if (this.data.status === "error") {
        trace.update({
          metadata: {
            ...this.data.metadata,
            finalStatus: "error",
            errorMessage: this.data.errorMessage,
          },
        });
      }

      // Critical: flush before edge function returns
      await langfuse.flushAsync();
    } catch (e) {
      console.warn("[telemetry] Langfuse flush error:", e);
    }

    return this.data.traceId;
  }

  /** Get the trace ID (useful for returning to the frontend) */
  getTraceId(): string {
    return this.data.traceId;
  }
}

/** Handle for an in-flight span */
export class SpanHandle {
  private event: SpanEvent;

  constructor(event: SpanEvent) {
    this.event = event;
  }

  end(output?: Record<string, unknown>, metadata?: Record<string, unknown>): void {
    this.event.endTime = Date.now();
    if (output) this.event.output = output;
    if (metadata) this.event.metadata = { ...(this.event.metadata || {}), ...metadata };
  }

  error(message: string): void {
    this.event.endTime = Date.now();
    this.event.level = "ERROR";
    this.event.statusMessage = message;
  }
}
