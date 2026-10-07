-- Executar com psql em um banco novo: psql "$DATABASE_URL" -f banco/criar.sql
\set ON_ERROR_STOP on
BEGIN;
\ir tabelas/tabelas.sql
\ir funcoes/total.sql
\ir procedures/venda.sql
\ir views/vendas.sql
\ir dados/dados.sql
CREATE TABLE controle_banco (nome TEXT PRIMARY KEY, aplicado_em TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP);
INSERT INTO controle_banco(nome) VALUES ('inicio');
COMMIT;
