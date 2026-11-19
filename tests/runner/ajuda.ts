// Roda Python de verdade (Skulpt) no Node, contra um store real.
import skulptMin from '../../public/vendor/skulpt/skulpt.min.js?raw';
import skulptStdlib from '../../public/vendor/skulpt/skulpt-stdlib.js?raw';
import { criarJogo, dadosPadrao, fecharRequisitos, type Evento } from '../../src/engine/index.ts';
import { executar, type FimExecucao, type OpcoesExecucao } from '../../src/runner/execucao.ts';
import { skulptGlobal, type Skulpt } from '../../src/runner/sk.ts';
import { criarStore, type Store } from '../../src/store.ts';

/** Carrega o mesmo Skulpt vendorizado que o navegador usa (uma vez por arquivo de teste). */
export function skulptNoNode(): Skulpt {
  if (!skulptGlobal()) {
    (0, eval)(skulptMin);
    (0, eval)(skulptStdlib);
  }
  return skulptGlobal()!;
}

export interface Cenario {
  unlocks?: string[];
  moedas?: number;
  melhorias?: Record<string, number>;
  msPorTick?: number;
  store?: Store;
}

export interface Rodada {
  store: Store;
  escritos: string[];
  linhas: (number | null)[];
  eventos: Evento[];
  parar(): void;
  fim: Promise<FimExecucao>;
}

export function criarStoreDeTeste(cenario: Cenario = {}): Store {
  return criarStore({
    jogo: criarJogo(dadosPadrao, {
      moedas: cenario.moedas ?? 0,
      unlocks: fecharRequisitos(dadosPadrao, cenario.unlocks ?? []),
      melhorias: cenario.melhorias ?? {},
    }),
    config: { msPorTick: cenario.msPorTick ?? 0 },
  });
}

export function rodar(codigo: string, cenario: Cenario = {}, opcoes: OpcoesExecucao = {}): Rodada {
  const sk = skulptNoNode();
  const store = cenario.store ?? criarStoreDeTeste(cenario);
  const escritos: string[] = [];
  const linhas: (number | null)[] = [];
  const eventos: Evento[] = [];
  store.subscribe((_, novos) => eventos.push(...novos));
  const execucao = executar(sk, store, codigo, {
    aoEscrever: (texto) => escritos.push(texto),
    aoMudarLinha: (linha) => linhas.push(linha),
    ...opcoes,
  });
  return { store, escritos, linhas, eventos, parar: execucao.parar, fim: execucao.fim };
}

export const esperarMs = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
