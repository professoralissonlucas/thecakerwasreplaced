// Store único: guarda o estado, passa as ações para o engine e avisa quem se inscreveu
// com o estado novo + os eventos daquela ação (a UI anima a partir dos eventos).

import { aplicar, criarJogo, dadosPadrao, type Acao, type Dados, type Evento, type Jogo } from './engine/index.ts';

export interface Config {
  /** Duração da animação de um tick. Não muda o resultado do jogo, só a exibição (SPEC §2.4). */
  msPorTick: number;
}

export interface EstadoExecucao {
  /** Um script está rodando (a UI desliga o que não pode mexer no meio). */
  rodando: boolean;
}

export interface EstadoApp {
  jogo: Jogo;
  config: Config;
  execucao: EstadoExecucao;
}

export type Ouvinte = (estado: EstadoApp, eventos: readonly Evento[]) => void;

export const CONFIG_PADRAO: Config = { msPorTick: 200 };

export interface Store {
  readonly dados: Dados;
  obter(): EstadoApp;
  /** Aplica uma ação do engine e devolve o retorno dela (ex.: `assar` → se conseguiu). */
  despachar(acao: Acao): boolean | void;
  /** Troca o jogo inteiro (carregar save, recomeçar, truques de teste). */
  trocarJogo(jogo: Jogo, eventos?: Evento[]): void;
  configurar(config: Partial<Config>): void;
  definirExecucao(execucao: Partial<EstadoExecucao>): void;
  /** Inscreve um ouvinte; devolve a função que cancela a inscrição. */
  subscribe(ouvinte: Ouvinte): () => void;
}

export function criarStore(opcoes: { dados?: Dados; jogo?: Jogo; config?: Partial<Config> } = {}): Store {
  const dados = opcoes.dados ?? dadosPadrao;
  let estado: EstadoApp = {
    jogo: opcoes.jogo ?? criarJogo(dados),
    config: { ...CONFIG_PADRAO, ...opcoes.config },
    execucao: { rodando: false },
  };
  const ouvintes = new Set<Ouvinte>();

  const publicar = (novo: EstadoApp, eventos: readonly Evento[]) => {
    estado = novo;
    for (const ouvinte of [...ouvintes]) ouvinte(estado, eventos);
  };

  return {
    dados,
    obter: () => estado,
    despachar(acao) {
      const r = aplicar(estado.jogo, dados, acao);
      publicar({ ...estado, jogo: r.jogo }, r.eventos);
      return r.retorno;
    },
    trocarJogo(jogo, eventos = []) {
      publicar({ ...estado, jogo }, eventos);
    },
    configurar(config) {
      publicar({ ...estado, config: { ...estado.config, ...config } }, []);
    },
    definirExecucao(execucao) {
      publicar({ ...estado, execucao: { ...estado.execucao, ...execucao } }, []);
    },
    subscribe(ouvinte) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  };
}
