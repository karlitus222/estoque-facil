import { execFileSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
const cli = resolve('node_modules/supabase/dist/supabase.js');
const status = JSON.parse(execFileSync(process.execPath, [cli,'status','-o','json'], { encoding: 'utf8', stdio: ['ignore','pipe','pipe'] }));
if (existsSync('.env')) {
  console.log('.env já existe; preservado. Para reconfigurar, guarde uma cópia e remova-o manualmente.');
} else {
  if (!status.API_URL || !status.DB_URL || !status.SECRET_KEY) throw new Error('Supabase local não retornou as configurações esperadas.');
  writeFileSync('.env', `PORT=3012\nSUPABASE_URL=${status.API_URL}\nSUPABASE_DB_URL=${status.DB_URL}\nSUPABASE_SECRET_KEY=${status.SECRET_KEY}\nREDIS_URL=redis://127.0.0.1:6387\nCACHE_TTL=30\n`);
  console.log('.env local criado. Credenciais não foram impressas e não devem ser versionadas.');
}
