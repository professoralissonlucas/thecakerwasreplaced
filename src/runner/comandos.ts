// Os comandos do jogo como funções embutidas do Python (SPEC §3).
// Ações que gastam ticks passam por `ctx.agir`, que pode devolver uma suspensão (o Python fica
// parado até a animação acabar). Sensores e dizer passam por `ctx.consultar` (0 ticks).

import {
  TICKS_POR_ACAO,
  ehDirecao,
  estadoAtual,
  estaPronto,
  produtoAtual,
  tamanho,
  type Acao,
  type Dados,
  type Jogo,
} from '../engine/index.ts';
import { TEXTOS } from '../ui/textos.ts';
import type { PyExcecao, PyObjeto, Skulpt } from './sk.ts';

export interface ContextoComandos {
  sk: Skulpt;
  dados: Dados;
  jogo(): Jogo;
  /** Aplica uma ação que gasta ticks e devolve o valor Python, ou uma suspensão que espera a animação. */
  agir(acao: Acao, ticks: number, paraPython: (retorno: boolean | void) => PyObjeto): PyObjeto;
  /** Leitura de 0 tick (sensores, dizer): conta para a proteção contra robô parado. */
  consultar<T>(ler: () => T): T;
  escrever(texto: string): void;
  ticksDaExecucao(): number;
}

export const DIRECOES = ['Norte', 'Sul', 'Leste', 'Oeste'] as const;

/** Marca uma exceção Python cuja mensagem já está em português para o jogador. */
export function marcarAmigavel(erro: PyExcecao): PyExcecao {
  (erro as PyExcecao & { $amigavel?: boolean }).$amigavel = true;
  return erro;
}

export function ehAmigavel(erro: PyExcecao): boolean {
  return (erro as PyExcecao & { $amigavel?: boolean }).$amigavel === true;
}

/** Todos os comandos e constantes do jogo, liberados ou não. Quem registra só os liberados é a execução. */
export function criarComandos(ctx: ContextoComandos): Record<string, PyObjeto> {
  const { sk } = ctx;
  const E = TEXTOS.erros;
  const nada = sk.builtin.none.none$;
  const bool = (valor: boolean | void) => (valor === true ? sk.builtin.bool.true$ : sk.builtin.bool.false$);
  const texto = (valor: string) => new sk.builtin.str(valor);
  const inteiro = (valor: number) => new sk.builtin.int_(valor);
  const funcao = (fn: (...args: PyObjeto[]) => PyObjeto) => new sk.builtin.func(fn);
  const erroTipo = (mensagem: string) => marcarAmigavel(new sk.builtin.TypeError(mensagem));

  function semArgumentos(nome: string, args: PyObjeto[]): void {
    if (args.length !== 0) throw erroTipo(E.semArgumentos(nome));
  }
  function umArgumento(nome: string, args: PyObjeto[], exemplo: string): PyObjeto {
    if (args.length !== 1) throw erroTipo(E.umArgumento(nome, exemplo));
    return args[0]!;
  }
  function textoDe(nome: string, valor: PyObjeto, exemplo: string): string {
    if (!(valor instanceof sk.builtin.str)) throw erroTipo(E.texto(nome, exemplo));
    return valor.v;
  }
  const sensor = (nome: string, ler: () => PyObjeto) =>
    funcao((...args) => {
      semArgumentos(nome, args);
      return ctx.consultar(ler);
    });

  const comandos: Record<string, PyObjeto> = {
    assar: funcao((...args) => {
      const produto = textoDe('assar', umArgumento('assar', args, '"pao"'), '"pao"');
      return ctx.agir({ tipo: 'assar', produto }, TICKS_POR_ACAO.assar, bool);
    }),
    retirar: funcao((...args) => {
      semArgumentos('retirar', args);
      return ctx.agir({ tipo: 'retirar' }, TICKS_POR_ACAO.retirar, bool);
    }),
    esperar: funcao((...args) => {
      semArgumentos('esperar', args);
      return ctx.agir({ tipo: 'esperar' }, TICKS_POR_ACAO.esperar, () => nada);
    }),
    mover: funcao((...args) => {
      const valor = umArgumento('mover', args, 'Norte');
      const direcao = valor instanceof sk.builtin.str ? valor.v : null;
      if (!ehDirecao(direcao)) throw erroTipo(E.direcao);
      return ctx.agir({ tipo: 'mover', direcao }, TICKS_POR_ACAO.mover, () => nada);
    }),
    dizer: funcao((...args) => {
      const valor = umArgumento('dizer', args, '"oi"');
      ctx.consultar(() => ctx.escrever(new sk.builtin.str(valor).v));
      return nada;
    }),
    esta_pronto: sensor('esta_pronto', () => bool(estaPronto(ctx.jogo(), ctx.dados))),
    estado: sensor('estado', () => texto(estadoAtual(ctx.jogo(), ctx.dados))),
    produto: sensor('produto', () => {
      const atual = produtoAtual(ctx.jogo());
      return atual === null ? nada : texto(atual);
    }),
    pos_x: sensor('pos_x', () => inteiro(ctx.jogo().robo.x)),
    pos_y: sensor('pos_y', () => inteiro(ctx.jogo().robo.y)),
    tamanho: sensor('tamanho', () => inteiro(tamanho(ctx.jogo()))),
    moedas: sensor('moedas', () => inteiro(ctx.jogo().moedas)),
    ticks: sensor('ticks', () => inteiro(ctx.ticksDaExecucao())),
  };
  for (const direcao of DIRECOES) comandos[direcao] = texto(direcao);
  return comandos;
}
