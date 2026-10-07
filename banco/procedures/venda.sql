-- Finalidade: registrar uma venda e baixar seu estoque de forma atômica.
-- Cada venda deste projeto corresponde a um produto e sua quantidade.
CREATE OR REPLACE PROCEDURE registrar_venda(
    IN p_produto_id INTEGER,
    IN p_quantidade INTEGER,
    IN p_desconto NUMERIC,
    IN p_cliente TEXT,
    INOUT p_venda_id INTEGER DEFAULT NULL
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_produto produtos%ROWTYPE;
    v_total NUMERIC(16,2);
BEGIN
    IF p_cliente IS NULL OR length(trim(p_cliente)) NOT BETWEEN 1 AND 100 THEN
        RAISE EXCEPTION 'Informe um cliente com até 100 caracteres.' USING ERRCODE = 'P0001';
    END IF;

    -- O bloqueio impede duas vendas simultâneas de consumirem o mesmo saldo.
    SELECT * INTO v_produto FROM produtos WHERE id = p_produto_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Produto não encontrado.' USING ERRCODE = 'P0001';
    END IF;

    v_total := calcular_total(v_produto.preco, p_quantidade, p_desconto);
    IF v_produto.estoque < p_quantidade THEN
        RAISE EXCEPTION 'Estoque insuficiente. Disponível: %.', v_produto.estoque USING ERRCODE = 'P0001';
    END IF;

    INSERT INTO vendas (produto_id, produto_nome, cliente, quantidade, preco_unitario, desconto_percentual, total)
    VALUES (p_produto_id, v_produto.nome, trim(p_cliente), p_quantidade, v_produto.preco, p_desconto, v_total)
    RETURNING id INTO p_venda_id;

    UPDATE produtos SET estoque = estoque - p_quantidade, versao = versao + 1
    WHERE id = p_produto_id;

    INSERT INTO movimentacoes (produto_id, venda_id, tipo, quantidade)
    VALUES (p_produto_id, p_venda_id, 'venda', -p_quantidade);
    -- Sem COMMIT interno: a chamada inteira participa da transação do chamador.
END;
$$;
