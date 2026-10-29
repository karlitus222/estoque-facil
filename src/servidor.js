import { abrirBanco, iniciarBanco } from "./banco.js";
import { criarApp } from "./rotas.js";
import { abrirCache } from './cache.js';
import { criarSupabase } from './supabase.js';
import { readFile } from 'node:fs/promises';

const supabase = criarSupabase();
const db = await abrirBanco();
await iniciarBanco(db);
await db.query(await readFile(new URL('../banco/seguranca.sql', import.meta.url), 'utf8'));
await db.query("NOTIFY pgrst, 'reload schema'");
// A Data API atualiza seu schema de forma assíncrona após a primeira instalação.
for (let tentativa = 0; ; tentativa++) {
  try { await supabase.verificar(); break; }
  catch (error) { if (tentativa === 4) throw error; await new Promise(resolve => setTimeout(resolve, 500)); }
}
const cache = await abrirCache();
const port = Number(process.env.PORT || 3000);
// Aplicação acadêmica local, sem autenticação. Não expor diretamente à internet.
const server = criarApp(db, { cache, supabase }).listen(port, "127.0.0.1", () => {
  console.log(`Estoque Fácil: http://localhost:${port}`);
  console.log(`Banco: ${db.mode}`);
});
server.on("error", async (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `A porta ${port} está ocupada. Altere PORT no .env.`
      : error.message,
  );
  await db.close();
  await cache.close();
  process.exitCode = 1;
});
let closing = false;
async function encerrar() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.close();
    await cache.close();
    process.exit(0);
  });
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
