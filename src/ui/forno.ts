// O que a grade precisa saber de cada forno para desenhar. Sem DOM, então dá para testar no Node.

import {
  estadoDoForno,
  fornoEm,
  produtoPorId,
  tempoEfetivo,
  toleranciaEfetiva,
  type Dados,
  type EstadoForno,
  type Jogo,
} from '../engine/index.ts';

/** Abaixo desta fração do tempo de tolerância, o forno pronto pisca avisando que vai queimar. */
const LIMITE_ALERTA = 0.25;

export interface LeituraForno {
  estado: EstadoForno;
  produto: string | null;
  /**
   * Quanto a barra mostra, de 0 a 1. Assando: quanto já assou. Pronto: quanto falta para queimar
   * (1 = acabou de ficar pronto). Vazio e queimado: 0.
   */
  fracao: number;
  /** Produto pronto que nunca queima (tolerância `null`). */
  nuncaQueima: boolean;
  /** Pronto e perto de queimar. */
  alerta: boolean;
}

export function lerForno(jogo: Jogo, dados: Dados, x: number, y: number): LeituraForno {
  const forno = fornoEm(jogo.cozinha, x, y);
  const estado = estadoDoForno(jogo, dados, forno);
  const produto = forno ? produtoPorId(dados, forno.produto) : undefined;
  if (!forno || !produto) return { estado, produto: forno?.produto ?? null, fracao: 0, nuncaQueima: false, alerta: false };

  const T = tempoEfetivo(jogo, dados, produto);
  const L = toleranciaEfetiva(jogo, dados, produto);
  if (estado === 'assando') {
    return { estado, produto: produto.id, fracao: forno.progresso / T, nuncaQueima: false, alerta: false };
  }
  if (estado === 'pronto') {
    if (L === null) return { estado, produto: produto.id, fracao: 1, nuncaQueima: true, alerta: false };
    // Pronto vale de T até T+L; no tick T+L+1 queima. Restam (T+L-progresso+1) ticks prontos.
    const fracao = (T + L - forno.progresso + 1) / (L + 1);
    return { estado, produto: produto.id, fracao, nuncaQueima: false, alerta: fracao <= LIMITE_ALERTA };
  }
  return { estado, produto: produto.id, fracao: 0, nuncaQueima: false, alerta: false };
}
