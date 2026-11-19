// Livro de Receitas: o que está liberado, compra de unlocks e estado inicial do jogo (SPEC §4.1, §4.4).

import type { Dados, Efeito, Unlock } from './dados.ts';
import {
  clonarJogo,
  criarCozinha,
  crescerCozinha,
  type Estatisticas,
  type Evento,
  type Jogo,
  type MotivoFalhaCompra,
  type Resultado,
} from './estado.ts';

export function unlockPorId(dados: Dados, id: string): Unlock | undefined {
  return dados.unlocks.find((u) => u.id === id);
}

/** Unlocks em vigor: os iniciais + os comprados, na ordem dos dados. */
export function unlocksAtivos(jogo: Jogo, dados: Dados): Unlock[] {
  const comprados = new Set(jogo.unlocks);
  return dados.unlocks.filter((u) => u.inicial || comprados.has(u.id));
}

export function unlockAtivo(jogo: Jogo, dados: Dados, id: string): boolean {
  return unlocksAtivos(jogo, dados).some((u) => u.id === id);
}

function efeitosAtivos<T extends Efeito['tipo']>(jogo: Jogo, dados: Dados, tipo: T) {
  return unlocksAtivos(jogo, dados)
    .flatMap((u) => u.efeitos)
    .filter((e): e is Extract<Efeito, { tipo: T }> => e.tipo === tipo);
}

/** Comandos e constantes do jogo que existem no ambiente do script (ex.: "mover", "Norte"). */
export function comandosLiberados(jogo: Jogo, dados: Dados): Set<string> {
  return new Set(efeitosAtivos(jogo, dados, 'comandos').flatMap((e) => e.nomes));
}

/** Nós da AST liberados para o verificador (runner/gate.ts). */
export function sintaxeLiberada(jogo: Jogo, dados: Dados): Set<string> {
  return new Set(efeitosAtivos(jogo, dados, 'sintaxe').flatMap((e) => e.nos));
}

/** Funções embutidas do Python liberadas (ex.: "print", "range"). */
export function embutidasLiberadas(jogo: Jogo, dados: Dados): Set<string> {
  return new Set(efeitosAtivos(jogo, dados, 'embutidas').flatMap((e) => e.nomes));
}

export function produtosLiberados(jogo: Jogo, dados: Dados): Set<string> {
  return new Set(efeitosAtivos(jogo, dados, 'produto').map((e) => e.id));
}

export function modosLiberados(jogo: Jogo, dados: Dados): Set<string> {
  return new Set(efeitosAtivos(jogo, dados, 'modo').map((e) => e.id));
}

/** Tamanho da cozinha dado pelos unlocks ativos (a maior largura e a maior altura). */
export function dimensoesCozinha(jogo: Pick<Jogo, 'unlocks'>, dados: Dados): { largura: number; altura: number } {
  const comprados = new Set(jogo.unlocks);
  const cozinhas = dados.unlocks
    .filter((u) => u.inicial || comprados.has(u.id))
    .flatMap((u) => u.efeitos)
    .filter((e): e is Extract<Efeito, { tipo: 'cozinha' }> => e.tipo === 'cozinha');
  return {
    largura: Math.max(1, ...cozinhas.map((e) => e.largura)),
    altura: Math.max(1, ...cozinhas.map((e) => e.altura)),
  };
}

/** Lê uma estatística pela chave com ponto ("produzidos.biscoito", "ticksTotais"). Ausente = 0. */
export function valorEstatistica(estatisticas: Estatisticas, chave: string): number {
  let atual: unknown = estatisticas;
  for (const parte of chave.split('.')) {
    if (typeof atual !== 'object' || atual === null) return 0;
    atual = (atual as Record<string, unknown>)[parte];
  }
  return typeof atual === 'number' ? atual : 0;
}

export function requisitosCumpridos(jogo: Jogo, dados: Dados, unlock: Unlock): boolean {
  const ativos = new Set(unlocksAtivos(jogo, dados).map((u) => u.id));
  const porUnlock = (unlock.requisitos.unlocks ?? []).every((id) => ativos.has(id));
  const porEstatistica = Object.entries(unlock.requisitos.estatisticas ?? {}).every(
    ([chave, minimo]) => valorEstatistica(jogo.estatisticas, chave) >= minimo,
  );
  return porUnlock && porEstatistica;
}

export function podeComprarUnlock(
  jogo: Jogo,
  dados: Dados,
  id: string,
): { ok: true } | { ok: false; motivo: MotivoFalhaCompra } {
  const unlock = unlockPorId(dados, id);
  if (!unlock) return { ok: false, motivo: 'desconhecido' };
  if (unlockAtivo(jogo, dados, id)) return { ok: false, motivo: 'jaComprado' };
  if (!requisitosCumpridos(jogo, dados, unlock)) return { ok: false, motivo: 'requisitos' };
  if (jogo.moedas < unlock.custo) return { ok: false, motivo: 'semMoedas' };
  return { ok: true };
}

/** Compra um unlock. Não gasta ticks. Se a cozinha crescer, os fornos e o robô ficam onde estão. */
export function comprarUnlock(jogo: Jogo, dados: Dados, id: string): Resultado<boolean> {
  const pode = podeComprarUnlock(jogo, dados, id);
  if (!pode.ok) {
    return { jogo, eventos: [{ tipo: 'compraFalhou', id, motivo: pode.motivo }], retorno: false };
  }
  const unlock = unlockPorId(dados, id)!;
  const novo = clonarJogo(jogo);
  novo.moedas -= unlock.custo;
  novo.unlocks.push(id);
  const eventos: Evento[] = [{ tipo: 'comprouUnlock', id, custo: unlock.custo }];

  const { largura, altura } = dimensoesCozinha(novo, dados);
  if (largura > novo.cozinha.largura || altura > novo.cozinha.altura) {
    novo.cozinha = crescerCozinha(novo.cozinha, largura, altura);
    eventos.push({ tipo: 'cozinhaCresceu', largura: novo.cozinha.largura, altura: novo.cozinha.altura });
  }
  return { jogo: novo, eventos, retorno: true };
}

/** Os ids pedidos mais todos os requisitos deles, em cadeia (ex.: "bolo" traz receitas, memoria, …). */
export function fecharRequisitos(dados: Dados, ids: string[]): string[] {
  const resultado = new Set<string>();
  const pendentes = [...ids];
  while (pendentes.length > 0) {
    const id = pendentes.pop()!;
    if (resultado.has(id)) continue;
    const unlock = unlockPorId(dados, id);
    if (!unlock) throw new Error(`Unlock desconhecido: "${id}"`);
    if (!unlock.inicial) resultado.add(id);
    pendentes.push(...(unlock.requisitos.unlocks ?? []));
  }
  return dados.unlocks.filter((u) => resultado.has(u.id)).map((u) => u.id);
}

export interface OpcoesNovoJogo {
  moedas?: number;
  unlocks?: string[];
  melhorias?: Record<string, number>;
  estatisticas?: Estatisticas;
}

/** Jogo com a cozinha do tamanho dado pelos unlocks, toda vazia, e o robô em (0,0) (SPEC §2.1). */
export function criarJogo(dados: Dados, opcoes: OpcoesNovoJogo = {}): Jogo {
  const unlocks = [...(opcoes.unlocks ?? [])];
  const { largura, altura } = dimensoesCozinha({ unlocks }, dados);
  return {
    moedas: opcoes.moedas ?? 0,
    unlocks,
    melhorias: { ...(opcoes.melhorias ?? {}) },
    estatisticas: {
      produzidos: { ...(opcoes.estatisticas?.produzidos ?? {}) },
      ticksTotais: opcoes.estatisticas?.ticksTotais ?? 0,
    },
    cozinha: criarCozinha(largura, altura),
    robo: { x: 0, y: 0 },
  };
}
