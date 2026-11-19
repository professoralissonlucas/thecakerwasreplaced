# Confeitaria do Robô

Jogo educativo de programação para navegador: o jogador escreve Python simples para controlar um robô confeiteiro numa cozinha em grade.
Cada tarefa automatizada rende moedas, que liberam comandos, recursos do Python, produtos e melhorias no Livro de Receitas.
Site estático no GitHub Pages, 100% jogável sem login; interface e comandos em português (identificadores sem acento).

`SPEC.md` é a fonte da verdade. Escopo atual: MVP (SPEC §10). Login/Firebase só na v1.1.

## Stack
- Vite + TypeScript (vanilla, sem framework de UI)
- CodeMirror 6 (`@codemirror/lang-python`)
- Skulpt 1.2.0: `skulpt.min.js` e `skulpt-stdlib.js` vendorizados em `public/vendor/skulpt/` e commitados (não é dependência npm); versão e hash fixos em `scripts/vendorizar-skulpt.mjs`
- Firebase modular (`app`, `auth`, `firestore`): só na v1.1
- Vitest
- GitHub Actions → GitHub Pages (`actions/deploy-pages`); `base` do Vite = `/thecakerwasreplaced/`

## Estrutura
```
index.html
public/vendor/skulpt/   skulpt.min.js, skulpt-stdlib.js (gerados por scripts/vendorizar-skulpt.mjs)
scripts/                ferramentas de desenvolvimento (Node puro)
src/
  main.ts               monta a app
  store.ts              store único (estado + subscribe)
  data/                 produtos.json, unlocks.json, melhorias.json
  engine/               regras puras: estado (tipos), dados (tipos + validação dos JSON), acoes, tempo, economia, unlocks; index.ts reexporta tudo
  runner/               skulpt (carregar), sk (tipos), comandos (Python → engine → suspensão),
                        execucao (executar/parar, robô parado), erros (tradução); gate na próxima fase
  ui/                   grade, editor (CodeMirror), script (editor + ▶ ⏹ velocidade), console, livro, ajuda,
                        topo, textos.ts, estilos.css; forno.ts e mensagens.ts são puros (testáveis no Node);
                        debug.ts é temporário (sai quando o Livro de Receitas existir)
  persistencia/         save (formato, validação, migrar), local, nuvem
  firebase/config.ts
tests/engine/           testes do engine (SPEC §9.4)
tests/runner/           Python de verdade (Skulpt no Node); ajuda.ts carrega o Skulpt vendorizado
tests/roteiros/         roteiros de referência (SPEC §2.6): arquivos .py rodando pelo runner, sem animação
firestore.rules
.github/workflows/deploy.yml
```

## Comandos
- `npm run dev`: servidor de desenvolvimento (Vite)
- `npm run build`: checagem de tipos (tsc) + build de produção
- `npm test`: testes (Vitest, execução única)
- `npm run vendor:skulpt`: baixa de novo o Skulpt para `public/vendor/skulpt/` (só ao trocar de versão)

## Regras de arquitetura (SPEC §9.3)
- `src/engine/` é puro: nunca importa nem usa DOM, Skulpt ou Firebase. Recebe ações e devolve novo estado + lista de eventos (ex.: `{tipo: "vendeu", produto, valor, x, y}`); a UI anima a partir dos eventos.
- Um único `store` simples (estado + `subscribe`) liga engine, UI e persistência.
- Dados de jogo (produtos, unlocks, melhorias) ficam em `src/data/*.json`. Nada de número de balanceamento no código.
- Os roteiros de referência (`tests/roteiros/`, SPEC §2.6) são o teste de balanceamento: rodam direto no engine, sem animação. Qualquer mudança em `src/data/` precisa manter todos passando.
- Só um script Python roda por vez (o Skulpt é global). Comandos do jogo só existem no ambiente se estiverem liberados (SPEC §3).
- Textos:
  - conteúdo do jogo (nome, descrição e exemplo de unlocks, produtos e melhorias) fica no JSON de `src/data/`;
  - textos da interface (botões, mensagens de erro, avisos, mensagens engraçadas, tutorial) ficam em `src/ui/textos.ts`; nada de string de interface solta em outros arquivos;
  - o engine não tem texto para o jogador: emite eventos com códigos (ex.: `{tipo: "falhou", motivo: "fornoOcupado"}`) e a UI traduz.

## Antes de dizer que terminou
- Sempre rode `npm test` e `npm run build` antes de dizer que terminou.
