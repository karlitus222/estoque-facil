import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export const pastaProjeto = fileURLToPath(new URL("../", import.meta.url));
export const arquivosSql = [
  "tabelas/tabelas.sql",
  "funcoes/total.sql",
  "procedures/venda.sql",
  "views/vendas.sql",
  "dados/dados.sql",
];

export async function abrirBanco({
  url = process.env.DATABASE_URL,
  dataDir = resolve(pastaProjeto, ".data/estoque"),
} = {}) {
  if (url) {
    const pool = new pg.Pool({ connectionString: url });
    return {
      mode: "PostgreSQL (servidor)",
      query: (sql, params) => pool.query(sql, params),
      async transaction(callback) {
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          const result = await callback({
            query: (sql, params) => client.query(sql, params),
            exec: (sql) => client.query(sql),
          });
          await client.query("COMMIT");
          return result;
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        } finally {
          client.release();
        }
      },
      close: () => pool.end(),
    };
  }
  if (!dataDir.startsWith("memory://"))
    await mkdir(dataDir, { recursive: true });
  const db = await PGlite.create(dataDir);
  return {
    mode: "PostgreSQL embarcado (PGlite)",
    query: (sql, params) => db.query(sql, params),
    transaction: (callback) => db.transaction(callback),
    close: () => db.close(),
  };
}

export async function iniciarBanco(db) {
  await db.transaction(async (tx) => {
    await tx.exec(
      "CREATE TABLE IF NOT EXISTS controle_banco (nome TEXT PRIMARY KEY, aplicado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP)",
    );
    // Serializa a instalação quando mais de uma instância aponta para o mesmo servidor.
    await tx.exec("LOCK TABLE controle_banco IN EXCLUSIVE MODE");
    const { rows } = await tx.query(
      "SELECT nome FROM controle_banco WHERE nome = $1",
      ["inicio"],
    );
    if (rows.length) return;
    for (const file of arquivosSql) {
      await tx.exec(
        await readFile(resolve(pastaProjeto, "banco", file), "utf8"),
      );
    }
    await tx.query("INSERT INTO controle_banco(nome) VALUES ($1)", ["inicio"]);
  });
}
