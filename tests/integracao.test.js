import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { abrirBanco } from '../src/banco.js';
import { abrirCache } from '../src/cache.js';
import { criarApp } from '../src/rotas.js';
import { criarSupabase } from '../src/supabase.js';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

test('Supabase + Redis reais: CRUD, HIT/MISS, invalidação, expiração, venda e RLS', { skip: !process.env.SUPABASE_DB_URL }, async () => {
  const db = await abrirBanco();
  const cache = await abrirCache({ ttl: 2, prefixo: `teste:${randomUUID()}` });
  let server, produtoId;
  try {
    for(let i=0;i<30 && !(await cache.status()).conectado;i++) await delay(100);
    assert.equal((await cache.status()).conectado, true);
    const sb = criarSupabase();
    assert.equal((await sb.verificar()).conectado, true);
    server = criarApp(db, {cache,supabase:sb}).listen(0,'127.0.0.1');
    await new Promise(resolve => server.once('listening',resolve));
    const url=`http://127.0.0.1:${server.address().port}/api/`;
    async function req(path,method='GET',body) {
      const r=await fetch(url+path,{method,headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
      return {status:r.status,cache:r.headers.get('x-cache'),data:r.status===204?null:await r.json()};
    }
    assert.equal((await req('produtos')).cache,'MISS');
    assert.equal((await req('produtos')).cache,'HIT');
    const produto=(await req('produtos','POST',{nome:'Integração automática',categoria:'Teste isolado',preco:20,estoque:10,estoque_minimo:2})).data;
    produtoId=produto.id;
    assert.ok(produtoId);
    assert.equal((await req('produtos')).cache,'MISS');
    assert.equal((await req('produtos')).cache,'HIT');
    assert.equal((await db.query('SELECT estoque FROM produtos WHERE id=$1',[produtoId])).rows[0].estoque,10);
    await req('relatorio');
    assert.equal((await req('relatorio')).cache,'HIT');
    const venda=await req('vendas','POST',{produto_id:produtoId,quantidade:2,desconto:10,cliente:'Teste de integração'});
    assert.equal(venda.status,201);
    assert.equal(Number(venda.data.total),36);
    const atual=await req('produtos');
    assert.equal(atual.cache,'MISS');
    assert.equal(atual.data.find(p=>p.id===produtoId).estoque,8);
    assert.equal((await req('relatorio')).cache,'MISS');
    await delay(2100);
    assert.equal((await req('produtos')).cache,'MISS');
    const security=(await db.query("SELECT relrowsecurity FROM pg_class WHERE oid='public.produtos'::regclass")).rows[0];
    assert.equal(security.relrowsecurity,true);
    assert.equal((await db.query("SELECT has_table_privilege('anon','public.produtos','SELECT') AS acesso")).rows[0].acesso,false);
    const second = await abrirBanco();
    try { assert.equal((await second.query('SELECT estoque FROM produtos WHERE id=$1',[produtoId])).rows[0].estoque,8); }
    finally { await second.close(); }
  } finally {
    if(server) await new Promise(resolve=>server.close(resolve));
    await cache.invalidar(); await cache.close();
    if(produtoId) await db.transaction(async tx=>{await tx.query('DELETE FROM movimentacoes WHERE produto_id=$1',[produtoId]);await tx.query('DELETE FROM vendas WHERE produto_id=$1',[produtoId]);await tx.query('DELETE FROM produtos WHERE id=$1',[produtoId]);});
    await db.close();
  }
});

test('consulta concorrente anterior à gravação não repõe cache velho', {skip:!process.env.REDIS_URL}, async()=>{
  const cache=await abrirCache({ttl:2,prefixo:`teste:${randomUUID()}`});
  try {
    for(let i=0;i<30 && !(await cache.status()).conectado;i++) await delay(100);
    let resolver,comecou;
    const sinal=new Promise(r=>comecou=r);
    const consulta=cache.ler('produtos',async()=>{comecou();await new Promise(r=>resolver=r);return ['velho'];});
    await sinal;await cache.invalidar();resolver();await consulta;
    const atual=await cache.ler('produtos',async()=>['novo']);
    assert.deepEqual(atual.dados,['novo']);
    assert.match(atual.origem,/MISS/);
    assert.deepEqual((await cache.ler('produtos',async()=>{throw new Error('Não deveria ler banco');})).dados,['novo']);
  } finally {await cache.invalidar();await cache.close();}
});

test('Redis indisponível mantém leitura e invalidação sem falsa falha de gravação', async()=>{
  const cache=await abrirCache({url:'redis://127.0.0.1:1'});
  try {
    assert.deepEqual((await cache.ler('produtos',async()=>['dado no Supabase'])).dados,['dado no Supabase']);
    await cache.invalidar();
    assert.equal((await cache.status()).conectado,false);
  } finally {await cache.close();}
});
