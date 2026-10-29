SET local check_function_bodies = off;

CREATE TABLE "public"."controle_banco" (
  "nome"        text                     NOT NULL,
  "aplicado_em" timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "controle_banco_pkey" PRIMARY KEY (nome)
);

ALTER TABLE "public"."controle_banco"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."controle_banco" FROM "anon", "authenticated";

CREATE TABLE "public"."movimentacoes" (
  "id"         integer                  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "produto_id" integer                  NOT NULL,
  "venda_id"   integer,
  "tipo"       character varying(10)    NOT NULL,
  "quantidade" integer                  NOT NULL,
  "criado_em"  timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "movimentacoes_pkey" PRIMARY KEY (id),
  CONSTRAINT "movimentacoes_quantidade_check" CHECK ((quantidade <> 0)),
  CONSTRAINT "movimentacoes_tipo_check" CHECK (((tipo)::text = ANY ((ARRAY['entrada'::character varying, 'ajuste'::character varying, 'venda'::character varying])::text[])))
);

ALTER TABLE "public"."movimentacoes"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."movimentacoes" FROM "anon", "authenticated";

CREATE TABLE "public"."produtos" (
  "id"             integer                  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "nome"           character varying(100)   NOT NULL,
  "categoria"      character varying(60)    NOT NULL,
  "preco"          numeric(12,2)            NOT NULL,
  "estoque"        integer                  NOT NULL,
  "estoque_minimo" integer                  NOT NULL DEFAULT 5,
  "versao"         integer                  NOT NULL DEFAULT 1,
  "criado_em"      timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "produtos_categoria_check" CHECK ((length(TRIM(BOTH FROM categoria)) > 0)),
  CONSTRAINT "produtos_estoque_check" CHECK (((estoque >= 0) AND (estoque <= 1000000))),
  CONSTRAINT "produtos_estoque_minimo_check" CHECK (((estoque_minimo >= 0) AND (estoque_minimo <= 1000000))),
  CONSTRAINT "produtos_nome_check" CHECK ((length(TRIM(BOTH FROM nome)) > 0)),
  CONSTRAINT "produtos_pkey" PRIMARY KEY (id),
  CONSTRAINT "produtos_preco_check" CHECK (((preco > (0)::numeric) AND (preco < (1000000)::numeric)))
);

ALTER TABLE "public"."produtos"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."produtos" FROM "anon", "authenticated";

CREATE TABLE "public"."vendas" (
  "id"                  integer                  GENERATED ALWAYS AS IDENTITY NOT NULL,
  "produto_id"          integer                  NOT NULL,
  "produto_nome"        character varying(100)   NOT NULL,
  "cliente"             character varying(100)   NOT NULL,
  "quantidade"          integer                  NOT NULL,
  "preco_unitario"      numeric(12,2)            NOT NULL,
  "desconto_percentual" numeric(5,2)             NOT NULL,
  "total"               numeric(16,2)            NOT NULL,
  "criado_em"           timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vendas_cliente_check" CHECK ((length(TRIM(BOTH FROM cliente)) > 0)),
  CONSTRAINT "vendas_desconto_percentual_check" CHECK (((desconto_percentual >= (0)::numeric) AND (desconto_percentual <= (100)::numeric))),
  CONSTRAINT "vendas_pkey" PRIMARY KEY (id),
  CONSTRAINT "vendas_preco_unitario_check" CHECK ((preco_unitario > (0)::numeric)),
  CONSTRAINT "vendas_quantidade_check" CHECK (((quantidade >= 1) AND (quantidade <= 1000000))),
  CONSTRAINT "vendas_total_check" CHECK ((total >= (0)::numeric))
);

ALTER TABLE "public"."vendas"
  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE "public"."vendas" FROM "anon", "authenticated";

REVOKE ALL ON SEQUENCE "public"."movimentacoes_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."movimentacoes_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."produtos_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."produtos_id_seq" FROM "authenticated";

REVOKE ALL ON SEQUENCE "public"."vendas_id_seq" FROM "anon";

REVOKE ALL ON SEQUENCE "public"."vendas_id_seq" FROM "authenticated";

CREATE OR REPLACE FUNCTION public.calcular_total (
  p_preco      numeric,
  p_quantidade integer,
  p_desconto   numeric DEFAULT 0
)
  RETURNS numeric
  LANGUAGE plpgsql
  IMMUTABLE
  SET search_path TO 'public', 'pg_temp'
  AS $function$
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
$function$;

REVOKE ALL ON FUNCTION "public"."calcular_total"(numeric, integer, numeric) FROM PUBLIC, "anon", "authenticated";

CREATE OR REPLACE PROCEDURE public.registrar_venda (
  IN    p_produto_id integer,
  IN    p_quantidade integer,
  IN    p_desconto numeric,
  IN    p_cliente text,
  INOUT p_venda_id integer   DEFAULT NULL::integer
)
  LANGUAGE plpgsql
  SET search_path TO 'public', 'pg_temp'
  AS $procedure$
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
$procedure$;

REVOKE ALL ON PROCEDURE "public"."registrar_venda"(integer, integer, numeric, text, integer) FROM PUBLIC, "anon", "authenticated";

ALTER TABLE "public"."movimentacoes"
  ADD CONSTRAINT "movimentacoes_produto_id_fkey" FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE CASCADE;

ALTER TABLE "public"."movimentacoes"
  ADD CONSTRAINT "movimentacoes_venda_id_fkey" FOREIGN KEY (venda_id) REFERENCES public.vendas(id) ON DELETE RESTRICT;

ALTER TABLE "public"."vendas"
  ADD CONSTRAINT "vendas_produto_id_fkey" FOREIGN KEY (produto_id) REFERENCES public.produtos(id) ON DELETE RESTRICT;

CREATE VIEW "public"."relatorio_vendas" WITH (security_invoker=true) AS  SELECT v.id AS venda_id,
    v.criado_em,
    v.cliente,
    v.produto_id,
    v.produto_nome AS produto,
    p.categoria AS categoria_atual,
    v.quantidade,
    v.preco_unitario,
    v.desconto_percentual,
    ((v.preco_unitario * (v.quantidade)::numeric))::numeric(16,2) AS subtotal,
    (((v.preco_unitario * (v.quantidade)::numeric) - v.total))::numeric(16,2) AS desconto_valor,
    v.total
   FROM (public.vendas v
     JOIN public.produtos p ON ((p.id = v.produto_id)));

REVOKE ALL ON TABLE "public"."relatorio_vendas" FROM "anon", "authenticated";

CREATE INDEX idx_movimentacoes_produto ON public.movimentacoes USING btree (produto_id);

CREATE INDEX idx_vendas_data ON public.vendas USING btree (criado_em);

CREATE INDEX idx_vendas_produto ON public.vendas USING btree (produto_id);

REVOKE ALL ON FUNCTION "public"."calcular_total"(numeric, integer, numeric) FROM "postgres";

GRANT EXECUTE ON FUNCTION "public"."calcular_total"(numeric, integer, numeric) TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."calcular_total"(numeric, integer, numeric) TO "service_role";

REVOKE ALL ON PROCEDURE "public"."registrar_venda"(integer, integer, numeric, text, integer) FROM "postgres";

GRANT EXECUTE ON PROCEDURE "public"."registrar_venda"(integer, integer, numeric, text, integer) TO "postgres";

GRANT EXECUTE ON PROCEDURE "public"."registrar_venda"(integer, integer, numeric, text, integer) TO "service_role";

REVOKE ALL ON SEQUENCE "public"."movimentacoes_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimentacoes_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."movimentacoes_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."movimentacoes_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."produtos_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."produtos_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."produtos_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."produtos_id_seq" TO "service_role";

REVOKE ALL ON SEQUENCE "public"."vendas_id_seq" FROM "postgres";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vendas_id_seq" TO "postgres";

REVOKE ALL ON SEQUENCE "public"."vendas_id_seq" FROM "service_role";

GRANT SELECT, UPDATE, USAGE ON SEQUENCE "public"."vendas_id_seq" TO "service_role";

REVOKE ALL ON TABLE "public"."controle_banco" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."controle_banco" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."controle_banco" TO "service_role";

REVOKE ALL ON TABLE "public"."movimentacoes" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimentacoes" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."movimentacoes" TO "service_role";

REVOKE ALL ON TABLE "public"."produtos" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."produtos" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."produtos" TO "service_role";

REVOKE ALL ON TABLE "public"."vendas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."vendas" TO "service_role";

REVOKE ALL ON TABLE "public"."relatorio_vendas" FROM "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."relatorio_vendas" TO "postgres";

GRANT DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE ON TABLE "public"."relatorio_vendas" TO "service_role";

