import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirBanco, iniciarBanco } from "../src/banco.js";
import { criarApp } from "../src/rotas.js";

let banco, servidor, endereco;
before(async () => {
  banco = await abrirBanco({ url: "", dataDir: "memory://" });
  await iniciarBanco(banco);
  servidor = criarApp(banco).listen(0, "127.0.0.1");
  await new Promise((resolve) => servidor.once("listening", resolve));
  endereco = `http://127.0.0.1:${servidor.address().port}/api`;
});
after(async () => {
  if (servidor) await new Promise((resolve) => servidor.close(resolve));
  if (banco) await banco.close();
});
async function pedido(caminho, metodo = "GET", dados) {
  const resposta = await fetch(`${endereco}/${caminho}`, {
    method: metodo,
    headers: { "Content-Type": "application/json" },
    body: dados ? JSON.stringify(dados) : undefined,
  });
  return {
    status: resposta.status,
    dados: resposta.status === 204 ? null : await resposta.json(),
  };
}
async function produto(estoque = 10) {
  return (
    await pedido("produtos", "POST", {
      nome: "Produto de teste",
      categoria: "Testes",
      preco: 19.9,
      estoque,
      estoque_minimo: 2,
    })
  ).dados;
}

test("instalação cria View, Function e Procedure reais e não duplica os dados", async () => {
  await iniciarBanco(banco);
  assert.equal(
    (await banco.query("SELECT count(*)::integer AS total FROM produtos"))
      .rows[0].total,
    6,
  );
  assert.equal(
    (await banco.query("SELECT count(*)::integer AS total FROM vendas")).rows[0]
      .total,
    4,
  );
  const { rows } = await banco.query(
    "SELECT proname, prokind FROM pg_proc WHERE proname IN ('calcular_total', 'registrar_venda') ORDER BY proname",
  );
  assert.deepEqual(
    rows.map((item) => [item.proname, item.prokind]),
    [
      ["calcular_total", "f"],
      ["registrar_venda", "p"],
    ],
  );
  assert.equal(
    (
      await banco.query(
        "SELECT relkind FROM pg_class WHERE relname='relatorio_vendas'",
      )
    ).rows[0].relkind,
    "v",
  );
});

test("CRUD cria, consulta, edita, registra ajuste e exclui produto sem vendas", async () => {
  const criado = await produto();
  const atualizado = await pedido(`produtos/${criado.id}`, "PUT", {
    ...criado,
    preco: 22.5,
    estoque: 12,
  });
  assert.equal(atualizado.status, 200);
  assert.equal(atualizado.dados.estoque, 12);
  assert.equal(
    (await pedido("produtos")).dados.find((item) => item.id === criado.id).nome,
    criado.nome,
  );
  const { rows } = await banco.query(
    "SELECT sum(quantidade)::integer AS saldo FROM movimentacoes WHERE produto_id=$1",
    [criado.id],
  );
  assert.equal(rows[0].saldo, 12);
  assert.equal((await pedido(`produtos/${criado.id}`, "DELETE")).status, 204);
  assert.equal((await pedido(`produtos/${criado.id}`, "DELETE")).status, 404);
});

test("orçamento usa arredondamento decimal e não altera o estoque", async () => {
  const criado = await produto();
  const resposta = await pedido("orcamento", "POST", {
    produto_id: criado.id,
    quantidade: 3,
    desconto: 7.5,
  });
  assert.equal(resposta.status, 200);
  assert.equal(Number(resposta.dados.total), 55.22);
  assert.equal(Number(resposta.dados.desconto_valor), 4.48);
  assert.equal(
    (await banco.query("SELECT estoque FROM produtos WHERE id=$1", [criado.id]))
      .rows[0].estoque,
    10,
  );
});

test("venda integra procedure, estoque, movimentação e relatório da View", async () => {
  const criado = await produto();
  const resposta = await pedido("vendas", "POST", {
    produto_id: criado.id,
    quantidade: 2,
    desconto: 10,
    cliente: "Maria",
  });
  assert.equal(resposta.status, 201);
  assert.equal(Number(resposta.dados.total), 35.82);
  assert.equal(
    (await banco.query("SELECT estoque FROM produtos WHERE id=$1", [criado.id]))
      .rows[0].estoque,
    8,
  );
  const movimento = (
    await banco.query(
      "SELECT quantidade FROM movimentacoes WHERE venda_id=$1",
      [resposta.dados.venda_id],
    )
  ).rows[0];
  assert.equal(movimento.quantidade, -2);
  const relatorio = await pedido("relatorio");
  assert.ok(
    relatorio.dados.vendas.some(
      (venda) => venda.venda_id === resposta.dados.venda_id,
    ),
  );
  const soma = relatorio.dados.vendas.reduce(
    (total, venda) => total + Math.round(Number(venda.total) * 100),
    0,
  );
  assert.equal(
    Math.round(Number(relatorio.dados.resumo.faturamento) * 100),
    soma,
  );
  assert.equal((await pedido(`produtos/${criado.id}`, "DELETE")).status, 409);
});

test("estoque insuficiente e quantidade inválida não deixam alterações parciais", async () => {
  const criado = await produto(1);
  const antes = (
    await banco.query("SELECT count(*)::integer AS total FROM vendas")
  ).rows[0].total;
  const resposta = await pedido("vendas", "POST", {
    produto_id: criado.id,
    quantidade: 2,
    desconto: 0,
    cliente: "João",
  });
  assert.equal(resposta.status, 400);
  assert.match(resposta.dados.error, /Estoque insuficiente/);
  await assert.rejects(
    banco.query("CALL registrar_venda($1,0,0,$2,NULL)", [criado.id, "João"]),
    /Quantidade/,
  );
  assert.equal(
    (await banco.query("SELECT estoque FROM produtos WHERE id=$1", [criado.id]))
      .rows[0].estoque,
    1,
  );
  assert.equal(
    (await banco.query("SELECT count(*)::integer AS total FROM vendas")).rows[0]
      .total,
    antes,
  );
  assert.equal(
    (
      await banco.query(
        "SELECT count(*)::integer AS total FROM movimentacoes WHERE produto_id=$1 AND tipo='venda'",
        [criado.id],
      )
    ).rows[0].total,
    0,
  );
});

test("duas solicitações concorrentes não vendem o mesmo saldo", async () => {
  const criado = await produto(1);
  const respostas = await Promise.all(
    [1, 2].map(() =>
      pedido("vendas", "POST", {
        produto_id: criado.id,
        quantidade: 1,
        desconto: 0,
        cliente: "Última unidade",
      }),
    ),
  );
  assert.deepEqual(
    respostas.map((resposta) => resposta.status).sort(),
    [201, 400],
  );
  assert.equal(
    (await banco.query("SELECT estoque FROM produtos WHERE id=$1", [criado.id]))
      .rows[0].estoque,
    0,
  );
});

test("edição desatualizada é rejeitada e histórico preserva nome e preço vendidos", async () => {
  const criado = await produto();
  const venda = (
    await pedido("vendas", "POST", {
      produto_id: criado.id,
      quantidade: 1,
      desconto: 0,
      cliente: "Histórico",
    })
  ).dados;
  assert.equal(
    (await pedido(`produtos/${criado.id}`, "PUT", { ...criado, preco: 30 }))
      .status,
    409,
  );
  const atual = (await pedido("produtos")).dados.find(
    (item) => item.id === criado.id,
  );
  assert.equal(
    (
      await pedido(`produtos/${criado.id}`, "PUT", {
        ...atual,
        nome: "Nome novo",
        preco: 30,
      })
    ).status,
    200,
  );
  const historico = (await pedido("relatorio")).dados.vendas.find(
    (item) => item.venda_id === venda.venda_id,
  );
  assert.equal(historico.produto, "Produto de teste");
  assert.equal(Number(historico.preco_unitario), 19.9);
});

test("entrada inválida é recusada pela API e pela função SQL", async () => {
  for (const quantidade of [0, -1, 1.5, "2"]) {
    assert.equal(
      (
        await pedido("orcamento", "POST", {
          produto_id: 1,
          quantidade,
          desconto: 0,
        })
      ).status,
      400,
    );
  }
  for (const desconto of [-1, 101, 0.001]) {
    assert.equal(
      (
        await pedido("orcamento", "POST", {
          produto_id: 1,
          quantidade: 1,
          desconto,
        })
      ).status,
      400,
    );
  }
  await assert.rejects(
    banco.query("SELECT calcular_total(10,1,'NaN'::numeric)"),
  );
  await assert.rejects(banco.query("SELECT calcular_total(10,1,NULL)"));
  assert.equal(
    (
      await pedido("produtos", "POST", {
        nome: " ",
        categoria: "Testes",
        preco: 0,
        estoque: 0,
        estoque_minimo: 0,
      })
    ).status,
    400,
  );
  assert.equal((await pedido("produtos/abc", "DELETE")).status, 400);
});

test("dados persistem após fechar e reabrir o banco em disco", async () => {
  const pasta = await mkdtemp(join(tmpdir(), "estoque-teste-"));
  let local;
  try {
    local = await abrirBanco({ url: "", dataDir: pasta });
    await iniciarBanco(local);
    await local.query("UPDATE produtos SET nome='Nome persistido' WHERE id=1");
    await local.close();
    local = await abrirBanco({ url: "", dataDir: pasta });
    await iniciarBanco(local);
    assert.equal(
      (await local.query("SELECT nome FROM produtos WHERE id=1")).rows[0].nome,
      "Nome persistido",
    );
  } finally {
    if (local) await local.close();
    await rm(pasta, { recursive: true, force: true });
  }
});
