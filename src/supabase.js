import { createClient } from '@supabase/supabase-js';

export function criarSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key || !process.env.SUPABASE_DB_URL) {
    throw new Error('Configure SUPABASE_URL, SUPABASE_SECRET_KEY e SUPABASE_DB_URL no .env. Execute npm run local:config após iniciar o Supabase.');
  }
  const api = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    async verificar() {
      const inicio = performance.now();
      // Leitura REAL pela Data API. Chave de servidor nunca é enviada à interface.
      const { data, count, error } = await api.from('produtos').select('id,nome,estoque', { count: 'exact' }).order('id').limit(5);
      if (error) throw new Error('Falha ao consultar a Data API do Supabase. Confira a configuração do servidor.');
      return { conectado: true, modo: new URL(url).hostname === '127.0.0.1' || new URL(url).hostname === 'localhost' ? 'Supabase local (Docker)' : 'Supabase hospedado', produtos: count, amostra: data, ms: +(performance.now() - inicio).toFixed(2) };
    }
  };
}
