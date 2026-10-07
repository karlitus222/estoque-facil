# Entrega

- **Aluno:** Carlos Gabriel Raposo Landim
- **Disciplina:** Projeto de Banco de Dados
- **Professor:** Anderson Soares
- **Data:** 07/10/2026

## O que está no projeto

- CRUD de produtos;
- View, Function e Procedure integradas às telas;
- Scripts de tabelas, dados e recursos SQL;
- Instruções para execução local e servidor PostgreSQL;
- Diagrama e explicação das regras do banco;
- Testes de integração;
- Roteiro do vídeo.

## Antes de entregar

1. Execute `npm install`, `npm test` e `npm start`.
2. Confira o sistema em `http://localhost:3000`.
3. Revise o README e estude as chamadas SQL em `src/rotas.js`.
4. Publique o projeto no GitHub. O repositório precisa ser público ou permitir acesso ao professor.
5. Grave o vídeo seguindo `docs/roteiro.md` e disponibilize um link acessível.
6. Envie os links do repositório e do vídeo no local indicado pelo professor.

Não publique `.env`, `.data` nem `node_modules`. O `.gitignore` já exclui esses caminhos. Quem clonar o projeto recriará o banco pelos scripts e receberá apenas os dados fictícios iniciais.

## Publicar pelo terminal

Com o GitHub CLI instalado e autenticado, execute na pasta do projeto. Escolha um nome de repositório ainda disponível:

```sh
git add .
git commit -m "Projeto de estoque e vendas"
gh repo create estoque-facil --public --source=. --remote=origin --push
```

Se já existir um repositório remoto configurado, use `git push` para enviá-lo e não execute novamente o comando de criação.

## Vídeo

O arquivo `roteiro.md` é um guia para a gravação. Ele não substitui o vídeo exigido na atividade. Grave a demonstração e confira o acesso ao link antes de enviar.
