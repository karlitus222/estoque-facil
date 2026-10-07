-- Finalidade: disponibilizar uma consulta de vendas pronta para a tela de relatório.
-- Nome e preço da venda são históricos; categoria é a categoria atual do produto.
CREATE OR REPLACE VIEW relatorio_vendas AS
SELECT
    v.id AS venda_id,
    v.criado_em,
    v.cliente,
    v.produto_id,
    v.produto_nome AS produto,
    p.categoria AS categoria_atual,
    v.quantidade,
    v.preco_unitario,
    v.desconto_percentual,
    (v.preco_unitario * v.quantidade)::NUMERIC(16,2) AS subtotal,
    (v.preco_unitario * v.quantidade - v.total)::NUMERIC(16,2) AS desconto_valor,
    v.total
FROM vendas v
JOIN produtos p ON p.id = v.produto_id;
