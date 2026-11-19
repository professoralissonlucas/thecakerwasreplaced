// Ações do robô (SPEC §2.4, §2.5, §3). Regra exata: cada ação (1) aplica seu efeito e (2) depois
// o mundo avança o custo dela em ticks. Uma ação que falha também gasta os seus ticks.
// Sensores (esta_pronto, estado, produto, posição, tamanho, moedas) custam 0 ticks e não mudam nada.

import type { Dados, Produto } from './dados.ts';
import {
  clonarJogo,
  colocarForno,
  fornoEm,
  type Direcao,
  type EstadoForno,
  type Evento,
  type Jogo,
  type MotivoFalhaAssar,
  type Resultado,
} from './estado.ts';
import { comprarMelhoria, estadoDoForno, produtoPorId, vendaEfetiva } from './economia.ts';
import { avancarNoRascunho } from './tempo.ts';
import { comprarUnlock, produtosLiberados } from './unlocks.ts';

/** Custo em ticks de cada ação do robô (SPEC §3). */
export const TICKS_POR_ACAO = { assar: 1, retirar: 1, esperar: 1, mover: 1 } as const;

const PASSOS: Record<Direcao, { dx: number; dy: number }> = {
  Norte: { dx: 0, dy: 1 },
  Sul: { dx: 0, dy: -1 },
  Leste: { dx: 1, dy: 0 },
  Oeste: { dx: -1, dy: 0 },
};

export function ehDirecao(valor: unknown): valor is Direcao {
  return typeof valor === 'string' && Object.hasOwn(PASSOS, valor);
}

export function podeAssar(
  jogo: Jogo,
  dados: Dados,
  idProduto: string,
): { ok: true; produto: Produto } | { ok: false; motivo: MotivoFalhaAssar } {
  const produto = produtoPorId(dados, idProduto);
  if (!produto) return { ok: false, motivo: 'produtoDesconhecido' };
  if (!produtosLiberados(jogo, dados).has(produto.id)) return { ok: false, motivo: 'produtoTrancado' };
  if (fornoEm(jogo.cozinha, jogo.robo.x, jogo.robo.y)) return { ok: false, motivo: 'fornoOcupado' };
  if (jogo.moedas < produto.custo) return { ok: false, motivo: 'semMoedas' };
  return { ok: true, produto };
}

/** Coloca massa no forno da posição atual e desconta o custo. Retorna `true` se conseguiu. */
export function assar(jogo: Jogo, dados: Dados, idProduto: string): Resultado<boolean> {
  const novo = clonarJogo(jogo);
  const eventos: Evento[] = [];
  const { x, y } = novo.robo;
  const pode = podeAssar(novo, dados, idProduto);
  if (pode.ok) {
    novo.moedas -= pode.produto.custo;
    colocarForno(novo.cozinha, x, y, { produto: pode.produto.id, progresso: 0 });
    eventos.push({ tipo: 'assou', produto: pode.produto.id, custo: pode.produto.custo, x, y });
  } else {
    eventos.push({ tipo: 'falhou', acao: 'assar', motivo: pode.motivo, produto: idProduto, x, y });
  }
  avancarNoRascunho(novo, dados, TICKS_POR_ACAO.assar, eventos);
  return { jogo: novo, eventos, retorno: pode.ok };
}

/** Retira o que tiver no forno atual; vende se estiver pronto. O estado é lido antes do tick. Retorna `true` só se vendeu. */
export function retirar(jogo: Jogo, dados: Dados): Resultado<boolean> {
  const novo = clonarJogo(jogo);
  const eventos: Evento[] = [];
  const { x, y } = novo.robo;
  const forno = fornoEm(novo.cozinha, x, y);
  const estado = estadoDoForno(novo, dados, forno);
  let vendeu = false;

  if (!forno) {
    eventos.push({ tipo: 'retirouVazio', x, y });
  } else {
    if (estado === 'pronto') {
      const valor = vendaEfetiva(novo, dados, produtoPorId(dados, forno.produto)!);
      novo.moedas += valor;
      novo.estatisticas.produzidos[forno.produto] = (novo.estatisticas.produzidos[forno.produto] ?? 0) + 1;
      eventos.push({ tipo: 'vendeu', produto: forno.produto, valor, x, y });
      vendeu = true;
    } else if (estado === 'assando') {
      eventos.push({ tipo: 'retirouCru', produto: forno.produto, x, y });
    } else {
      eventos.push({ tipo: 'retirouQueimado', produto: forno.produto, x, y });
    }
    colocarForno(novo.cozinha, x, y, null);
  }
  avancarNoRascunho(novo, dados, TICKS_POR_ACAO.retirar, eventos);
  return { jogo: novo, eventos, retorno: vendeu };
}

/** Passa um tick sem fazer nada. */
export function esperar(jogo: Jogo, dados: Dados): Resultado {
  const novo = clonarJogo(jogo);
  const eventos: Evento[] = [];
  avancarNoRascunho(novo, dados, TICKS_POR_ACAO.esperar, eventos);
  return { jogo: novo, eventos, retorno: undefined };
}

/** Move uma célula. As bordas dão a volta (wrap-around). */
export function mover(jogo: Jogo, dados: Dados, direcao: Direcao): Resultado {
  if (!ehDirecao(direcao)) throw new Error(`Direção inválida: ${String(direcao)}`);
  const novo = clonarJogo(jogo);
  const eventos: Evento[] = [];
  const { largura, altura } = novo.cozinha;
  const de = { ...novo.robo };
  const { dx, dy } = PASSOS[direcao];
  const semVolta = { x: de.x + dx, y: de.y + dy };
  const para = { x: (semVolta.x + largura) % largura, y: (semVolta.y + altura) % altura };
  novo.robo = para;
  eventos.push({ tipo: 'moveu', direcao, de, para: { ...para }, deuVolta: semVolta.x !== para.x || semVolta.y !== para.y });
  avancarNoRascunho(novo, dados, TICKS_POR_ACAO.mover, eventos);
  return { jogo: novo, eventos, retorno: undefined };
}

// ---- Sensores e consultas (0 ticks) ----

export function estadoAtual(jogo: Jogo, dados: Dados): EstadoForno {
  return estadoDoForno(jogo, dados, fornoEm(jogo.cozinha, jogo.robo.x, jogo.robo.y));
}

export function estaPronto(jogo: Jogo, dados: Dados): boolean {
  return estadoAtual(jogo, dados) === 'pronto';
}

export function produtoAtual(jogo: Jogo): string | null {
  return fornoEm(jogo.cozinha, jogo.robo.x, jogo.robo.y)?.produto ?? null;
}

/** Largura da cozinha (o lado da grade quando ela é quadrada). */
export function tamanho(jogo: Jogo): number {
  return jogo.cozinha.largura;
}

// ---- Despacho único, para o store ----

export type Acao =
  | { tipo: 'assar'; produto: string }
  | { tipo: 'retirar' }
  | { tipo: 'esperar' }
  | { tipo: 'mover'; direcao: Direcao }
  | { tipo: 'comprarUnlock'; id: string }
  | { tipo: 'comprarMelhoria'; id: string };

export function aplicar(jogo: Jogo, dados: Dados, acao: Acao): Resultado<boolean | void> {
  switch (acao.tipo) {
    case 'assar':
      return assar(jogo, dados, acao.produto);
    case 'retirar':
      return retirar(jogo, dados);
    case 'esperar':
      return esperar(jogo, dados);
    case 'mover':
      return mover(jogo, dados, acao.direcao);
    case 'comprarUnlock':
      return comprarUnlock(jogo, dados, acao.id);
    case 'comprarMelhoria':
      return comprarMelhoria(jogo, dados, acao.id);
  }
}
