const $ = (seletor) => document.querySelector(seletor);
const dinheiro = (valor) =>
  Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const escapar = (valor) =>
  String(valor ?? "").replace(
    /[&<>"']/g,
    (letra) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        letra
      ],
  );
const nomes = {
  relatorio: "Relatório de vendas",
  produtos: "Produtos e estoque",
  orcamento: "Orçamento",
  venda: "Nova venda",
};
let produtos = [];
let excluirId = null;
let pagina = "";
let revisaoOrcamento = 0;

async function api(caminho, metodo = "GET", dados) {
  const resposta = await fetch(`/api/${caminho}`, {
    method: metodo,
    headers: dados ? { "Content-Type": "application/json" } : {},
    body: dados ? JSON.stringify(dados) : undefined,
  });
  if (resposta.status === 204) return null;
  const resultado = await resposta.json();
  if (!resposta.ok)
    throw new Error(resultado.error || "Não foi possível concluir a operação.");
  return resultado;
}

function avisar(mensagem, erro = false) {
  const aviso = $("#notice");
  aviso.textContent = mensagem;
  aviso.className = erro ? "notice error" : "notice";
  aviso.hidden = false;
}

async function carregarProdutos() {
  produtos = await api("produtos");
  listarProdutos();
  document.querySelectorAll(".product-select").forEach((campo) => {
    const selecionado = campo.value;
    campo.innerHTML =
      '<option value="">Selecione um produto</option>' +
      produtos
        .map(
          (produto) =>
            `<option value="${produto.id}">${escapar(produto.nome)} · ${dinheiro(produto.preco)} · ${produto.estoque} disponíveis</option>`,
        )
        .join("");
    campo.value = selecionado;
  });
}

function listarProdutos() {
  const busca = $("#product-search").value.toLocaleLowerCase("pt-BR");
  const lista = produtos.filter((produto) =>
    `${produto.nome} ${produto.categoria}`
      .toLocaleLowerCase("pt-BR")
      .includes(busca),
  );
  $("#product-count").textContent =
    `${lista.length} de ${produtos.length} produtos`;
  $("#product-rows").innerHTML = lista.length
    ? lista
        .map((produto) => {
          const situacao =
            produto.estoque === 0
              ? ["zero", "Sem estoque"]
              : produto.estoque <= produto.estoque_minimo
                ? ["low", "Estoque baixo"]
                : ["good", "Disponível"];
          return `<tr><td><span class="cell-title">${escapar(produto.nome)}</span><span class="cell-sub">Código ${String(produto.id).padStart(3, "0")}</span></td>
      <td>${escapar(produto.categoria)}</td><td>${dinheiro(produto.preco)}</td><td><strong>${produto.estoque}</strong> un.<span class="cell-sub">Mínimo: ${produto.estoque_minimo}</span></td>
      <td><span class="badge ${situacao[0]}">${situacao[1]}</span></td><td><div class="actions"><button class="action-button" data-editar="${produto.id}" aria-label="Editar ${escapar(produto.nome)}">Editar</button><button class="action-button delete" data-excluir="${produto.id}" aria-label="Excluir ${escapar(produto.nome)}">Excluir</button></div></td></tr>`;
        })
        .join("")
    : '<tr><td colspan="6" class="empty">Nenhum produto encontrado. Cadastre um produto ou altere a busca.</td></tr>';
}

async function carregarRelatorio() {
  const { vendas, resumo } = await api("relatorio");
  const indicadores = [
    [
      "Faturamento",
      dinheiro(resumo.faturamento),
      "Total de vendas registradas",
      "R$",
    ],
    ["Vendas realizadas", resumo.vendas, "Operações concluídas", "▥"],
    ["Produtos vendidos", resumo.unidades, "Unidades vendidas", "▦"],
    [
      "Descontos concedidos",
      dinheiro(resumo.descontos),
      "Descontos nas vendas",
      "%",
    ],
  ];
  $("#metrics").innerHTML = indicadores
    .map(
      ([titulo, valor, legenda, icone]) =>
        `<div class="card metric"><div class="metric-label">${titulo}<span class="metric-icon" aria-hidden="true">${icone}</span></div><strong>${valor}</strong><small>${legenda}</small></div>`,
    )
    .join("");
  $("#sales-rows").innerHTML = vendas.length
    ? vendas
        .map(
          (venda) => `<tr>
    <td><span class="cell-title">#${String(venda.venda_id).padStart(4, "0")}</span><span class="cell-sub">${new Date(venda.criado_em).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}</span></td>
    <td>${escapar(venda.cliente)}</td><td><span class="cell-title">${escapar(venda.produto)}</span><span class="cell-sub">${escapar(venda.categoria_atual)}</span></td>
    <td>${venda.quantidade} un.</td><td>${Number(venda.desconto_percentual).toLocaleString("pt-BR")}%</td><td class="right"><strong>${dinheiro(venda.total)}</strong></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="6" class="empty">Nenhuma venda registrada. Use “Registrar venda” para começar.</td></tr>';
  $("#sales-count").textContent =
    `${vendas.length} venda${vendas.length === 1 ? "" : "s"} no histórico · Todos os períodos`;
}

async function navegar() {
  pagina = location.hash.slice(1);
  if (!nomes[pagina]) {
    location.hash = "relatorio";
    return;
  }
  document.querySelectorAll(".page").forEach((secao) => {
    secao.hidden = secao.id !== `page-${pagina}`;
  });
  document.querySelectorAll("nav a").forEach((link) => {
    if (link.dataset.page === pagina) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  $("#breadcrumb").textContent = nomes[pagina];
  document.title = `${nomes[pagina]} · Estoque Fácil`;
  $("#notice").hidden = true;
  try {
    if (pagina === "relatorio") await carregarRelatorio();
    else await carregarProdutos();
  } catch (erro) {
    avisar(`Não foi possível carregar os dados. ${erro.message}`, true);
  }
}

function editarProduto(produto) {
  const formulario = $("#product-form");
  formulario.reset();
  formulario.elements.id.value = "";
  formulario.elements.versao.value = "";
  $("#product-error").hidden = true;
  $("#product-dialog-title").textContent = produto
    ? "Editar produto"
    : "Novo produto";
  if (produto)
    for (const campo of [
      "id",
      "versao",
      "nome",
      "categoria",
      "preco",
      "estoque",
      "estoque_minimo",
    ])
      formulario.elements[campo].value = produto[campo];
  $("#product-dialog").showModal();
  formulario.elements.nome.focus();
}

$("#new-product").addEventListener("click", () => editarProduto());
$("#close-product").addEventListener("click", () =>
  $("#product-dialog").close(),
);
$("#cancel-product").addEventListener("click", () =>
  $("#product-dialog").close(),
);
$("#product-search").addEventListener("input", listarProdutos);
$("#product-rows").addEventListener("click", (evento) => {
  const editar = evento.target.closest("[data-editar]");
  if (editar)
    editarProduto(
      produtos.find((produto) => produto.id === Number(editar.dataset.editar)),
    );
  const excluir = evento.target.closest("[data-excluir]");
  if (excluir) {
    excluirId = Number(excluir.dataset.excluir);
    $("#delete-description").textContent =
      `“${produtos.find((produto) => produto.id === excluirId).nome}” será removido do cadastro.`;
    $("#delete-error").hidden = true;
    $("#delete-dialog").showModal();
  }
});

$("#product-form").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const botao = formulario.querySelector("[type=submit]");
  botao.disabled = true;
  const dados = Object.fromEntries(new FormData(formulario));
  for (const campo of ["preco", "estoque", "estoque_minimo", "versao"])
    dados[campo] = Number(dados[campo]);
  try {
    await api(
      dados.id ? `produtos/${dados.id}` : "produtos",
      dados.id ? "PUT" : "POST",
      dados,
    );
    $("#product-dialog").close();
    avisar("Produto salvo com sucesso.");
    await carregarProdutos();
  } catch (erro) {
    if ($("#product-dialog").open) {
      $("#product-error").textContent = erro.message;
      $("#product-error").hidden = false;
    } else
      avisar(
        `Produto salvo, mas a lista não pôde ser atualizada: ${erro.message}`,
        true,
      );
  } finally {
    botao.disabled = false;
  }
});

$("#cancel-delete").addEventListener("click", () =>
  $("#delete-dialog").close(),
);
$("#confirm-delete").addEventListener("click", async (evento) => {
  const botao = evento.currentTarget;
  botao.disabled = true;
  try {
    await api(`produtos/${excluirId}`, "DELETE");
    $("#delete-dialog").close();
    avisar("Produto excluído.");
    await carregarProdutos();
  } catch (erro) {
    if ($("#delete-dialog").open) {
      $("#delete-error").textContent = erro.message;
      $("#delete-error").hidden = false;
    } else
      avisar(
        `Produto excluído, mas a lista não pôde ser atualizada: ${erro.message}`,
        true,
      );
  } finally {
    botao.disabled = false;
  }
});

function dadosVenda(formulario) {
  const dados = Object.fromEntries(new FormData(formulario));
  for (const campo of ["produto_id", "quantidade", "desconto"])
    dados[campo] = Number(dados[campo]);
  return dados;
}

function valores(resultado) {
  return `<dl><div><dt>Quantidade</dt><dd>${resultado.quantidade} un.</dd></div><div><dt>Subtotal</dt><dd>${dinheiro(resultado.subtotal)}</dd></div><div><dt>Desconto</dt><dd>− ${dinheiro(resultado.desconto_valor)}</dd></div><div class="total"><dt>Total</dt><dd>${dinheiro(resultado.total)}</dd></div></dl>`;
}

$("#budget-form").addEventListener("input", () => {
  revisaoOrcamento++;
  $("#budget-result").innerHTML =
    '<span class="result-symbol" aria-hidden="true">=</span><h2>Calcule o orçamento</h2><p>Os dados foram alterados. Calcule para conferir o valor atualizado.</p>';
});
$("#budget-form").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const botao = evento.currentTarget.querySelector("[type=submit]");
  const revisao = revisaoOrcamento;
  botao.disabled = true;
  try {
    const resultado = await api(
      "orcamento",
      "POST",
      dadosVenda(evento.currentTarget),
    );
    if (revisao !== revisaoOrcamento) return;
    $("#budget-result").innerHTML =
      `<span class="eyebrow">ORÇAMENTO CALCULADO</span><h2>${escapar(resultado.produto)}</h2>${valores(resultado)}<p>${resultado.estoque < resultado.quantidade ? "Atenção: a quantidade solicitada supera o estoque disponível." : `${resultado.estoque} unidades disponíveis no estoque.`}</p>`;
  } catch (erro) {
    avisar(erro.message, true);
  } finally {
    botao.disabled = false;
  }
});

$("#sale-form").addEventListener("submit", async (evento) => {
  evento.preventDefault();
  const formulario = evento.currentTarget;
  const botao = formulario.querySelector("[type=submit]");
  botao.disabled = true;
  let concluida = false;
  try {
    const resultado = await api("vendas", "POST", dadosVenda(formulario));
    concluida = true;
    $("#sale-result").innerHTML =
      `<span class="result-symbol" aria-hidden="true">✓</span><span class="eyebrow">VENDA #${String(resultado.venda_id).padStart(4, "0")} CONFIRMADA</span><h2>${escapar(resultado.produto)}</h2><p>Cliente: ${escapar(resultado.cliente)}</p>${valores(resultado)}<a class="button secondary" href="#relatorio">Ver no relatório</a>`;
    avisar("Venda registrada. O estoque foi atualizado.");
    formulario.reset();
    await carregarProdutos();
  } catch (erro) {
    avisar(
      concluida
        ? `Venda registrada, mas a lista não pôde ser atualizada: ${erro.message}`
        : erro.message,
      true,
    );
  } finally {
    botao.disabled = false;
  }
});

$("#refresh-report").addEventListener("click", async (evento) => {
  const botao = evento.currentTarget;
  botao.disabled = true;
  try {
    await carregarRelatorio();
    avisar("Relatório atualizado.");
  } catch (erro) {
    avisar(erro.message, true);
  } finally {
    botao.disabled = false;
  }
});
window.addEventListener("hashchange", navegar);
api("status")
  .then((resultado) => {
    $("#db-status").textContent = resultado.database;
  })
  .catch(() => {
    $("#db-status").textContent = "Banco indisponível";
  });
navegar();
