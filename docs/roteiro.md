# Roteiro do vídeo

Duração sugerida: 5 a 7 minutos. Antes de gravar, execute `npm start`, abra o navegador e deixe os arquivos SQL e `src/rotas.js` disponíveis no editor. Use este roteiro como guia e explique o código com suas próprias palavras.

## 1. Apresentação — cerca de 30 segundos

Informe seu nome, a disciplina e o nome do sistema. Explique que ele ajuda uma pequena loja a controlar produtos e registrar vendas sem atualizar o estoque manualmente.

Mostre o menu com Produtos e estoque, Orçamento, Nova venda e Relatório de vendas.

## 2. Cadastro — cerca de 1 minuto

1. Abra Produtos e estoque.
2. Cadastre `Produto da apresentação`, categoria `Papelaria`, preço `25,00`, estoque `10` e mínimo `2`.
3. Mostre o novo registro na tabela e na busca.
4. Edite o nome ou o estoque, salve e mostre a atualização.
5. Se quiser demonstrar exclusão, cadastre e exclua um segundo produto sem vendas.

Explique que o sistema preserva produtos com vendas para não perder o histórico.

## 3. Function — cerca de 1 minuto

Abra `banco/funcoes/total.sql` e mostre `CREATE OR REPLACE FUNCTION calcular_total`.

Explique os parâmetros: preço, quantidade e desconto percentual. Mostre a fórmula e o arredondamento. A função retorna um valor numérico e não altera o estoque.

Na tela Orçamento, selecione o produto de R$ 25,00, quantidade 2 e desconto de 10%. Clique em Calcular orçamento. O resultado esperado é **R$ 45,00**.

Em `src/rotas.js`, localize `/api/orcamento` e o `SELECT` com `calcular_total`. Explique a sequência: formulário, rota, Function e total na tela.

## 4. Procedure — cerca de 1 minuto e meio

Abra `banco/procedures/venda.sql` e mostre `CREATE OR REPLACE PROCEDURE registrar_venda`.

Explique:

- Recebe produto, quantidade, desconto e cliente; devolve o código pelo parâmetro `INOUT`;
- Busca o produto com `FOR UPDATE` e verifica o saldo;
- Reutiliza a Function para calcular;
- Insere a venda, reduz o estoque e registra a movimentação;
- Se alguma etapa falhar, a transação desfaz as alterações.

Mostre o `CALL` dentro da rota `/api/vendas`. Depois registre uma venda do produto de demonstração com quantidade 2 e desconto de 10%. Mostre a confirmação e volte ao cadastro para conferir a redução do estoque.

## 5. View — cerca de 1 minuto

Abra `banco/views/vendas.sql` e mostre `CREATE OR REPLACE VIEW relatorio_vendas`.

Explique que ela junta `vendas` e `produtos`, reunindo data, cliente, produto, quantidade, preço, desconto e total. O nome e o preço da venda são preservados; a categoria vem do cadastro atual.

Em `src/rotas.js`, mostre `/api/relatorio` consultando a View. Abra Relatório de vendas e localize a venda recém-criada. Mostre a atualização dos indicadores.

## 6. Integração e erro — cerca de 1 minuto

Tente registrar uma quantidade maior que o estoque. Mostre a mensagem de estoque insuficiente. Volte ao relatório e ao cadastro para confirmar que não houve nova venda nem baixa indevida.

Se necessário, abra a aba Rede/Network das ferramentas do navegador e mostre uma requisição a `/api/orcamento` ou `/api/vendas` e seu resultado, junto da rota correspondente no editor.

Encerre explicando as finalidades diferentes: a Function calcula, a Procedure executa o processo e a View organiza a consulta. Mostre rapidamente o repositório e as instruções de execução.

## Conferência antes de enviar

- Áudio compreensível e letras legíveis;
- Seu nome e objetivo do sistema apresentados;
- Código e utilização dos três recursos mostrados;
- Venda e alteração de estoque demonstradas;
- Link do vídeo acessível ao professor;
- Nenhuma senha pessoal ou arquivo `.env` exibido na gravação.
