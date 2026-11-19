// Execução de um script Python no Skulpt (SPEC §5.1, §5.2).
//
// Cada comando que gasta ticks aplica a ação no engine (via store) e devolve uma suspensão:
// o Python fica parado até a animação de msPorTick × ticks acabar e então continua.
// Três barreiras encerram a execução quando o jogador aperta Parar: o handler de suspensão,
// cada comando antes de agir e o `breakpoints` dos loops (killableWhile/killableFor).

import { comandosLiberados } from '../engine/index.ts';
import type { Store } from '../store.ts';
import { criarComandos, type ContextoComandos } from './comandos.ts';
import { traduzirErro, type ErroAmigavel } from './erros.ts';
import type { PyExcecao, PySuspensao, Skulpt } from './sk.ts';

/** Tempo real máximo sem nenhum tick antes de acusar robô parado (SPEC §5.2). */
export const MS_PARADO_PADRAO = 2000;
/** Chamadas seguidas de sensores/dizer sem tick antes de acusar robô parado (SPEC §5.2). */
export const CONSULTAS_SEM_TICK_PADRAO = 100_000;
/** De quanto em quanto tempo (ms) os loops devolvem o controle ao navegador. */
const YIELD_MS = 100;
const ARQUIVO_INTERNO_PERMITIDO = 'src/builtin/sys.js';
const NOME_DO_SCRIPT = '<script>';

export type FimExecucao =
  | { tipo: 'concluiu' }
  | { tipo: 'parou' }
  | { tipo: 'limiteTicks'; ticks: number }
  | { tipo: 'roboParado' }
  | { tipo: 'erro'; erro: ErroAmigavel };

export interface OpcoesExecucao {
  /** Texto de dizer() e print(), uma linha por chamada. */
  aoEscrever?(texto: string): void;
  /** Linha do script que está rodando agora (null no fim). */
  aoMudarLinha?(linha: number | null): void;
  /** Encerra em silêncio depois de tantos ticks desde o início (usado pelos roteiros). */
  limiteTicks?: number;
  msParado?: number;
  limiteConsultas?: number;
}

export interface Execucao {
  readonly fim: Promise<FimExecucao>;
  parar(): void;
}

/** Parada pedida (botão Parar ou limite de ticks). Encerra sem mensagem de erro. */
class Interrompido extends Error {}
/** O tempo não passa: loop só com sensores, dizer ou pass. */
class RoboParado extends Error {}

const agora = () => performance.now();
const abaEscondida = () => typeof document !== 'undefined' && document.hidden;

let emAndamento = false;

export function haExecucaoEmAndamento(): boolean {
  return emAndamento;
}

/** Linha do frame mais interno do script do jogador (dentro de uma função, é a linha lá dentro). */
function linhaDaSuspensao(suspensao: PySuspensao): number | null {
  let linha: number | null = null;
  for (let s: PySuspensao | undefined = suspensao; s; s = s.child) {
    if (s.$lineno !== undefined && s.$filename?.startsWith(NOME_DO_SCRIPT)) linha = s.$lineno;
  }
  return linha;
}

/** Erro JavaScript lançado dentro de uma função embutida chega embrulhado num ExternalError. */
function desembrulhar(erro: unknown): unknown {
  const nativo = (erro as PyExcecao | null)?.nativeError;
  return nativo instanceof Error ? nativo : erro;
}

export function executar(sk: Skulpt, store: Store, codigo: string, opcoes: OpcoesExecucao = {}): Execucao {
  if (emAndamento) throw new Error('Já existe um script rodando');
  emAndamento = true;

  const msParado = opcoes.msParado ?? MS_PARADO_PADRAO;
  const limiteConsultas = opcoes.limiteConsultas ?? CONSULTAS_SEM_TICK_PADRAO;
  const controle = new AbortController();
  const ticksNoInicio = store.obter().jogo.estatisticas.ticksTotais;
  let pararPedido = false;
  let motivo = 'parou' as 'parou' | 'limiteTicks';
  let ultimoTick = agora();
  let consultasSemTick = 0;
  let restoDoPrint = '';

  const ticksDaExecucao = () => store.obter().jogo.estatisticas.ticksTotais - ticksNoInicio;

  const pedirParada = (porque: typeof motivo) => {
    if (pararPedido) return;
    pararPedido = true;
    motivo = porque;
    controle.abort();
  };
  const verificarParada = () => {
    if (pararPedido) throw new Interrompido();
  };

  /** Espera da animação; termina antes se o jogador apertar Parar. */
  const esperarAnimacao = (ms: number) =>
    new Promise<void>((resolver) => {
      if (controle.signal.aborted) return resolver();
      const terminar = () => {
        clearTimeout(timer);
        controle.signal.removeEventListener('abort', terminar);
        resolver();
      };
      const timer = setTimeout(terminar, ms);
      controle.signal.addEventListener('abort', terminar, { once: true });
    });

  const contarConsulta = () => {
    verificarParada();
    if (++consultasSemTick > limiteConsultas) throw new RoboParado();
  };

  const ctx: ContextoComandos = {
    sk,
    dados: store.dados,
    jogo: () => store.obter().jogo,
    agir(acao, ticks, paraPython) {
      verificarParada();
      const retorno = store.despachar(acao);
      ultimoTick = agora();
      consultasSemTick = 0;
      if (opcoes.limiteTicks !== undefined && ticksDaExecucao() >= opcoes.limiteTicks) pedirParada('limiteTicks');
      const ms = store.obter().config.msPorTick * ticks;
      if (ms <= 0) return paraPython(retorno);
      return sk.misceval.promiseToSuspension(
        esperarAnimacao(ms).then(() => {
          ultimoTick = agora(); // o tempo de animação não conta como "parado"
          return paraPython(retorno);
        }),
      );
    },
    consultar(ler) {
      contarConsulta();
      return ler();
    },
    escrever: (texto) => opcoes.aoEscrever?.(texto),
    ticksDaExecucao,
  };

  // Só os comandos já liberados existem no ambiente (SPEC §3).
  const comandos = criarComandos(ctx);
  const liberados = comandosLiberados(store.obter().jogo, store.dados);
  for (const [nome, objeto] of Object.entries(comandos)) {
    if (liberados.has(nome)) sk.builtins[nome] = objeto;
    else delete sk.builtins[nome];
  }

  sk.configure({
    output(texto: string) {
      restoDoPrint += texto;
      let fim: number;
      while ((fim = restoDoPrint.indexOf('\n')) >= 0) {
        contarConsulta();
        opcoes.aoEscrever?.(restoDoPrint.slice(0, fim));
        restoDoPrint = restoDoPrint.slice(fim + 1);
      }
    },
    read(arquivo: string) {
      // O Skulpt precisa do módulo interno sys; qualquer outro import é recusado.
      const conteudo = arquivo === ARQUIVO_INTERNO_PERMITIDO ? sk.builtinFiles?.files[arquivo] : undefined;
      if (conteudo === undefined) throw new Error(`import recusado: ${arquivo}`);
      return conteudo;
    },
    __future__: sk.python3,
    yieldLimit: YIELD_MS,
    killableWhile: true,
    killableFor: true,
    // Chamado a cada volta de while/for: só suspende (para encerrar) quando a parada foi pedida.
    breakpoints: () => pararPedido,
  });

  const aoSuspender = (suspensao: PySuspensao): undefined => {
    if (pararPedido) throw new Interrompido();
    if (abaEscondida()) ultimoTick = agora(); // aba em segundo plano: o navegador atrasa tudo
    else if (agora() - ultimoTick > msParado) throw new RoboParado();
    if (suspensao.data.type === 'Sk.promise') opcoes.aoMudarLinha?.(linhaDaSuspensao(suspensao));
    return undefined;
  };

  const despejarPrint = () => {
    if (restoDoPrint) opcoes.aoEscrever?.(restoDoPrint);
    restoDoPrint = '';
  };

  const fim = (async (): Promise<FimExecucao> => {
    try {
      await sk.misceval.asyncToPromise(() => sk.importMainWithBody(NOME_DO_SCRIPT, false, codigo, true), { '*': aoSuspender });
      despejarPrint();
      return { tipo: 'concluiu' };
    } catch (erro) {
      despejarPrint();
      const nativo = desembrulhar(erro);
      if (nativo instanceof Interrompido) {
        return motivo === 'limiteTicks' ? { tipo: 'limiteTicks', ticks: ticksDaExecucao() } : { tipo: 'parou' };
      }
      if (nativo instanceof RoboParado) return { tipo: 'roboParado' };
      return { tipo: 'erro', erro: traduzirErro(sk, erro, codigo, store.obter().jogo, store.dados) };
    } finally {
      controle.abort();
      emAndamento = false;
      opcoes.aoMudarLinha?.(null);
    }
  })();

  return { fim, parar: () => pedirParada('parou') };
}
