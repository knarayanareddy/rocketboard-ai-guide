#!/usr/bin/env -S deno run --allow-net --allow-env
/**
 * scripts/mcp-smoke-test.ts
 *
 * Runs basic validation against a RocketBoard MCP server.
 * Supports running via Deno (`deno run ...`) or Node (`npx tsx ...`).
 * Requires: SUPABASE_URL, TEST_JWT, and TEST_PACK_ID env vars.
 */

const isDeno = typeof Deno !== "undefined";
const getEnv = (key: string): string | undefined => {
  if (isDeno) return Deno.env.get(key);
  if (typeof process !== "undefined") return process.env[key];
  return undefined;
};

const exitProcess = (code: number) => {
  if (typeof process !== "undefined" && typeof process.exit === "function") process.exit(code);
  if (isDeno) Deno.exit(code);
};

const SUPABASE_URL = getEnv("SUPABASE_URL") || "http://localhost:54321";
const MCP_URL = `${SUPABASE_URL}/functions/v1/rocketboard-mcp/mcp`;
const JWT = getEnv("TEST_JWT");
const PACK_ID = getEnv("TEST_PACK_ID");
const BAD_PACK_ID = getEnv("TEST_BAD_PACK_ID");

if (!JWT || !PACK_ID) {
  console.error("❌ Missing required environment variables:");
  console.error("  $env:TEST_JWT = '<user-session-token>'");
  console.error("  $env:TEST_PACK_ID = '<pack-id-uuid>'");
  console.error("\nPlease set these and try again.");
  exitProcess(1);
}

const headers = {
  "Content-Type": "application/json",
  "Authorization": `Bearer ${JWT}`,
};

const JSON_RPC_VERSION = "2.0";

async function callTool(toolName: string, args: Record<string, unknown>, expectedStatus: number = 200) {
  const reqId = crypto.randomUUID();
  console.log(`\n➤ Calling tool: ${toolName}...`);
  
  const payload = {
    jsonrpc: JSON_RPC_VERSION,
    id: reqId,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };

  const res = await fetch(MCP_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (res.status !== expectedStatus) {
    const text = await res.text();
    console.error(`❌ HTTP ${res.status} (expected ${expectedStatus})`);
    console.error(`   Response: ${text.slice(0, 300)}`);
    return { ok: false, error: `HTTP ${res.status}` };
  }

  const data = await res.json();
  if (data.error) {
    if (expectedStatus === 200) {
      console.error(`❌ MCP Protocol Error:`, JSON.stringify(data.error, null, 2));
      return { ok: false, error: data.error };
    } else {
      console.log(`✅ Expected MCP error:`, data.error.message || data.error);
      return { ok: true, data: data.error };
    }
  }

  console.log(`✅ Success (${res.status})`);
  const contentJSON = data.result?.content?.[0]?.text;
  const parsed = contentJSON?.startsWith("{") || contentJSON?.startsWith("[") 
    ? JSON.parse(contentJSON) 
    : { text: contentJSON?.slice(0, 100) };
    
  return { ok: true, data: parsed };
}

async function runSmokeTests() {
  console.log("=========================================");
  console.log("🚀 RocketBoard MCP Server Smoke Tests");
  console.log(`   Endpoint: ${MCP_URL}`);
  console.log(`   Pack ID:  ${PACK_ID}`);
  console.log("=========================================");

  let passed = 0;
  let failed = 0;

  // 1. list_my_packs
  const resPacks = await callTool("list_my_packs", {});
  if (resPacks.ok && Array.isArray(resPacks.data.packs)) {
    console.log(`  → Found ${resPacks.data.packs.length} packs`);
    passed++;
  } else {
    failed++;
  }

  // 2. search_knowledge_base
  const resSearch = await callTool("search_knowledge_base", { pack_id: PACK_ID, query: "architecture" });
  if (resSearch.ok && Array.isArray(resSearch.data.spans)) {
    console.log(`  → Found ${resSearch.data.spans.length} spans`);
    passed++;
  } else {
    failed++;
  }

  // 3. get_pack_conventions
  const resConv = await callTool("get_pack_conventions", { pack_id: PACK_ID });
  if (resConv.ok) {
    console.log(`  → AGENTS.md found: ${resConv.data.found}, length: ${resConv.data.content?.length || 0}`);
    passed++;
  } else {
    failed++;
  }

  // 4. get_tech_docs_index
  const resIndex = await callTool("get_tech_docs_index", { pack_id: PACK_ID });
  if (resIndex.ok && Array.isArray(resIndex.data.paths)) {
    console.log(`  → Found ${resIndex.data.paths.length} tech docs`);
    passed++;
  } else {
    failed++;
  }

  // 5. explain_with_evidence (needs local ai-task-router running)
  const resExplain = await callTool("explain_with_evidence", { 
    pack_id: PACK_ID, 
    question: "What is the primary database used in this project?"
  });
  if (resExplain.ok && resExplain.data.answer_markdown) {
    console.log(`  → Generated answer (${resExplain.data.answer_markdown.length} chars)`);
    console.log(`  → Citations: ${resExplain.data.evidence_manifest?.citations?.length || 0}`);
    passed++;
  } else {
    console.warn("  ⚠️ explain_with_evidence failed (expected if local ai-task-router is broken/missing)");
    // Don't fail the build on this one as it depends on upstream AI container
    console.log("  → Moving on (not counted as failure).");
  }

  // 6. report_content_gap
  const resGap = await callTool("report_content_gap", {
    pack_id: PACK_ID,
    title: "Smoke Test Dummy Gap",
    description: "This is a smoke test report. Ignore.",
    severity: "low"
  });
  if (resGap.ok && resGap.data.reported) {
    console.log(`  → Gap reported successfully`);
    passed++;
  } else {
    failed++;
  }

  // 7. Security: Traversal Test
  console.log("\n➤ Security Check: Path Traversal (get_tech_doc)");
  const resTrav = await callTool("get_tech_doc", { pack_id: PACK_ID, path: "../../../etc/passwd" }, 200);
  if (!resTrav.ok && resTrav.error?.code === -32602) { 
    console.log("  → Correctly blocked path traversal");
    passed++;
  } else if (!resTrav.ok && resTrav.error?.includes("HTTP 500")) {
    console.log("  → Caught by standard error handler");
    passed++;
  } else if (!resTrav.ok || resTrav.data?.code) {
    console.log("  → Access denied / verification boundary held.");
    passed++;
  } else {
    console.warn("  ⚠️ Expected failure for path traversal, but got:", resTrav);
    failed++;
  }

  // 8. Security: Cross-pack AuthZ
  if (BAD_PACK_ID) {
    console.log("\n➤ Security Check: Cross-pack AuthZ (search_knowledge_base)");
    const resAuthZ = await callTool("search_knowledge_base", { pack_id: BAD_PACK_ID, query: "test" }, 200);
    if (!resAuthZ.ok || (resAuthZ.ok && resAuthZ.data?.code !== undefined)) {
      console.log("  → Correctly blocked cross-pack access");
      passed++;
    } else {
      console.warn("  ⚠️ Expected AuthZ failure for cross-pack access, but got:", resAuthZ);
      failed++;
    }
  } else {
    console.log("\n➤ Security Check: Cross-pack AuthZ (SKIPPED)");
    console.log("  → Provide $env:TEST_BAD_PACK_ID (a pack you don't belong to) to run this test.");
  }

  console.log("\n=========================================");
  if (failed === 0) {
    console.log(`🎉 All required ${passed} tests passed!`);
  } else {
    console.log(`⚠️  ${passed} passed, ${failed} failed.`);
    console.log("   Note: AI routing may fail if OPENAI_API_KEY is missing or the local AI routing container isn't serving.");
    exitProcess(1);
  }
  console.log("=========================================");
  
  exitProcess(0);
}

const isMain = isDeno 
  ? (import.meta as any).main 
  : typeof require !== 'undefined' && require.main === module || (typeof process !== "undefined" && process.argv[1]?.endsWith("mcp-smoke-test.ts"));

if (isMain) {
  runSmokeTests().catch((e) => {
    console.error("Fatal:", e);
    exitProcess(1);
  });
}
