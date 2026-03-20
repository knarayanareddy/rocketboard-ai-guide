/**
 * rocketboard-mcp/tools/get_tech_docs.ts
 *
 * MCP Tools: get_tech_docs_index + get_tech_doc
 * List and retrieve technical documents from the pack knowledge base.
 *
 * READ-ONLY | Auth: JWT | Pack access: learner
 *
 * SECURITY:
 * - Path MUST start with "Technical documents/" — no exceptions
 * - Path traversal (../ \ null bytes) is blocked
 * - Output cap: 50k chars per document
 */

import { z } from "zod";
import { SupabaseClient } from "@supabase/supabase-js";
import { writeMcpAudit, hashArgs } from "../audit.ts";
import { stitchAndRedact } from "../redaction.ts";
import { validatePath } from "../policy.ts";

// ─── Config ───────────────────────────────────────────────────────────────────

const TECH_DOCS_PREFIX = "Technical documents/";
const MAX_DOC_CHARS = 50_000;

// ─── Input schemas ────────────────────────────────────────────────────────────

export const GetTechDocsIndexInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
}).strict();
export type GetTechDocsIndexInput = z.infer<typeof GetTechDocsIndexInputSchema>;

export const GetTechDocInputSchema = z.object({
  pack_id: z.string().uuid("pack_id must be a valid UUID"),
  path: z.string().min(1).max(300, "path must be ≤ 300 chars"),
}).strict();
export type GetTechDocInput = z.infer<typeof GetTechDocInputSchema>;

// ─── get_tech_docs_index handler ──────────────────────────────────────────────

export async function getTechDocsIndex(
  args: GetTechDocsIndexInput,
  ctx: { userId: string; adminClient: SupabaseClient; requestId: string },
): Promise<{ paths: string[]; total: number }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  try {
    const { data, error } = await adminClient
      .from("knowledge_chunks")
      .select("path")
      .eq("pack_id", args.pack_id)
      .like("path", `${TECH_DOCS_PREFIX}%`);

    if (error) {
      console.error("[MCP:get_tech_docs_index] DB error:", error.message);
      throw new Error("Failed to list tech docs");
    }

    // Deduplicate paths
    const paths = [...new Set((data || []).map((r: any) => r.path as string))].sort();

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_docs_index",
      argsHash,
      resultSummary: { paths_count: paths.length },
      status: "ok",
    });

    return { paths, total: paths.length };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_docs_index",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}

// ─── get_tech_doc handler ─────────────────────────────────────────────────────

export async function getTechDoc(
  args: GetTechDocInput,
  ctx: { userId: string; adminClient: SupabaseClient; requestId: string },
): Promise<{ content: string; found: boolean; truncated: boolean; path: string }> {
  const { userId, adminClient, requestId } = ctx;
  const argsHash = await hashArgs(args);

  // Validate path — throws on failure (caught below)
  let validatedPath: string;
  try {
    validatedPath = validatePath(args.path, [TECH_DOCS_PREFIX]);
  } catch (pathErr) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_doc",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "invalid_path",
    });
    throw pathErr;
  }

  try {
    const { data: chunks, error: dbError } = await adminClient
      .from("knowledge_chunks")
      .select("content, line_start")
      .eq("pack_id", args.pack_id)
      .eq("path", validatedPath)
      .order("line_start", { ascending: true });

    if (dbError) {
      console.error("[MCP:get_tech_doc] DB error:", dbError.message);
      throw new Error("Failed to fetch document");
    }

    if (!chunks || chunks.length === 0) {
      await writeMcpAudit(adminClient, {
        requestId,
        userId,
        packId: args.pack_id,
        toolName: "get_tech_doc",
        argsHash,
        resultSummary: { found: false },
        status: "ok",
      });
      return { content: `Document not found: ${validatedPath}`, found: false, truncated: false, path: validatedPath };
    }

    const { text, truncated, secretsFound } = stitchAndRedact(
      chunks as Array<{ content: string; line_start: number }>,
      MAX_DOC_CHARS,
    );

    if (secretsFound > 0) {
      console.warn(`[MCP:get_tech_doc] Redacted ${secretsFound} secrets from path=${validatedPath}`);
    }

    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_doc",
      argsHash,
      resultSummary: { found: true, chunks: chunks.length, chars: text.length, truncated },
      status: "ok",
    });

    return { content: text, found: true, truncated, path: validatedPath };
  } catch (err) {
    await writeMcpAudit(adminClient, {
      requestId,
      userId,
      packId: args.pack_id,
      toolName: "get_tech_doc",
      argsHash,
      resultSummary: {},
      status: "error",
      errorCode: "db_error",
    });
    throw err;
  }
}
