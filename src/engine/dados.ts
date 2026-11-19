// Tipos e validação dos dados de jogo (src/data/*.json).
// Todo número de balanceamento vive nos JSON; o engine só aplica as regras.

import produtosJson from '../data/produtos.json';
import unlocksJson from '../data/unlocks.json';
import melhoriasJson from '../data/melhorias.json';

export interface Produto {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  /** T: ticks até ficar pronto. */
  tempo: number;
  /** L: ticks que aguenta pronto antes de queimar; `null` = nunca queima. */
  tolerancia: number | null;
  venda: number;
}

export type Efeito =
  | { tipo: 'cozinha'; largura: number; altura: number }
  | { tipo: 'comandos'; nomes: string[] }
  | { tipo: 'sintaxe'; nos: string[] }
  | { tipo: 'embutidas'; nomes: string[] }
  | { tipo: 'produto'; id: string }
  | { tipo: 'modo'; id: string };

export interface Unlock {
  id: string;
  nome: string;
  descricao: string;
  custo: number;
  /** Vem ativo desde o começo (não é comprado). */
  inicial?: boolean;
  requisitos: {
    unlocks?: string[];
    /** Chave com ponto sobre as estatísticas (ex.: "produzidos.biscoito"); regra: valor atual ≥ valor pedido. */
    estatisticas?: Record<string, number>;
  };
  efeitos: Efeito[];
  exemplo: string;
}

export interface Melhoria {
  id: string;
  nome: string;
  descricao: string;
  custoInicial: number;
  /** Custo do nível n+1 = round(custoInicial × fatorCusto^n). */
  fatorCusto: number;
  maximo: number;
  apareceApos: string;
  efeito: { tipo: 'tempoMult' | 'vendaSoma' | 'toleranciaSoma'; valor: number };
}

export interface Dados {
  produtos: Produto[];
  unlocks: Unlock[];
  melhorias: Melhoria[];
}

const TIPOS_EFEITO = ['cozinha', 'comandos', 'sintaxe', 'embutidas', 'produto', 'modo'];
const TIPOS_MELHORIA = ['tempoMult', 'vendaSoma', 'toleranciaSoma'];

const inteiro = (v: unknown, minimo: number) => typeof v === 'number' && Number.isInteger(v) && v >= minimo;

/** Lista de problemas encontrados nos dados (vazia = tudo certo). Mensagens para quem edita os JSON. */
export function validarDados(dados: Dados): string[] {
  const problemas: string[] = [];
  const repetidos = (lista: { id: string }[], nome: string) => {
    const vistos = new Set<string>();
    for (const { id } of lista) {
      if (vistos.has(id)) problemas.push(`${nome}: id repetido "${id}"`);
      vistos.add(id);
    }
    return vistos;
  };
  const idsProdutos = repetidos(dados.produtos, 'produtos');
  const idsUnlocks = repetidos(dados.unlocks, 'unlocks');
  repetidos(dados.melhorias, 'melhorias');

  for (const p of dados.produtos) {
    if (!inteiro(p.custo, 0)) problemas.push(`produto ${p.id}: custo inválido`);
    if (!inteiro(p.tempo, 1)) problemas.push(`produto ${p.id}: tempo inválido`);
    if (p.tolerancia !== null && !inteiro(p.tolerancia, 0)) problemas.push(`produto ${p.id}: tolerância inválida`);
    if (!inteiro(p.venda, 0)) problemas.push(`produto ${p.id}: venda inválida`);
  }

  const iniciais = dados.unlocks.filter((u) => u.inicial);
  if (iniciais.length === 0) problemas.push('unlocks: nenhum unlock inicial');
  if (!iniciais.some((u) => u.efeitos.some((e) => e.tipo === 'cozinha'))) {
    problemas.push('unlocks: o unlock inicial precisa definir a cozinha');
  }

  const liberados = new Set<string>();
  for (const u of dados.unlocks) {
    if (!inteiro(u.custo, 0)) problemas.push(`unlock ${u.id}: custo inválido`);
    for (const r of u.requisitos.unlocks ?? []) {
      if (!idsUnlocks.has(r)) problemas.push(`unlock ${u.id}: requisito desconhecido "${r}"`);
    }
    for (const [chave, valor] of Object.entries(u.requisitos.estatisticas ?? {})) {
      const [raiz, produto, ...resto] = chave.split('.');
      const valida =
        (raiz === 'ticksTotais' && produto === undefined) ||
        (raiz === 'produzidos' && produto !== undefined && idsProdutos.has(produto) && resto.length === 0);
      if (!valida) problemas.push(`unlock ${u.id}: estatística desconhecida "${chave}"`);
      if (!inteiro(valor, 0)) problemas.push(`unlock ${u.id}: valor inválido para "${chave}"`);
    }
    for (const e of u.efeitos) {
      if (!TIPOS_EFEITO.includes(e.tipo)) problemas.push(`unlock ${u.id}: tipo de efeito desconhecido "${e.tipo}"`);
      if (e.tipo === 'cozinha' && (!inteiro(e.largura, 1) || !inteiro(e.altura, 1))) {
        problemas.push(`unlock ${u.id}: tamanho de cozinha inválido`);
      }
      if (e.tipo === 'produto') {
        if (!idsProdutos.has(e.id)) problemas.push(`unlock ${u.id}: produto desconhecido "${e.id}"`);
        liberados.add(e.id);
      }
    }
  }
  for (const id of idsProdutos) {
    if (!liberados.has(id)) problemas.push(`produto ${id}: nenhum unlock libera este produto`);
  }

  // Ciclo nos requisitos deixaria um unlock impossível de comprar.
  const porId = new Map(dados.unlocks.map((u) => [u.id, u]));
  const visitando = new Set<string>();
  const concluidos = new Set<string>();
  const visitar = (id: string): void => {
    if (concluidos.has(id)) return;
    if (visitando.has(id)) {
      problemas.push(`unlocks: ciclo de requisitos passando por "${id}"`);
      return;
    }
    visitando.add(id);
    for (const r of porId.get(id)?.requisitos.unlocks ?? []) visitar(r);
    visitando.delete(id);
    concluidos.add(id);
  };
  for (const id of idsUnlocks) visitar(id);

  for (const m of dados.melhorias) {
    if (!inteiro(m.custoInicial, 1)) problemas.push(`melhoria ${m.id}: custoInicial inválido`);
    if (!(m.fatorCusto >= 1)) problemas.push(`melhoria ${m.id}: fatorCusto inválido`);
    if (!inteiro(m.maximo, 1)) problemas.push(`melhoria ${m.id}: maximo inválido`);
    if (!idsUnlocks.has(m.apareceApos)) problemas.push(`melhoria ${m.id}: apareceApos desconhecido "${m.apareceApos}"`);
    if (!TIPOS_MELHORIA.includes(m.efeito.tipo)) problemas.push(`melhoria ${m.id}: efeito desconhecido "${m.efeito.tipo}"`);
    if (m.efeito.tipo === 'tempoMult' && !(m.efeito.valor > 0 && m.efeito.valor <= 1)) {
      problemas.push(`melhoria ${m.id}: tempoMult precisa estar entre 0 e 1`);
    }
  }
  return problemas;
}

export function carregarDados(bruto: { produtos: unknown; unlocks: unknown; melhorias: unknown }): Dados {
  const dados = bruto as Dados;
  const problemas = validarDados(dados);
  if (problemas.length > 0) throw new Error(`Dados de jogo inválidos:\n- ${problemas.join('\n- ')}`);
  return dados;
}

export const dadosPadrao: Dados = carregarDados({
  produtos: produtosJson,
  unlocks: unlocksJson,
  melhorias: melhoriasJson,
});
