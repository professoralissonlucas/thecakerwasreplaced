// Topo: nome do jogo, moedas e ticks.

import type { Store } from '../store.ts';
import { el, repetirAnimacao } from './dom.ts';
import { ICONES, TEXTOS } from './textos.ts';

function criarContador(classe: string, icone: string) {
  const raiz = el('div', `contador ${classe}`);
  const iconeEl = el('span', 'contador-icone', icone);
  iconeEl.setAttribute('aria-hidden', 'true');
  const numero = el('span', 'contador-numero');
  const unidade = el('span', 'contador-unidade');
  raiz.append(iconeEl, numero, unidade);
  return { raiz, numero, unidade };
}

export function montarTopo(alvo: HTMLElement, store: Store): void {
  const marca = el('h1', 'marca');
  const mascote = el('span', 'marca-mascote chef', ICONES.robo);
  mascote.setAttribute('aria-hidden', 'true');
  marca.append(mascote, el('span', 'marca-nome', TEXTOS.titulo));

  const moedas = criarContador('contador-moedas', ICONES.moeda);
  const ticks = criarContador('contador-ticks', ICONES.ticks);
  const contadores = el('div', 'contadores');
  contadores.append(moedas.raiz, ticks.raiz);
  alvo.replaceChildren(marca, contadores);

  let saldoAnterior: number | null = null;
  const desenhar = () => {
    const { jogo } = store.obter();
    const saldo = jogo.moedas;
    const tempo = jogo.estatisticas.ticksTotais;
    moedas.numero.textContent = String(saldo);
    moedas.unidade.textContent = TEXTOS.topo.moedas(saldo);
    moedas.raiz.setAttribute('aria-label', TEXTOS.topo.rotuloMoedas(saldo));
    ticks.numero.textContent = String(tempo);
    ticks.unidade.textContent = TEXTOS.topo.ticks(tempo);
    ticks.raiz.setAttribute('aria-label', TEXTOS.topo.rotuloTicks(tempo));
    if (saldoAnterior !== null && saldo > saldoAnterior) repetirAnimacao(moedas.raiz, 'subiu');
    if (saldoAnterior !== null && saldo < saldoAnterior) repetirAnimacao(moedas.raiz, 'desceu');
    saldoAnterior = saldo;
  };
  desenhar();
  store.subscribe(desenhar);
}
