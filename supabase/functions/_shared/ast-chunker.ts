// Polyfill document.currentScript for web-tree-sitter in Deno edge runtime
if (typeof globalThis.document === "undefined") {
  (globalThis as any).document = { currentScript: { src: "" } };
}
import Parser from "https://esm.sh/web-tree-sitter@0.20.8";

const WASM_SHA256: Record<string, string> = {
  typescript: "8515404dceed38e1ed86aa34b09fcf3379fff1b4ff9dd3967bcd6d1eb5ac3d8f",
  python: "9056d0fb0c337810d019fae350e8167786119da98f0f282aceae7ab89ee8253b",
  go: "9963ca89b616eaf04b08a43bc1fb0f07b85395bec313330851f1f1ead2f755b6",
  rust: "4409921a70d0aa5bec7d1d7ce809a557a8ee1cf6ace901e3ac6a76e62cfea903",
  java: "637aac4415fb39a211a4f4292d63c66b5ce9c32fa2cd35464af4f681d91b9a1f",
  javascript: "1c99d4b953d2543bd6b934eb7206118fb732b473cd725ba04f258163b2bd3253",
};

async function computeSha256(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

let isParserInitialized = false;
const languageCache = new Map<string, any>();

async function initParser() {
  if (isParserInitialized) return;
  await Parser.init();
  isParserInitialized = true;
}

async function getLanguage(lang: string) {
  // Map tsx -> typescript as they often share the same grammar in WASM distributions
  const langKey = lang === "tsx" ? "typescript" : lang;
  if (languageCache.has(langKey)) return languageCache.get(langKey);

  try {
    let buffer: ArrayBuffer | null = null;
    const wasmFilename = `tree-sitter-${langKey}.wasm`;

    // 1. Try Local Vendored WASM first (Option C)
    try {
      // Use import.meta.url to find relative path in Deno
      const localUrl = new URL(`./wasm/${wasmFilename}`, import.meta.url);
      const localRes = await fetch(localUrl);
      if (localRes.ok) {
        console.log(`[AST] Loading local grammar for ${langKey}`);
        buffer = await localRes.arrayBuffer();
      }
    } catch (localErr) {
      // Fallback to remote if local fails or isn't found
    }

    // 2. Fetch from Remote if not found locally
    if (!buffer) {
      const baseUrl = Deno.env.get("TREE_SITTER_WASM_BASE_URL") || "https://esm.sh/tree-sitter-wasms@0.1.11/out";
      const remoteUrl = `${baseUrl.replace(/\/$/, "")}/${wasmFilename}`;
      
      const res = await fetch(remoteUrl);
      if (!res.ok) throw new Error(`Failed to fetch grammar for ${langKey} from ${remoteUrl}`);
      buffer = await res.arrayBuffer();
    }

    // 3. Integrity Verification (Option B)
    const expectedHash = WASM_SHA256[langKey];
    if (expectedHash) {
      const actualHash = await computeSha256(buffer);
      if (actualHash !== expectedHash) {
        throw new Error(`Integrity check failed for ${langKey}. Expected ${expectedHash}, got ${actualHash}`);
      }
    }

    const language = await Parser.Language.load(new Uint8Array(buffer));
    languageCache.set(langKey, language);
    return language;
  } catch (e) {
    console.error(`[AST] Grammar load failed for ${langKey}:`, (e as Error).message);
    return null;
  }
}

export interface ChunkMetadata {
  entity_type: string;
  entity_name: string;
  signature: string;
  line_start: number;
  line_end: number;
  parent_id?: string;
  content_hash?: string;
  imports?: string[];
  exported_names?: string[];
}

export interface ASTChunk {
  text: string;
  metadata: ChunkMetadata;
}

function extractImports(tree: Parser.Tree, lang: string): string[] {
  const imports: string[] = [];
  const root = tree.rootNode;
  
  // Basic heuristic import extraction
  const queryMap: Record<string, string> = {
    typescript: '(import_statement) @import (import_alias) @import',
    javascript: '(import_statement) @import',
    python: '(import_from_statement) @import (import_statement) @import',
    go: '(import_declaration) @import',
  };

  const queryStr = queryMap[lang === "tsx" ? "typescript" : lang];
  if (!queryStr) return [];

  try {
    const query = tree.getLanguage().query(queryStr);
    const matches = query.matches(root);
    for (const match of matches) {
      for (const capture of match.captures) {
        imports.push(capture.node.text);
      }
    }
  } catch (e) {
    // Fallback if query fails
  }
  return imports;
}

function extractExportedNames(tree: Parser.Tree, lang: string): { name: string; line: number }[] {
  const exports: { name: string; line: number }[] = [];
  const root = tree.rootNode;
  
  const queryMap: Record<string, string> = {
    typescript: `
      (export_statement (declaration (function_declaration name: (identifier) @export)))
      (export_statement (declaration (class_declaration name: (identifier) @export)))
      (export_statement (declaration (lexical_declaration (variable_declarator name: (identifier) @export))))
      (export_statement (declaration (type_alias_declaration name: (type_identifier) @export)))
      (export_statement (declaration (interface_declaration name: (type_identifier) @export)))
      (export_statement (declaration (enum_declaration name: (identifier) @export)))
      (export_statement (export_clause (export_specifier name: (identifier) @export)))
      (export_statement (export_clause (export_specifier alias: (identifier) @export)))
    `,
    javascript: `
      (export_statement (declaration (function_declaration name: (identifier) @export)))
      (export_statement (declaration (class_declaration name: (identifier) @export)))
      (export_statement (declaration (lexical_declaration (variable_declarator name: (identifier) @export))))
      (export_statement (export_clause (export_specifier name: (identifier) @export)))
    `,
    python: `
      (function_definition name: (identifier) @export)
      (class_definition name: (identifier) @export)
    `,
    go: `
      (function_declaration name: (identifier) @export)
      (type_declaration (type_spec name: (identifier) @export))
      (method_declaration name: (field_identifier) @export)
    `,
  };

  const queryStr = queryMap[lang === "tsx" ? "typescript" : lang];
  if (!queryStr) return [];

  try {
    const query = tree.getLanguage().query(queryStr);
    const matches = query.matches(root);
    for (const match of matches) {
      for (const capture of match.captures) {
        const name = capture.node.text;
        const line = capture.node.startPosition.row + 1;
        // Language specific filtering
        if (lang === "py" && name.startsWith("_")) continue;
        if (lang === "go" && !/^[A-Z]/.test(name)) continue;
        exports.push({ name, line });
      }
    }
  } catch (e) {
    console.error(`[AST] Export query failed for ${lang}:`, e);
  }
  return exports;
}

function walkAST(node: Parser.Node, code: string, chunks: ASTChunk[], lang: string) {
  const type = node.type;
  const interestingTypes = [
    "function_declaration", "method_definition", "class_declaration",
    "interface_declaration", "enum_declaration", "type_alias_declaration",
    "function_definition", "decorated_definition" // Python
  ];

  if (interestingTypes.includes(type)) {
    const nameNode = node.childForFieldName("name") || node.children.find(c => c.type.includes("identifier"));
    
    chunks.push({
      text: code.slice(node.startIndex, node.endIndex),
      metadata: {
        entity_type: type,
        entity_name: nameNode?.text || "anonymous",
        signature: code.slice(node.startIndex, nameNode?.endIndex || node.endIndex).split('\n')[0],
        line_start: node.startPosition.row + 1,
        line_end: node.endPosition.row + 1,
      }
    });
    return; // Don't recurse into interesting nodes for top-level chunking
  }

  for (const child of node.children) {
    walkAST(child, code, chunks, lang);
  }
}

function extractOrphanCode(root: Parser.Node, code: string, astChunks: ASTChunk[]): ASTChunk[] {
  const orphans: ASTChunk[] = [];
  const sortedChunks = [...astChunks].sort((a, b) => a.metadata.line_start - b.metadata.line_start);
  
  let currentPos = 0;
  for (const chunk of sortedChunks) {
    const chunkLines = code.slice(0, currentPos).split('\n');
    const chunkStart = code.split('\n').slice(0, chunk.metadata.line_start - 1).join('\n').length;
    if (chunkStart > currentPos + 50) { // arbitrary threshold for "meaningful" orphan code
      const text = code.slice(currentPos, chunkStart).trim();
      if (text.length > 20) {
         orphans.push({
           text,
           metadata: {
             entity_type: "orphan_code",
             entity_name: "file_scope",
             signature: text.split('\n')[0],
             line_start: chunkLines.length,
             line_end: chunk.metadata.line_start - 1
           }
         });
      }
    }
    currentPos = code.split('\n').slice(0, chunk.metadata.line_end).join('\n').length;
  }
  
  // Tail orphan
  if (currentPos < code.length - 20) {
    const text = code.slice(currentPos).trim();
    if (text.length > 20) {
      orphans.push({
        text,
        metadata: {
          entity_type: "orphan_code",
          entity_name: "file_scope",
          signature: text.split('\n')[0],
          line_start: code.slice(0, currentPos).split('\n').length,
          line_end: code.split('\n').length
        }
      });
    }
  }
  
  return orphans;
}

function splitOversizedChunk(chunk: ASTChunk, maxLines = 100): ASTChunk[] {
  const lines = chunk.text.split('\n');
  if (lines.length <= maxLines) return [chunk];

  const results: ASTChunk[] = [];
  for (let i = 0; i < lines.length; i += 80) { // 20 line overlap
    const end = Math.min(i + 100, lines.length);
    results.push({
      text: lines.slice(i, end).join('\n'),
      metadata: {
        ...chunk.metadata,
        entity_type: `${chunk.metadata.entity_type}_part`,
        line_start: chunk.metadata.line_start + i,
        line_end: chunk.metadata.line_start + end - 1,
      }
    });
    if (end === lines.length) break;
  }
  return results;
}

export async function astChunk(code: string, filepath: string): Promise<ASTChunk[]> {
  await initParser();
  const ext = filepath.split('.').pop() || "";
  const lang = ["ts", "tsx", "js", "jsx", "py", "go", "rs", "java"].includes(ext) ? ext : null;
  
  if (!lang) {
    // Fallback for non-code files
    const lines = code.split('\n');
    const results: ASTChunk[] = [];
    for (let i = 0; i < lines.length; i += 100) {
       const end = Math.min(i + 100, lines.length);
       results.push({
           text: lines.slice(i, end).join('\n'),
           metadata: {
               entity_type: "text_chunk",
               entity_name: filepath,
               signature: filepath,
               line_start: i + 1,
               line_end: end
           }
       });
    }
    return results;
  }

  const parser = new Parser();
  const grammar = await getLanguage(lang);
  if (!grammar) return astChunk(code, "fallback.txt"); // fallback to basic chunking

  parser.setLanguage(grammar);
  const tree = parser.parse(code);
  const imports = extractImports(tree, lang);
  const exports = extractExportedNames(tree, lang);

  const chunks: ASTChunk[] = [];
  walkAST(tree.rootNode, code, chunks, lang);
  
  const orphans = extractOrphanCode(tree.rootNode, code, chunks);
  const finalChunks = [...chunks, ...orphans];

  // Final pass: ensure imports and file-level exports are attached to chunks
  return finalChunks.flatMap(c => {
    const split = splitOversizedChunk(c);
    return split.map(s => {
      // Find exports defined within this chunk's line range
      const chunkExports = exports
        .filter(e => e.line >= s.metadata.line_start && e.line <= s.metadata.line_end)
        .map(e => e.name);

      return {
        ...s,
        metadata: { 
          ...s.metadata, 
          imports,
          exported_names: chunkExports
        }
      };
    });
  });
}
