import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FUNCTIONS_DIR = path.resolve(__dirname, '../supabase/functions');

// Functions that are allowed to use SUPABASE_SERVICE_ROLE_KEY without requireUser/requireInternal
// (e.g., webhooks, background cron jobs)
const AUTH_GUARD_ALLOWLIST = [
  'github-webhook',
  'check-staleness',
  'lifecycle-retention-job',
  'process-staleness-queue',
  'rollup-pack-quality-daily',
  'sync-feedback-to-langfuse',
  'auto-remediate-module', // System worker
  'reindex-orgs', // Admin tool
  'lifecycle-retention-job'
];

const FORBIDDEN_PATTERNS = [
  {
    pattern: /Access-Control-Allow-Origin['"]:\s*['"]\*['"]/i,
    message: 'Wildcard CORS ("*") is forbidden. Use a shared allowlist-based approach.'
  },
  {
    pattern: /redirect:\s*['"]follow['"]/i,
    message: 'redirect: "follow" is forbidden. Use safeFetch() with redirect: "manual" to prevent SSRF.'
  },
  {
    pattern: /allowAnyHost:\s*true/i,
    message: 'allowAnyHost: true is forbidden in URL validation policies.'
  }
];

function auditFile(dirName, filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const issues = [];

  // Check forbidden patterns
  for (const { pattern, message } of FORBIDDEN_PATTERNS) {
    if (pattern.test(content)) {
      issues.push(message);
    }
  }

  // Check Service Role usage without guards
  const usesServiceRole = content.includes('SUPABASE_SERVICE_ROLE_KEY');
  const hasAuthGuard = content.includes('requireUser(') || content.includes('requireInternal(');

  if (usesServiceRole && !hasAuthGuard && !AUTH_GUARD_ALLOWLIST.includes(dirName)) {
    issues.push('Uses SUPABASE_SERVICE_ROLE_KEY but lacks requireUser() or requireInternal() guard.');
  }

  return issues;
}

function main() {
  console.log('--- Edge Function Security Audit ---');
  let totalIssues = 0;
  let filesChecked = 0;

  if (!fs.existsSync(FUNCTIONS_DIR)) {
    console.error(`Functions directory not found: ${FUNCTIONS_DIR}`);
    process.exit(1);
  }

  const dirs = fs.readdirSync(FUNCTIONS_DIR);

  for (const dir of dirs) {
    if (dir === '_shared') continue;

    const indexPath = path.join(FUNCTIONS_DIR, dir, 'index.ts');
    if (fs.existsSync(indexPath)) {
      filesChecked++;
      const issues = auditFile(dir, indexPath);
      if (issues.length > 0) {
        console.error(`\n[!] Issues found in ${dir}/index.ts:`);
        issues.forEach(issue => console.error(`  - ${issue}`));
        totalIssues += issues.length;
      }
    }
  }

  console.log(`\n--- Audit Complete ---`);
  console.log(`Checked ${filesChecked} functions.`);
  
  if (totalIssues > 0) {
    console.error(`Total security issues found: ${totalIssues}`);
    process.exit(1);
  } else {
    console.log('No security regressions detected. \u2705');
  }
}

main();
