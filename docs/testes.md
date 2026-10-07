# Verificação do sistema

O fluxo verificado é: formulário da aplicação, rota HTTP, operação no PostgreSQL e retorno dos dados para a tela.

## Testes de integração

Execute `npm test`. Os nove casos verificam:

1. Criação de View, Function e Procedure reais, sem duplicar a carga inicial;
2. Cadastro, consulta, edição e exclusão de produtos;
3. Orçamento com arredondamento decimal, sem movimentar estoque;
4. Venda, baixa de estoque, movimentação e consulta na View;
5. Rejeição de estoque insuficiente e de quantidade inválida, sem alterações parciais;
6. Duas solicitações simultâneas disputando a última unidade;
7. Proteção contra edição desatualizada e preservação do histórico vendido;
8. Validação de dados na API e na Function SQL;
9. Persistência após fechar e reabrir o banco local.

Os testes usam PGlite em memória e uma pasta temporária para verificar persistência. O modo com servidor PostgreSQL externo não faz parte dessa execução.

## Conferência manual das telas

Depois de iniciar com `npm start`, abra `http://localhost:3000` e confira:

| Tela | Ação | Resultado esperado |
| --- | --- | --- |
| Produtos e estoque | Cadastrar, buscar e editar um produto | A lista mostra os dados salvos |
| Produtos e estoque | Excluir um produto sem vendas | O registro sai da lista |
| Orçamento | Produto de R$ 25,00, quantidade 2, desconto 10% | Total de R$ 45,00, sem reduzir o estoque |
| Nova venda | Vender 2 unidades de um produto com saldo 10 | Confirmação da venda e saldo 8 |
| Nova venda | Pedir mais unidades que o saldo | Mensagem de estoque insuficiente |
| Relatório de vendas | Abrir após registrar a venda | A venda aparece e os indicadores são atualizados |
| Produtos e estoque | Excluir um produto já vendido | Mensagem informando que o histórico precisa ser preservado |

A verificação automatizada das rotas e do banco não substitui essa conferência visual no navegador.
