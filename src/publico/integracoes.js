async function carregarIntegracoes() {
  const { supabase, redis } = await api('integracoes');
  $('#supabase-connection').textContent = supabase?.conectado ? `● Conectado · ${supabase.modo}` : '○ Indisponível';
  $('#supabase-proof').textContent = supabase?.conectado ? `${supabase.produtos} produtos persistidos · leitura REST em ${supabase.ms} ms` : (supabase?.erro || 'Configure o servidor.');
  $('#redis-connection').textContent = redis?.conectado ? `● PONG recebido · TTL ${redis.ttlConfigurado}s` : '○ Indisponível · consultas usam o Supabase';
  $('#cache-counts').textContent = redis ? `HIT: ${redis.metricas.hits} · MISS: ${redis.metricas.misses} · BYPASS: ${redis.metricas.bypass} · Invalidações: ${redis.metricas.invalidacoes}` : '';
  $('#cache-keys').innerHTML = redis?.chaves.map(item => `<div class="key-row"><code>${escapar(item.chave)}</code><span>${item.ttl === -2 ? 'Ausente' : item.ttl < 0 ? 'Sem expiração' : `Expira em ${item.ttl}s`}</span></div>`).join('') || '<p>Sem conexão com o Redis.</p>';
  $('#supabase-sample').innerHTML = supabase?.amostra ? `<div class="table-scroll"><table><thead><tr><th>ID</th><th>Produto</th><th>Estoque no Supabase</th></tr></thead><tbody>${supabase.amostra.map(p => `<tr><td>${p.id}</td><td>${escapar(p.nome)}</td><td>${p.estoque} un.</td></tr>`).join('')}</tbody></table></div>` : '<p>Sem resultado disponível.</p>';
}
for (const [id, acao] of [
  ['check-integrations', async () => carregarIntegracoes()],
  ['clear-cache', async () => { await api('cache/limpar', 'POST', {}); $('#last-query').textContent = 'Cache invalidado. A próxima consulta buscará os dados no Supabase.'; await carregarIntegracoes(); }],
  ['query-products', async () => { const dados = await api('produtos'); $('#last-query').textContent = `${window.ultimaConsultaCache.origem} · ${dados.length} produtos · ${window.ultimaConsultaCache.tempo}`; await carregarIntegracoes(); }],
  ['query-report', async () => { const dados = await api('relatorio'); $('#last-query').textContent = `${window.ultimaConsultaCache.origem} · ${dados.resumo.vendas} vendas · ${window.ultimaConsultaCache.tempo}`; await carregarIntegracoes(); }]
]) {
  document.getElementById(id).addEventListener('click', async event => {
    const button = event.currentTarget; button.disabled = true;
    try { await acao(); } catch (error) { avisar(error.message, true); }
    finally { button.disabled = false; }
  });
}
