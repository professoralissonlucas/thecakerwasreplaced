// Tipos do estado do jogo e helpers estruturais da cozinha.
// Regra do projeto: o engine não conhece DOM, Skulpt nem Firebase, e não tem
// texto para o jogador (só códigos nos eventos; a UI traduz).

export type Direcao = 'Norte' | 'Sul' | 'Leste' | 'Oeste';

export type EstadoForno = 'vazio' | 'assando' | 'pronto' | 'queimado';

export interface Posicao {
  x: number;
  y: number;
}

/** Forno com produto. Forno vazio é `null`. O estado é derivado do progresso (SPEC §2.2). */
export interface Forno {
  produto: string;
  progresso: number;
}

export interface Cozinha {
  largura: number;
  altura: number;
  /** `fornos[y][x]`; x cresce para Leste, y cresce para Norte, (0,0) no canto inferior esquerdo. */
  fornos: (Forno | null)[][];
}

export type Robo = Posicao;

export interface Estatisticas {
  /** Só conta produtos vendidos, por id de produto. */
  produzidos: Record<string, number>;
  ticksTotais: number;
}

export interface Jogo {
  moedas: number;
  /** Ids dos unlocks comprados (o unlock inicial não entra aqui). */
  unlocks: string[];
  /** Nível atual de cada melhoria; ausente = nível 0. */
  melhorias: Record<string, number>;
  estatisticas: Estatisticas;
  cozinha: Cozinha;
  robo: Robo;
}

export type MotivoFalhaAssar = 'produtoDesconhecido' | 'produtoTrancado' | 'fornoOcupado' | 'semMoedas';

export type MotivoFalhaCompra =
  | 'desconhecido'
  | 'jaComprado'
  | 'requisitos'
  | 'semMoedas'
  | 'naoDisponivel'
  | 'nivelMaximo';

export type Evento =
  | { tipo: 'assou'; produto: string; custo: number; x: number; y: number }
  | { tipo: 'falhou'; acao: 'assar'; motivo: MotivoFalhaAssar; produto: string; x: number; y: number }
  | { tipo: 'vendeu'; produto: string; valor: number; x: number; y: number }
  | { tipo: 'retirouCru'; produto: string; x: number; y: number }
  | { tipo: 'retirouQueimado'; produto: string; x: number; y: number }
  | { tipo: 'retirouVazio'; x: number; y: number }
  | { tipo: 'moveu'; direcao: Direcao; de: Posicao; para: Posicao; deuVolta: boolean }
  | { tipo: 'ficouPronto'; produto: string; x: number; y: number }
  | { tipo: 'queimou'; produto: string; x: number; y: number }
  | { tipo: 'tempoPassou'; ticks: number; ticksTotais: number }
  | { tipo: 'comprouUnlock'; id: string; custo: number }
  | { tipo: 'cozinhaCresceu'; largura: number; altura: number }
  | { tipo: 'comprouMelhoria'; id: string; nivel: number; custo: number }
  | { tipo: 'compraFalhou'; id: string; motivo: MotivoFalhaCompra };

/** O que toda função do engine devolve: estado novo (a entrada nunca é alterada) + eventos. */
export interface Resultado<T = void> {
  jogo: Jogo;
  eventos: Evento[];
  retorno: T;
}

export function criarCozinha(largura: number, altura: number): Cozinha {
  const fornos = Array.from({ length: altura }, () => Array.from({ length: largura }, () => null));
  return { largura, altura, fornos };
}

/** Cozinha maior com os fornos antigos na mesma posição e no mesmo estado; os novos começam vazios. */
export function crescerCozinha(cozinha: Cozinha, largura: number, altura: number): Cozinha {
  const nova = criarCozinha(Math.max(largura, cozinha.largura), Math.max(altura, cozinha.altura));
  for (let y = 0; y < cozinha.altura; y++) {
    for (let x = 0; x < cozinha.largura; x++) {
      const forno = fornoEm(cozinha, x, y);
      nova.fornos[y]![x] = forno && { ...forno };
    }
  }
  return nova;
}

export function fornoEm(cozinha: Cozinha, x: number, y: number): Forno | null {
  const forno = cozinha.fornos[y]?.[x];
  if (forno === undefined) throw new Error(`Posição fora da cozinha: (${x}, ${y})`);
  return forno;
}

export function colocarForno(cozinha: Cozinha, x: number, y: number, forno: Forno | null): void {
  fornoEm(cozinha, x, y);
  cozinha.fornos[y]![x] = forno;
}

/** Cópia profunda. As funções do engine copiam antes de mexer, então a entrada nunca muda. */
export function clonarJogo(jogo: Jogo): Jogo {
  return {
    moedas: jogo.moedas,
    unlocks: [...jogo.unlocks],
    melhorias: { ...jogo.melhorias },
    estatisticas: {
      produzidos: { ...jogo.estatisticas.produzidos },
      ticksTotais: jogo.estatisticas.ticksTotais,
    },
    cozinha: {
      largura: jogo.cozinha.largura,
      altura: jogo.cozinha.altura,
      fornos: jogo.cozinha.fornos.map((linha) => linha.map((forno) => forno && { ...forno })),
    },
    robo: { ...jogo.robo },
  };
}
