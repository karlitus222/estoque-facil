import express from "express";
import { resolve } from "node:path";
import { pastaProjeto } from "./banco.js";

class Erro extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function inteiro(value, name, min = 0, max = 1000000) {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < min ||
    value > max
  ) {
    throw new Erro(`${name} deve ser um inteiro entre ${min} e ${max}.`);
  }
  return value;
}
function decimal(value, name, min, max) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < min ||
    value > max ||
    Math.abs(value * 100 - Math.round(value * 100)) > 0.00001
  ) {
    throw new Erro(
      `${name} deve estar entre ${min} e ${max}, com até duas casas decimais.`,
    );
  }
  return value;
}
function texto(value, name, max) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > max) {
    throw new Erro(`${name} é obrigatório e deve ter até ${max} caracteres.`);
  }
  return value.trim();
}
function id(value) {
  if (!/^\d+$/.test(String(value))) throw new Erro("Identificador inválido.");
  return inteiro(Number(value), "Identificador", 1, 2147483647);
}
function dadosVenda(body) {
  return [
    id(body.produto_id),
    inteiro(body.quantidade, "Quantidade", 1),
    decimal(body.desconto, "Desconto", 0, 100),
  ];
}
function dadosProduto(body) {
  return [
    texto(body.nome, "Nome", 100),
    texto(body.categoria, "Categoria", 60),
    decimal(body.preco, "Preço", 0.01, 999999.99),
    inteiro(body.estoque, "Estoque"),
    inteiro(body.estoque_minimo, "Estoque mínimo"),
  ];
}

export function criarApp(db) {
  const app = express();
  app.disable("x-powered-by");
  app.use((_req, res, next) => {
    res.set(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'",
    );
    res.set("X-Content-Type-Options", "nosniff");
    next();
  });
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (!["GET", "HEAD"].includes(req.method)) {
      if (
        req.headers.origin &&
        req.headers.origin !== `${req.protocol}://${req.get("host")}`
      ) {
        return res.status(403).json({ error: "Origem não permitida." });
      }
      if (req.method !== "DELETE" && !req.is("application/json")) {
        return res.status(415).json({ error: "Envie os dados em JSON." });
      }
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }));

  app.get("/api/status", async (_req, res) => {
    await db.query("SELECT 1");
    res.json({ ok: true, database: db.mode });
  });

  app.get("/api/produtos", async (_req, res) => {
    const { rows } = await db.query("SELECT * FROM produtos ORDER BY nome, id");
    res.json(rows);
  });

  app.post("/api/produtos", async (req, res) => {
    const values = dadosProduto(req.body);
    const produto = await db.transaction(async (tx) => {
      const { rows } = await tx.query(
        `INSERT INTO produtos (nome,categoria,preco,estoque,estoque_minimo)
        VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        values,
      );
      if (values[3] > 0)
        await tx.query(
          "INSERT INTO movimentacoes (produto_id,tipo,quantidade) VALUES ($1,'entrada',$2)",
          [rows[0].id, values[3]],
        );
      return rows[0];
    });
    res.status(201).json(produto);
  });

  app.put("/api/produtos/:id", async (req, res) => {
    const produtoId = id(req.params.id);
    const values = dadosProduto(req.body);
    const versao = inteiro(req.body.versao, "Versão", 1, 2147483647);
    const produto = await db.transaction(async (tx) => {
      const { rows: current } = await tx.query(
        "SELECT * FROM produtos WHERE id = $1 FOR UPDATE",
        [produtoId],
      );
      if (!current.length) throw new Erro("Produto não encontrado.", 404);
      if (current[0].versao !== versao)
        throw new Erro(
          "Este produto mudou. Feche o formulário, atualize a página e tente novamente.",
          409,
        );
      const difference = values[3] - current[0].estoque;
      const { rows } = await tx.query(
        `UPDATE produtos SET nome=$1, categoria=$2, preco=$3,
        estoque=$4, estoque_minimo=$5, versao=versao+1 WHERE id=$6 RETURNING *`,
        [...values, produtoId],
      );
      if (difference)
        await tx.query(
          "INSERT INTO movimentacoes (produto_id,tipo,quantidade) VALUES ($1,'ajuste',$2)",
          [produtoId, difference],
        );
      return rows[0];
    });
    res.json(produto);
  });

  app.delete("/api/produtos/:id", async (req, res) => {
    const { rows } = await db.query(
      "DELETE FROM produtos WHERE id=$1 RETURNING id",
      [id(req.params.id)],
    );
    if (!rows.length) throw new Erro("Produto não encontrado.", 404);
    res.status(204).end();
  });

  // FUNCTION: o cálculo abaixo acontece dentro do PostgreSQL, não no navegador.
  app.post("/api/orcamento", async (req, res) => {
    const values = dadosVenda(req.body);
    const { rows } = await db.query(
      `SELECT id AS produto_id, nome AS produto, preco, estoque,
      (preco * $2::integer)::numeric(16,2) AS subtotal,
      calcular_total(preco, $2::integer, $3::numeric) AS total,
      (preco * $2::integer - calcular_total(preco, $2::integer, $3::numeric))::numeric(16,2) AS desconto_valor
      FROM produtos WHERE id=$1`,
      values,
    );
    if (!rows.length) throw new Erro("Produto não encontrado.", 404);
    res.json({ ...rows[0], quantidade: values[1], desconto: values[2] });
  });

  // PROCEDURE: registra a venda, atualiza o estoque e insere a movimentação.
  app.post("/api/vendas", async (req, res) => {
    const values = [
      ...dadosVenda(req.body),
      texto(req.body.cliente, "Cliente", 100),
    ];
    const venda = await db.transaction(async (tx) => {
      const result = await tx.query(
        "CALL registrar_venda($1::integer,$2::integer,$3::numeric,$4::text,NULL)",
        values,
      );
      const { rows } = await tx.query(
        "SELECT * FROM relatorio_vendas WHERE venda_id=$1",
        [result.rows[0].p_venda_id],
      );
      return rows[0];
    });
    res.status(201).json(venda);
  });

  // VIEW: tanto a listagem quanto os indicadores são lidos da View.
  app.get("/api/relatorio", async (_req, res) => {
    const data = await db.transaction(async (tx) => {
      const { rows: vendas } = await tx.query(
        "SELECT * FROM relatorio_vendas ORDER BY criado_em DESC, venda_id DESC",
      );
      const { rows: resumo } =
        await tx.query(`SELECT count(*)::integer AS vendas,
        coalesce(sum(quantidade),0)::integer AS unidades,
        coalesce(sum(total),0)::numeric(16,2) AS faturamento,
        coalesce(sum(desconto_valor),0)::numeric(16,2) AS descontos
        FROM relatorio_vendas`);
      return { vendas, resumo: resumo[0] };
    });
    res.json(data);
  });

  app.use("/api", (_req, res) =>
    res.status(404).json({ error: "Rota não encontrada." }),
  );
  app.use(express.static(resolve(pastaProjeto, "src/publico")));
  app.use((err, _req, res, _next) => {
    if (err.type === "entity.parse.failed")
      return res.status(400).json({ error: "JSON inválido." });
    if (err.type === "entity.too.large")
      return res.status(413).json({ error: "Requisição muito grande." });
    if (["23503", "23001"].includes(err.code))
      return res
        .status(409)
        .json({
          error:
            "Este produto possui vendas e não pode ser excluído. O histórico precisa ser preservado.",
        });
    if (err.code === "P0001")
      return res.status(400).json({ error: err.message });
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Erro interno:", err.message);
    res
      .status(500)
      .json({
        error: "Não foi possível concluir a operação. Tente novamente.",
      });
  });
  return app;
}
