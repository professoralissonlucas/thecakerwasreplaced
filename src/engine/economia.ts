// Valores efetivos dos produtos (com melhorias), estado do forno e compra de melhorias (SPEC §2.2, §2.5, §4.2).

import type { Dados, Melhoria, Produto } from './dados.ts';
import {
  clonarJogo,
  type EstadoForno,
  type Forno,
  type Jogo,
  type MotivoFalhaCompra,
  type Resultado,
} from './estado.ts';
import { unlockAtivo } from './unlocks.ts';

/** Folga para erro de ponto flutuante: 1000 × 0,9³ dá 729,0000000000001 e não pode virar 730. */
const FOLGA = 1e-9;

export function produtoPorId(dados: Dados, id: string): Produto | undefined {
  return dados.produtos.find((p) => p.id === id);
}

function exigirProduto(dados: Dados, id: string): Produto {
  const produto = produtoPorId(dados, id);
  if (!produto) throw new Error(`Produto desconhecido no forno: "${id}"`);
  return produto;
}

export function melhoriaPorId(dados: Dados, id: string): Melhoria | undefined {
  return dados.melhorias.find((m) => m.id === id);
}

export function nivelMelhoria(jogo: Jogo, id: string): number {
  return jogo.melhorias[id] ?? 0;
}

function melhoriasDoTipo(jogo: Jogo, dados: Dados, tipo: Melhoria['efeito']['tipo']) {
  return dados.melhorias
    .filter((m) => m.efeito.tipo === tipo)
    .map((m) => ({ valor: m.efeito.valor, nivel: nivelMelhoria(jogo, m.id) }));
}

/** T efetivo = max(1, ceil(T × valor^n)) para cada melhoria "tempoMult". */
export function tempoEfetivo(jogo: Jogo, dados: Dados, produto: Produto): number {
  let tempo = produto.tempo;
  for (const { valor, nivel } of melhoriasDoTipo(jogo, dados, 'tempoMult')) tempo *= valor ** nivel;
  return Math.max(1, Math.ceil(tempo - FOLGA));
}

/** L efetiva = L + valor·n para cada melhoria "toleranciaSoma"; `null` (nunca queima) continua `null`. */
export function toleranciaEfetiva(jogo: Jogo, dados: Dados, produto: Produto): number | null {
  if (produto.tolerancia === null) return null;
  let tolerancia = produto.tolerancia;
  for (const { valor, nivel } of melhoriasDoTipo(jogo, dados, 'toleranciaSoma')) tolerancia += valor * nivel;
  return tolerancia;
}

/** Venda efetiva = venda + valor·n para cada melhoria "vendaSoma" (vale para todo produto). */
export function vendaEfetiva(jogo: Jogo, dados: Dados, produto: Produto): number {
  let venda = produto.venda;
  for (const { valor, nivel } of melhoriasDoTipo(jogo, dados, 'vendaSoma')) venda += valor * nivel;
  return venda;
}

/** Estado derivado do progresso (SPEC §2.2), sempre com os valores efetivos do momento. */
export function estadoDoForno(jogo: Jogo, dados: Dados, forno: Forno | null): EstadoForno {
  if (!forno) return 'vazio';
  const produto = exigirProduto(dados, forno.produto);
  const tempo = tempoEfetivo(jogo, dados, produto);
  if (forno.progresso < tempo) return 'assando';
  const tolerancia = toleranciaEfetiva(jogo, dados, produto);
  if (tolerancia === null || forno.progresso <= tempo + tolerancia) return 'pronto';
  return 'queimado';
}

/** Custo para passar do nível `nivelAtual` para o seguinte: round(custoInicial × fatorCusto^nivelAtual). */
export function custoMelhoria(melhoria: Melhoria, nivelAtual: number): number {
  return Math.round(melhoria.custoInicial * melhoria.fatorCusto ** nivelAtual);
}

/** A melhoria aparece no Livro depois que o unlock `apareceApos` está ativo. */
export function melhoriaDisponivel(jogo: Jogo, dados: Dados, melhoria: Melhoria): boolean {
  return unlockAtivo(jogo, dados, melhoria.apareceApos);
}

export function podeComprarMelhoria(
  jogo: Jogo,
  dados: Dados,
  id: string,
): { ok: true; custo: number } | { ok: false; motivo: MotivoFalhaCompra } {
  const melhoria = melhoriaPorId(dados, id);
  if (!melhoria) return { ok: false, motivo: 'desconhecido' };
  if (!melhoriaDisponivel(jogo, dados, melhoria)) return { ok: false, motivo: 'naoDisponivel' };
  const nivel = nivelMelhoria(jogo, id);
  if (nivel >= melhoria.maximo) return { ok: false, motivo: 'nivelMaximo' };
  const custo = custoMelhoria(melhoria, nivel);
  if (jogo.moedas < custo) return { ok: false, motivo: 'semMoedas' };
  return { ok: true, custo };
}

/** Sobe um nível da melhoria. Não gasta ticks. */
export function comprarMelhoria(jogo: Jogo, dados: Dados, id: string): Resultado<boolean> {
  const pode = podeComprarMelhoria(jogo, dados, id);
  if (!pode.ok) {
    return { jogo, eventos: [{ tipo: 'compraFalhou', id, motivo: pode.motivo }], retorno: false };
  }
  const novo = clonarJogo(jogo);
  const nivel = nivelMelhoria(novo, id) + 1;
  novo.moedas -= pode.custo;
  novo.melhorias[id] = nivel;
  return { jogo: novo, eventos: [{ tipo: 'comprouMelhoria', id, nivel, custo: pode.custo }], retorno: true };
}
