# Validação — Supabase e Redis

Execução final em 29/10/2026, Windows, Node.js 24, Supabase local oficial em Docker e Redis 7.4.

## Resultado automatizado

Comando: `node --env-file=.env --test --test-concurrency=1`

**12 testes aprovados; 0 falhas; 0 ignorados.**

Os nove testes herdados usam PGlite isolado e verificam instalação dos objetos SQL, CRUD, cálculo monetário, venda e movimentação, rollback por falta de estoque, concorrência pela última unidade, edição desatualizada, histórico e persistência após reabrir o banco.

Os três testes novos verificam:

1. Serviços reais: Data API do Supabase, conexão PostgreSQL, cadastro, MISS/HIT, invalidação após gravação, venda de duas unidades com desconto, baixa de estoque, expiração em dois segundos e RLS. Uma segunda conexão verifica os dados persistidos.
2. Corrida entre leitura e invalidação: uma consulta iniciada antes da gravação não repõe a resposta antiga no cache.
3. Redis indisponível: leitura recorre ao banco e invalidação não provoca falsa falha de uma operação confirmada.

O teste real cria registros próprios e limpa apenas esses registros ao finalizar. Seu prefixo Redis usa UUID para isolar as chaves.

`npx supabase db advisors --local --type security --level warn --fail-on warn`: nenhum problema encontrado.

`npm audit`: 0 vulnerabilidades reportadas na execução.

## Conferência na interface e vídeo

- Cadastro de Kit de estudo Supabase, preço R$ 49,90 e estoque 12; registro aparece na lista e a Data API passa a contar sete produtos.
- Limpeza seguida de duas consultas: MISS, depois HIT; chaves e TTL aparecem no painel.
- Venda de duas unidades do Caderno universitário, com 10% de desconto: total R$ 44,82. Saldo caiu de 38 para 36; relatório exibe a venda e a leitura direta da API do Supabase mostra o novo saldo.
- Redis foi parado com Docker Compose: a tela mostrou indisponibilidade e BYPASS, mantendo acesso aos sete produtos.
- Redis reiniciado: nova consulta MISS, seguida de HIT.

O vídeo contém captura da aplicação em execução e narração sintetizada, com aproximadamente 3 minutos e 11 segundos. As imagens no README foram capturadas da mesma execução. A validação local não representa teste de carga, implantação pública ou consistência de múltiplas instâncias durante falhas distribuídas.
