import * as fs from 'fs';
import * as path from 'path';

const typesPath = path.resolve(process.cwd(), 'src/integrations/supabase/types.ts');

if (!fs.existsSync(typesPath)) {
  console.error(`❌ Types file not found: ${typesPath}`);
  process.exit(1);
}

const content = fs.readFileSync(typesPath, 'utf8');

const requiredTables = [
  'module_remediations',
  'staleness_check_queue',
  'content_freshness',
  'pack_active_generation'
];

let missing = false;
for (const table of requiredTables) {
  if (!content.includes(`${table}: {`)) {
    console.error(`❌ Missing table in types.ts: ${table}`);
    missing = true;
  }
}

if (missing) {
  console.error('⚠️ Types are stale or migrations failed. Run: supabase gen types typescript --local');
  process.exit(1);
}

console.log('✅ types.ts contains all required hardened tables.');
process.exit(0);
