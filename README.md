# Estoque Fácil

Sistema de estoque e vendas desenvolvido para a disciplina Projeto de Banco de Dados.

[Repositório no GitHub](https://github.com/karlitus222/estoque-facil)

- **Aluno:** Carlos Gabriel Raposo Landim
- **Disciplina:** Projeto de Banco de Dados
- **Professor:** Anderson Soares
- **Trabalho:** individual
- **Entrega:** 07/10/2026

## Sobre o sistema

O sistema permite cadastrar produtos, controlar quantidades, calcular um orçamento com desconto e registrar vendas. O objetivo é evitar o controle manual do estoque e reunir as vendas em um relatório.

Cada venda contém **um produto e uma quantidade**. O cadastro de cliente é apenas o nome informado na venda. Não há carrinho, pagamento ou emissão de nota fiscal.

## Tecnologias

- JavaScript e Node.js 22 ou superior;
- Express para a aplicação e as rotas HTTP;
- HTML, CSS e JavaScript nas telas;
- PostgreSQL e PL/pgSQL no banco;
- PGlite para executar o PostgreSQL dentro do processo Node.js no modo local;
- `pg` para a conexão opcional com um servidor PostgreSQL.

No modo padrão, o PGlite executa o motor do PostgreSQL e salva os dados em `.data/estoque`. A View, a Function e a Procedure são objetos SQL reais criados no banco. Os cálculos não são simulados no JavaScript. Consulte a [documentação do PGlite](https://pglite.dev/docs/about) e a [documentação de persistência](https://pglite.dev/docs/filesystems).

## Como executar

Requisito: Node.js 22 ou superior com npm. Na pasta do projeto:

```sh
npm install
npm start
```

Abra **http://localhost:3000**. No Windows, se o PowerShell bloquear `npm.ps1`, use `npm.cmd install` e `npm.cmd start`.

Na primeira execução, as tabelas, os três recursos SQL e os dados de exemplo são criados automaticamente. Nas próximas execuções, os dados são mantidos. Há seis produtos e quatro vendas fictícias iniciais. As datas dessas vendas correspondem ao momento da instalação.

Para encerrar, pressione `Ctrl+C` no terminal. Execute apenas uma instância usando a mesma pasta do banco local. Não é necessário Docker no modo padrão. Depois de instalar as dependências, o modo local funciona sem internet.

Para escolher outra porta, copie `.env.example` para `.env` e altere `PORT`. Para apenas preparar o banco, execute `npm run db:init` com a aplicação parada.

## Telas e recursos do banco

| Tela | Recurso | Uso real |
| --- | --- | --- |
| Produtos e estoque | CRUD | Cadastra, consulta, altera e exclui produtos sem vendas |
| Orçamento | Function `calcular_total` | Calcula o valor de um produto, sua quantidade e o desconto |
| Nova venda | Procedure `registrar_venda` | Registra a venda, baixa o estoque e cria a movimentação |
| Relatório de vendas | View `relatorio_vendas` | Apresenta o histórico e fornece os dados dos indicadores |

### Tabelas

- `produtos`: nome, categoria, preço, estoque, estoque mínimo e versão do cadastro;
- `vendas`: produto, nome do produto na venda, cliente, quantidade, preço, desconto, total e data;
- `movimentacoes`: entradas, ajustes e saídas do estoque;
- `controle_banco`: controle técnico da instalação inicial.

O preço e o nome vendidos são guardados em `vendas`. Alterar um produto não muda o histórico. A categoria apresentada no relatório é a categoria atual do cadastro.

### Function

Arquivo: [banco/funcoes/total.sql](banco/funcoes/total.sql).

`calcular_total(preco, quantidade, desconto)` retorna o total arredondado para duas casas decimais. Recebe preço numérico, quantidade inteira e desconto percentual. Usa `NUMERIC` para calcular valores monetários.

```sql
SELECT calcular_total(24.90, 2, 10); -- 44.82
```

A tela Orçamento envia os dados a `POST /api/orcamento`. A rota consulta a Function com o preço obtido do próprio banco. A Procedure também reutiliza a mesma Function.

### Procedure

Arquivo: [banco/procedures/venda.sql](banco/procedures/venda.sql).

`registrar_venda(produto_id, quantidade, desconto, cliente, venda_id)` verifica o produto, calcula o total, confere o estoque, insere a venda, atualiza o saldo e registra a saída. `venda_id` é um parâmetro `INOUT`, preenchido com o código da venda.

```sql
CALL registrar_venda(1, 2, 10, 'Maria Oliveira', NULL);
```

A tela Nova venda chama `POST /api/vendas`, que executa `CALL`. A operação participa de uma transação: se qualquer etapa falhar, nenhuma alteração é confirmada. O produto é lido com `FOR UPDATE` para proteger o saldo durante a venda.

### View

Arquivo: [banco/views/vendas.sql](banco/views/vendas.sql).

`relatorio_vendas` junta `vendas` e `produtos`, retornando cliente, produto, categoria atual, quantidade, preço, desconto, total e data. A tela Relatório de vendas consulta `GET /api/relatorio`. Essa rota usa a View tanto para a lista quanto para os indicadores.

```sql
SELECT * FROM relatorio_vendas ORDER BY criado_em DESC;
SELECT SUM(total) AS faturamento FROM relatorio_vendas;
```

As três finalidades são diferentes: **calcular** um orçamento, **executar** uma venda e **consultar** um relatório.

## Estrutura

```text
banco/
  tabelas/tabelas.sql
  views/vendas.sql
  funcoes/total.sql
  procedures/venda.sql
  dados/dados.sql
  criar.sql
src/
  servidor.js
  banco.js
  iniciar.js
  rotas.js
  publico/
    index.html
    estilo.css
    script.js
    icone.svg
docs/
  banco.md
  entrega.md
tests/
  sistema.test.js
README.md
```

## Usar um servidor PostgreSQL

O modo com servidor usa os mesmos scripts SQL. Pode ser utilizado com PostgreSQL 17 ou superior. Ele tem armazenamento separado do modo embarcado; trocar o modo não transfere os dados existentes.

Com Docker Desktop aberto:

```sh
docker compose up -d
```

Copie `.env.example` para `.env` e habilite:

```dotenv
DATABASE_URL=postgresql://estoque:estoque_local@localhost:5433/estoque_facil
```

Depois execute `npm start`. A instalação do banco acontece automaticamente. A senha do exemplo é apenas para o banco local de demonstração.

Também é possível criar manualmente as estruturas em um **banco novo e vazio**:

```sh
psql -h localhost -p 5433 -U estoque -d estoque_facil -f banco/criar.sql
```

O arquivo `criar.sql` é um script do cliente `psql`, pois usa `\ir` para incluir os outros arquivos. Para usar o editor do pgAdmin, execute o conteúdo dos arquivos na ordem: tabelas, função, procedure, view e dados. Prefira o inicializador do aplicativo para evitar repetir a carga de exemplo. Não execute o script manual sobre uma instalação já preenchida.

## Testes

```sh
npm test
```

Os testes usam bancos isolados. Verificam os objetos reais do PostgreSQL, o CRUD, os valores monetários, a integração da venda, a falta de estoque, requisições simultâneas, a preservação do histórico, validações e persistência após reiniciar. Não alteram os dados da aplicação.

O modo PGlite foi validado localmente. O modo com servidor PostgreSQL depende de um servidor disponível e não foi executado nesta máquina.

## Regras e limites

- Quantidade inteira positiva na venda e estoque nunca negativo;
- Desconto de 0 a 100%, com até duas casas decimais;
- Produtos com vendas não podem ser excluídos;
- Ajustes no estoque pelo cadastro também geram movimentações;
- Edições desatualizadas são rejeitadas para não sobrescrever uma venda recente;
- Orçamentos não reservam estoque; o valor final é calculado ao confirmar a venda;
- O servidor escuta apenas em `127.0.0.1`. Trata-se de uma aplicação acadêmica local, sem login;
- A lista do relatório mostra todas as vendas, sem paginação, adequada ao volume de demonstração.

## Apresentação

- [Explicação do banco e diagrama](docs/banco.md)
- [Testes e conferência das telas](docs/testes.md)
- [Passos para a entrega](docs/entrega.md)
