import { describe, expect, it } from 'vitest';
import {
  assar,
  comprarMelhoria,
  criarJogo,
  custoMelhoria,
  estadoAtual,
  podeComprarMelhoria,
  retirar,
  tempoEfetivo,
  toleranciaEfetiva,
  vendaEfetiva,
  type Dados,
  type Melhoria,
  type Produto,
} from '../../src/engine/index.ts';
import { dados as dadosDoJogo, esperarVezes, jogoCom, produto } from './ajuda.ts';

// As fórmulas do §4.2 são testadas com os valores do SPEC fixos aqui, para o teste não depender
// do balanceamento atual em src/data/.
const MELHORIAS_SPEC: Melhoria[] = [
  { id: 'forno_turbo', nome: '', descricao: '', custoInicial: 50, fatorCusto: 1.6, maximo: 5, apareceApos: 'repeticao', efeito: { tipo: 'tempoMult', valor: 0.9 } },
  { id: 'receita_premium', nome: '', descricao: '', custoInicial: 100, fatorCusto: 1.6, maximo: 5, apareceApos: 'cozinha_3x1', efeito: { tipo: 'vendaSoma', valor: 1 } },
  { id: 'forno_isolado', nome: '', descricao: '', custoInicial: 120, fatorCusto: 1.6, maximo: 3, apareceApos: 'biscoito', efeito: { tipo: 'toleranciaSoma', valor: 5 } },
];
const dados: Dados = { ...dadosDoJogo, melhorias: MELHORIAS_SPEC };
const [turbo, premium, isolado] = MELHORIAS_SPEC as [Melhoria, Melhoria, Melhoria];

const produtoTeste = (tempo: number, tolerancia: number | null = 80, venda = 6): Produto => ({
  id: 'teste', nome: '', descricao: '', custo: 0, tempo, tolerancia, venda,
});
const comNivel = (melhorias: Record<string, number>) => criarJogo(dados, { melhorias });
const niveis = (maximo: number) => Array.from({ length: maximo + 1 }, (_, n) => n);

describe('custo das melhorias: round(custoInicial × 1,6ⁿ)', () => {
  it('Forno Turbo: 50, 80, 128, 205, 328', () => {
    expect(niveis(4).map((n) => custoMelhoria(turbo, n))).toEqual([50, 80, 128, 205, 328]);
  });
  it('Receita Premium: 100, 160, 256, 410, 655', () => {
    expect(niveis(4).map((n) => custoMelhoria(premium, n))).toEqual([100, 160, 256, 410, 655]);
  });
  it('Forno Isolado: 120, 192, 307', () => {
    expect(niveis(2).map((n) => custoMelhoria(isolado, n))).toEqual([120, 192, 307]);
  });
});

describe('efeitos das melhorias', () => {
  const tempos = (T: number) => niveis(5).map((n) => tempoEfetivo(comNivel({ forno_turbo: n }), dados, produtoTeste(T)));

  it('Forno Turbo: T efetivo = max(1, ceil(T × 0,9ⁿ))', () => {
    expect(tempos(3)).toEqual([3, 3, 3, 3, 2, 2]);
    expect(tempos(15)).toEqual([15, 14, 13, 11, 10, 9]);
    expect(tempos(60)).toEqual([60, 54, 49, 44, 40, 36]);
    expect(tempos(1)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('Forno Turbo não arredonda para cima por erro de ponto flutuante (1000 × 0,9³ = 729)', () => {
    expect(tempoEfetivo(comNivel({ forno_turbo: 3 }), dados, produtoTeste(1000))).toBe(729);
  });

  it('Receita Premium: venda + n, para qualquer produto', () => {
    expect(niveis(5).map((n) => vendaEfetiva(comNivel({ receita_premium: n }), dados, produtoTeste(3, null, 1)))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(vendaEfetiva(comNivel({ receita_premium: 5 }), dados, produtoTeste(60, 80, 40))).toBe(45);
  });

  it('Forno Isolado: L + 5·n; tolerância null continua null', () => {
    expect(niveis(3).map((n) => toleranciaEfetiva(comNivel({ forno_isolado: n }), dados, produtoTeste(15, 80)))).toEqual([80, 85, 90, 95]);
    expect(toleranciaEfetiva(comNivel({ forno_isolado: 3 }), dados, produtoTeste(3, null))).toBeNull();
  });

  it('os efeitos chegam às ações: com Turbo o bolo fica pronto antes; com Premium vende mais caro', () => {
    const bolo = produto('bolo');
    let jogo = jogoCom(['bolo'], { moedas: 1000, melhorias: { forno_turbo: 4, receita_premium: 2 } });
    const T = tempoEfetivo(jogo, dados, bolo);
    expect(T).toBeLessThan(bolo.tempo);
    jogo = esperarVezes(assar(jogo, dados, 'bolo').jogo, T - 2);
    expect(estadoAtual(jogo, dados)).toBe('assando');
    jogo = esperarVezes(jogo, 1);
    expect(estadoAtual(jogo, dados)).toBe('pronto');
    expect(retirar(jogo, dados).jogo.moedas).toBe(1000 - bolo.custo + bolo.venda + 2);
  });
});

describe('comprar melhoria', () => {
  it('só aparece depois do unlock "apareceApos"', () => {
    expect(podeComprarMelhoria(criarJogo(dados, { moedas: 1000 }), dados, 'forno_turbo')).toEqual({ ok: false, motivo: 'naoDisponivel' });
    expect(podeComprarMelhoria(jogoCom(['repeticao'], { moedas: 1000 }), dados, 'forno_turbo')).toEqual({ ok: true, custo: 50 });
  });

  it('desconta o custo do nível, sobe o nível e não gasta ticks', () => {
    const r = comprarMelhoria(jogoCom(['repeticao'], { moedas: 130 }), dados, 'forno_turbo');
    expect(r.retorno).toBe(true);
    expect(r.jogo.melhorias.forno_turbo).toBe(1);
    expect(r.jogo.moedas).toBe(80);
    expect(r.jogo.estatisticas.ticksTotais).toBe(0);
    expect(r.eventos).toEqual([{ tipo: 'comprouMelhoria', id: 'forno_turbo', nivel: 1, custo: 50 }]);
    const r2 = comprarMelhoria(r.jogo, dados, 'forno_turbo');
    expect(r2.jogo.melhorias.forno_turbo).toBe(2);
    expect(r2.jogo.moedas).toBe(0);
  });

  it('recusa sem moedas, no nível máximo ou com id desconhecido', () => {
    expect(podeComprarMelhoria(jogoCom(['repeticao'], { moedas: 49 }), dados, 'forno_turbo')).toEqual({ ok: false, motivo: 'semMoedas' });
    const noMaximo = jogoCom(['biscoito'], { moedas: 10_000, melhorias: { forno_isolado: 3 } });
    expect(podeComprarMelhoria(noMaximo, dados, 'forno_isolado')).toEqual({ ok: false, motivo: 'nivelMaximo' });
    expect(comprarMelhoria(noMaximo, dados, 'forno_isolado').eventos).toEqual([
      { tipo: 'compraFalhou', id: 'forno_isolado', motivo: 'nivelMaximo' },
    ]);
    expect(podeComprarMelhoria(noMaximo, dados, 'rodinhas')).toEqual({ ok: false, motivo: 'desconhecido' });
  });
});
