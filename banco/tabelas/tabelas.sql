CREATE TABLE IF NOT EXISTS produtos (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nome VARCHAR(100) NOT NULL CHECK (length(trim(nome)) > 0),
    categoria VARCHAR(60) NOT NULL CHECK (length(trim(categoria)) > 0),
    preco NUMERIC(12,2) NOT NULL CHECK (preco > 0 AND preco < 1000000),
    estoque INTEGER NOT NULL CHECK (estoque BETWEEN 0 AND 1000000),
    estoque_minimo INTEGER NOT NULL DEFAULT 5 CHECK (estoque_minimo BETWEEN 0 AND 1000000),
    versao INTEGER NOT NULL DEFAULT 1,
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendas (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE RESTRICT,
    produto_nome VARCHAR(100) NOT NULL,
    cliente VARCHAR(100) NOT NULL CHECK (length(trim(cliente)) > 0),
    quantidade INTEGER NOT NULL CHECK (quantidade BETWEEN 1 AND 1000000),
    preco_unitario NUMERIC(12,2) NOT NULL CHECK (preco_unitario > 0),
    desconto_percentual NUMERIC(5,2) NOT NULL CHECK (desconto_percentual BETWEEN 0 AND 100),
    total NUMERIC(16,2) NOT NULL CHECK (total >= 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS movimentacoes (
    id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    produto_id INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
    venda_id INTEGER REFERENCES vendas(id) ON DELETE RESTRICT,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('entrada', 'ajuste', 'venda')),
    quantidade INTEGER NOT NULL CHECK (quantidade <> 0),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendas_produto ON vendas(produto_id);
CREATE INDEX IF NOT EXISTS idx_vendas_data ON vendas(criado_em);
CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes(produto_id);
