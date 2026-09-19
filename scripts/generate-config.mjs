// Gera SIGAV/supabase-config.js a partir do .env (ou de variáveis de ambiente, como no GitHub Actions).
// Uso: node scripts/generate-config.mjs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function loadDotEnv(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return out;
}

const env = { ...loadDotEnv(resolve(root, '.env')), ...process.env };
const url = env.SUPABASE_URL;
const key = env.SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  console.error('Defina SUPABASE_URL e SUPABASE_PUBLISHABLE_KEY no .env (veja .env.example).');
  process.exit(1);
}
if (/service_role/i.test(key) || key.startsWith('sb_secret_')) {
  console.error('Essa parece ser uma chave secreta. Use somente a chave publishable/anon no front-end.');
  process.exit(1);
}

const body = `// ARQUIVO GERADO por scripts/generate-config.mjs — não edite nem versione.
window.SUPABASE_CONFIG = ${JSON.stringify({ url, publishableKey: key }, null, 2)};
`;
writeFileSync(resolve(root, 'SIGAV/supabase-config.js'), body);
console.log('SIGAV/supabase-config.js gerado.');
