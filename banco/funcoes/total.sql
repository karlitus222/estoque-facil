-- Finalidade: calcular orçamentos com desconto usando aritmética decimal.
-- Também é reutilizada pela procedure, mantendo uma única regra de cálculo.
CREATE OR REPLACE FUNCTION calcular_total(
    p_preco NUMERIC,
    p_quantidade INTEGER,
    p_desconto NUMERIC DEFAULT 0
) RETURNS NUMERIC(16,2)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF p_preco IS NULL OR p_preco <= 0 OR p_preco >= 1000000
       OR p_preco::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Preço inválido.' USING ERRCODE = 'P0001';
    END IF;
    IF p_quantidade IS NULL OR p_quantidade NOT BETWEEN 1 AND 1000000 THEN
        RAISE EXCEPTION 'Quantidade deve ser um inteiro entre 1 e 1000000.' USING ERRCODE = 'P0001';
    END IF;
    IF p_desconto IS NULL OR p_desconto NOT BETWEEN 0 AND 100
       OR p_desconto::TEXT = 'NaN' OR p_desconto <> round(p_desconto, 2) THEN
        RAISE EXCEPTION 'Desconto deve estar entre 0 e 100, com até duas casas decimais.' USING ERRCODE = 'P0001';
    END IF;
    RETURN round(p_preco * p_quantidade * (1 - p_desconto / 100), 2);
END;
$$;
