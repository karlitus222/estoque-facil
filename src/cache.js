import { createClient } from 'redis';
import { randomUUID } from 'node:crypto';

// Redis é apenas cache. Falhas nunca transformam uma venda confirmada em erro.
export async function abrirCache({ url = process.env.REDIS_URL, ttl = Number(process.env.CACHE_TTL || 30), prefixo = 'estoque:v2' } = {}) {
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 3600) throw new Error('CACHE_TTL deve estar entre 1 e 3600 segundos.');
  const client = createClient({ url, disableOfflineQueue: true, socket: { connectTimeout: 1500, reconnectStrategy: retries => Math.min(200 * (retries + 1), 2000) } });
  const metricas = { hits: 0, misses: 0, bypass: 0, invalidacoes: 0, erros: 0 };
  let sujo = true;
  let ultima = null;
  const recursos = ['produtos', 'relatorio'];
  const key = recurso => `${prefixo}:${recurso}`;
  const epoch = `${prefixo}:geracao`;
  client.on('error', () => { sujo = true; });
  client.on('reconnecting', () => { sujo = true; });
  // Não impede o aplicativo de iniciar se Redis estiver temporariamente fora.
  client.connect().catch(() => { sujo = true; });

  async function preparar() {
    if (!client.isReady) throw new Error('Redis indisponível');
    if (sujo) {
      await client.multi().set(epoch, randomUUID()).del(recursos.map(key)).exec();
      sujo = false;
    }
  }
  async function ler(recurso, carregar) {
    const inicio = performance.now();
    let geracao;
    let disponivel = false;
    try {
      await preparar();
      const [versao, valor] = await client.mGet([epoch, key(recurso)]);
      geracao = versao;
      disponivel = true;
      if (valor) {
        const entrada = JSON.parse(valor);
        if (entrada.geracao === geracao) {
          metricas.hits++;
          ultima = { recurso, origem: 'HIT — Redis', ms: +(performance.now() - inicio).toFixed(2), em: new Date().toISOString() };
          return { dados: entrada.dados, ...ultima };
        }
      }
      metricas.misses++;
    } catch { sujo = true; metricas.bypass++; }
    const dados = await carregar();
    if (disponivel) {
      try {
        // Compare-and-set: consulta antiga não repõe dados depois de uma invalidação.
        await client.eval("if redis.call('GET',KEYS[1]) == ARGV[1] then return redis.call('SET',KEYS[2],ARGV[2],'EX',ARGV[3]) else return nil end", {
          keys: [epoch, key(recurso)], arguments: [geracao ?? '', JSON.stringify({ geracao, dados }), String(ttl)]
        });
      } catch { sujo = true; metricas.erros++; }
    }
    ultima = { recurso, origem: disponivel ? 'MISS — Supabase' : 'BYPASS — Supabase (Redis indisponível)', ms: +(performance.now() - inicio).toFixed(2), em: new Date().toISOString() };
    return { dados, ...ultima };
  }
  async function invalidar() {
    metricas.invalidacoes++;
    try {
      await preparar();
      await client.multi().set(epoch, randomUUID()).del(recursos.map(key)).exec();
    } catch { sujo = true; metricas.erros++; }
  }
  async function status() {
    try {
      await preparar();
      const pong = await client.ping();
      const chaves = await Promise.all(recursos.map(async recurso => ({ recurso, chave: key(recurso), ttl: await client.ttl(key(recurso)) })));
      return { conectado: pong === 'PONG', ttlConfigurado: ttl, metricas: { ...metricas }, ultima, chaves };
    } catch { return { conectado: false, ttlConfigurado: ttl, metricas: { ...metricas }, ultima, chaves: [] }; }
  }
  return { ler, invalidar, status, async close() { if (client.isOpen) client.destroy(); } };
}
