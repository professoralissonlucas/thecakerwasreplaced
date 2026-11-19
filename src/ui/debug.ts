// TEMPORÁRIO (fase 2): botões que chamam o engine direto para testar a grade na mão.
// Na fase 3 este painel sai e o editor de código entra no lugar dele.
// Os truques (moedas grátis, liberar de graça) só existem aqui, nunca no engine.

import {
  comprarMelhoria,
  comprarUnlock,
  criarJogo,
  custoMelhoria,
  melhoriaPorId,
  nivelMelhoria,
  unlockAtivo,
  type Direcao,
  type Unlock,
} from '../engine/index.ts';
import type { Store } from '../store.ts';
import type { Lousa } from './console.ts';
import { el } from './dom.ts';
import { ICONES, TEXTOS } from './textos.ts';

const MOEDAS_DE_TESTE = 100;
const ESPERA_LONGA = 10;
const SETAS: Record<string, Direcao> = { ArrowUp: 'Norte', ArrowDown: 'Sul', ArrowRight: 'Leste', ArrowLeft: 'Oeste' };

const T = TEXTOS.debug;

function botao(texto: string, aoClicar: () => void, classe = 'botao'): HTMLButtonElement {
  const b = el('button', classe, texto);
  b.type = 'button';
  b.addEventListener('click', aoClicar);
  return b;
}

function grupo(titulo: string, ...conteudo: HTMLElement[]): HTMLFieldSetElement {
  const caixa = el('fieldset', 'grupo');
  caixa.append(el('legend', 'grupo-titulo', titulo), ...conteudo);
  return caixa;
}

export function montarDebug(alvo: HTMLElement, store: Store, lousa: Lousa): void {
  const { dados } = store;
  const despachar = store.despachar;

  // Robô: as ações que vão virar comandos do Python.
  const acoes = el('div', 'botoes');
  for (const produto of dados.produtos) {
    acoes.append(botao(T.assar(produto.nome), () => despachar({ tipo: 'assar', produto: produto.id })));
  }
  acoes.append(
    botao(T.retirar, () => despachar({ tipo: 'retirar' })),
    botao(T.esperar, () => despachar({ tipo: 'esperar' })),
    botao(T.esperarVarios(ESPERA_LONGA), () => {
      for (let i = 0; i < ESPERA_LONGA; i++) despachar({ tipo: 'esperar' });
    }),
  );

  // Andar: cruzeta com as quatro direções.
  const cruzeta = el('div', 'cruzeta');
  for (const direcao of ['Norte', 'Oeste', 'Leste', 'Sul'] as const) {
    const b = botao('', () => despachar({ tipo: 'mover', direcao }), `botao botao-direcao direcao-${direcao.toLowerCase()}`);
    const seta = el('span', 'botao-seta', ICONES.setas[direcao]);
    seta.setAttribute('aria-hidden', 'true');
    b.append(seta, el('span', 'botao-direcao-nome', T.direcoes[direcao]));
    cruzeta.append(b);
  }
  const centro = el('span', 'cruzeta-centro chef', ICONES.robo);
  centro.setAttribute('aria-hidden', 'true');
  cruzeta.append(centro);
  const dica = el('p', 'grupo-dica', T.dicaSetas);

  // Truques: atalhos que não existem no jogo de verdade.
  const liberar = botao('', liberarProximo, 'botao botao-secundario');
  const truques = el('div', 'botoes');
  truques.append(
    botao(T.darMoedas(MOEDAS_DE_TESTE), darMoedas, 'botao botao-secundario'),
    liberar,
    ...dados.melhorias.map((m) => botao(T.melhoria(m.nome), () => melhoriaGratis(m.id), 'botao botao-secundario')),
    botao(T.recomecar, recomecar, 'botao botao-secundario'),
  );

  // O alvo é um <details>: fica recolhido até o jogador abrir.
  const grupos = [grupo(T.grupoRobo, acoes), grupo(T.grupoAndar, cruzeta, dica), grupo(T.grupoTruques, truques)];
  alvo.replaceChildren(el('summary', 'debug-titulo', T.titulo), el('p', 'painel-nota', T.nota), ...grupos);

  function proximoUnlock(): Unlock | undefined {
    const { jogo } = store.obter();
    return dados.unlocks.find((u) => !unlockAtivo(jogo, dados, u.id));
  }

  function darMoedas(): void {
    const { jogo } = store.obter();
    store.trocarJogo({ ...jogo, moedas: jogo.moedas + MOEDAS_DE_TESTE });
    lousa.escrever({ tipo: 'info', texto: T.ganhouMoedas(MOEDAS_DE_TESTE) });
  }

  /** Compra o próximo unlock pelas regras do engine, mas cobrindo o custo e os requisitos de estatística. */
  function liberarProximo(): void {
    const proximo = proximoUnlock();
    if (!proximo) return;
    const { jogo } = store.obter();
    const produzidos = { ...jogo.estatisticas.produzidos };
    for (const [chave, minimo] of Object.entries(proximo.requisitos.estatisticas ?? {})) {
      const [raiz, produto] = chave.split('.');
      if (raiz === 'produzidos' && produto) produzidos[produto] = Math.max(produzidos[produto] ?? 0, minimo);
    }
    const preparado = { ...jogo, moedas: proximo.custo, estatisticas: { ...jogo.estatisticas, produzidos } };
    const r = comprarUnlock(preparado, dados, proximo.id);
    store.trocarJogo(r.retorno ? { ...r.jogo, moedas: jogo.moedas, estatisticas: jogo.estatisticas } : jogo, r.eventos);
  }

  function melhoriaGratis(id: string): void {
    const { jogo } = store.obter();
    const melhoria = melhoriaPorId(dados, id);
    if (!melhoria) return;
    const custo = custoMelhoria(melhoria, nivelMelhoria(jogo, id));
    const r = comprarMelhoria({ ...jogo, moedas: custo }, dados, id);
    store.trocarJogo(r.retorno ? { ...r.jogo, moedas: jogo.moedas } : jogo, r.eventos);
  }

  function recomecar(): void {
    store.trocarJogo(criarJogo(dados));
    lousa.apagar();
    lousa.escrever({ tipo: 'info', texto: T.recomecou });
  }

  const atualizar = () => {
    const proximo = proximoUnlock();
    liberar.textContent = proximo ? T.liberarProximo(proximo.nome) : T.tudoLiberado;
    liberar.disabled = !proximo;
    // Com um script rodando, só o script mexe no jogo.
    const rodando = store.obter().execucao.rodando;
    for (const g of grupos) g.disabled = rodando;
  };
  atualizar();
  store.subscribe(atualizar);

  document.addEventListener('keydown', (evento) => {
    const direcao = SETAS[evento.key];
    if (!direcao || evento.altKey || evento.ctrlKey || evento.metaKey) return;
    if (store.obter().execucao.rodando) return;
    const alvoTecla = evento.target as HTMLElement | null;
    if (alvoTecla?.closest('input, textarea, select, [contenteditable]')) return;
    evento.preventDefault();
    despachar({ tipo: 'mover', direcao });
  });
}
