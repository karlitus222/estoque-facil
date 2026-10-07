import { abrirBanco, iniciarBanco } from "./banco.js";
import { criarApp } from "./rotas.js";

const db = await abrirBanco();
await iniciarBanco(db);
const port = Number(process.env.PORT || 3000);
// Aplicação acadêmica local, sem autenticação. Não expor diretamente à internet.
const server = criarApp(db).listen(port, "127.0.0.1", () => {
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
  process.exitCode = 1;
});
let closing = false;
async function encerrar() {
  if (closing) return;
  closing = true;
  server.close(async () => {
    await db.close();
    process.exit(0);
  });
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
