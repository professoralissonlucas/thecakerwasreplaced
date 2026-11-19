// Roteiros de referência (SPEC §2.6): cada .py desta pasta roda pelo runner de verdade
// (Skulpt no Node), direto no engine e sem animação (msPorTick = 0), até o limite de ticks.
import { dadosPadrao } from '../../src/engine/index.ts';
import { rodar } from '../runner/ajuda.ts';

/**
 * Saldo inicial dos roteiros com produto pago (05–08). O SPEC não define esse valor e, com 0,
 * esses roteiros nunca conseguem assar nada. 240 = 16 bolos, o bastante para encher a 4×4.
 */
export const MOEDAS_INICIAIS_PRODUTO_PAGO = 240;

export interface Roteiro {
  arquivo: string;
  /** Coluna "Unlocks ativos" do §2.6; os requisitos de cada um entram junto. */
  unlocks: string[];
  melhoriasNoMaximo?: boolean;
  moedasIniciais: number;
  /** Orçamento de ticks: o roteiro para quando chega nesse número. */
  ticks: number;
}

export interface ResultadoRoteiro {
  lucro: number;
  vendidos: number;
  crus: number;
  queimados: number;
  perdas: number;
  ticks: number;
}

const CODIGOS = import.meta.glob('./*.py', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const pago = MOEDAS_INICIAIS_PRODUTO_PAGO;
export const ROTEIROS = {
  r01: { arquivo: '01_manual.py', unlocks: [], moedasIniciais: 0, ticks: 4 },
  r02: { arquivo: '02_repeticao.py', unlocks: ['repeticao'], moedasIniciais: 0, ticks: 400 },
  r03: { arquivo: '03_varredura_3x1.py', unlocks: ['cozinha_3x1', 'contagem'], moedasIniciais: 0, ticks: 400 },
  r04: { arquivo: '04_varredura_3x3.py', unlocks: ['cozinha_3x3'], moedasIniciais: 0, ticks: 600 },
  r05: { arquivo: '05_biscoito_3x3.py', unlocks: ['biscoito'], moedasIniciais: pago, ticks: 600 },
  r06: { arquivo: '06_bolo_sem_if.py', unlocks: ['bolo'], moedasIniciais: pago, ticks: 600 },
  r07: { arquivo: '07_bolo_com_if.py', unlocks: ['bolo', 'sensores'], moedasIniciais: pago, ticks: 600 },
  r08: { arquivo: '08_bolo_4x4.py', unlocks: ['cozinha_4x4'], melhoriasNoMaximo: true, moedasIniciais: pago, ticks: 1000 },
} satisfies Record<string, Roteiro>;

export async function rodarRoteiro(roteiro: Roteiro): Promise<ResultadoRoteiro> {
  const codigo = CODIGOS[`./${roteiro.arquivo}`];
  if (codigo === undefined) throw new Error(`Roteiro não encontrado: ${roteiro.arquivo}`);
  const melhorias = roteiro.melhoriasNoMaximo
    ? Object.fromEntries(dadosPadrao.melhorias.map((m) => [m.id, m.maximo]))
    : {};
  const r = rodar(codigo, { unlocks: roteiro.unlocks, moedas: roteiro.moedasIniciais, melhorias }, { limiteTicks: roteiro.ticks });
  const fim = await r.fim;
  if (fim.tipo === 'erro' || fim.tipo === 'roboParado') {
    throw new Error(`${roteiro.arquivo} não rodou até o fim: ${JSON.stringify(fim)}`);
  }
  const contar = (tipo: string) => r.eventos.filter((e) => e.tipo === tipo).length;
  const crus = contar('retirouCru');
  const queimados = contar('retirouQueimado');
  return {
    lucro: r.store.obter().jogo.moedas - roteiro.moedasIniciais,
    vendidos: contar('vendeu'),
    crus,
    queimados,
    perdas: crus + queimados,
    ticks: r.store.obter().jogo.estatisticas.ticksTotais,
  };
}
