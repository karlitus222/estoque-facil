-- Backend local usa conexão Postgres; interface não recebe credenciais.
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.controle_banco ENABLE ROW LEVEL SECURITY;
ALTER VIEW public.relatorio_vendas SET (security_invoker = true);
REVOKE ALL ON public.produtos, public.vendas, public.movimentacoes, public.controle_banco, public.relatorio_vendas FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.calcular_total(numeric,integer,numeric) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON PROCEDURE public.registrar_venda(integer,integer,numeric,text,integer) FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA public TO service_role;
GRANT SELECT ON public.produtos TO service_role;
ALTER FUNCTION public.calcular_total(numeric,integer,numeric) SET search_path = public, pg_temp;
ALTER PROCEDURE public.registrar_venda(integer,integer,numeric,text,integer) SET search_path = public, pg_temp;
