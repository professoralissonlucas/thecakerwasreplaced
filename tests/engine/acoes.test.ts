import { describe, expect, it } from 'vitest';
import {
  aplicar,
  assar,
  estadoAtual,
  estaPronto,
  esperar,
  mover,
  produtoAtual,
  retirar,
  tamanho,
  type Direcao,
  type Jogo,
} from '../../src/engine/index.ts';
import { dados, esperarVezes, fornoDoRobo, jogoCom, produto } from './ajuda.ts';

/** Forno do robô em cada estado, com biscoito (que queima). */
function biscoitoEm(estado: 'assando' | 'pronto' | 'queimado'): Jogo {
  const { tempo: T, tolerancia: L } = produto('biscoito');
  const jogo = assar(jogoCom(['biscoito'], { moedas: 100 }), dados, 'biscoito').jogo;
  const ticks = { assando: 0, pronto: T - 1, queimado: T + L! }[estado];
  const final = esperarVezes(jogo, ticks);
  expect(estadoAtual(final, dados)).toBe(estado);
  return final;
}

describe('assar', () => {
  it('em forno vazio coloca a massa, desconta o custo e retorna True', () => {
    const custo = produto('biscoito').custo;
    const r = assar(jogoCom(['biscoito'], { moedas: 10 }), dados, 'biscoito');
    expect(r.retorno).toBe(true);
    expect(r.jogo.moedas).toBe(10 - custo);
    expect(fornoDoRobo(r.jogo)).toEqual({ produto: 'biscoito', progresso: 1 });
    expect(r.eventos[0]).toEqual({ tipo: 'assou', produto: 'biscoito', custo, x: 0, y: 0 });
  });

  for (const estado of ['assando', 'pronto', 'queimado'] as const) {
    it(`em forno ${estado} falha com fornoOcupado, não cobra e não troca o produto`, () => {
      const antes = biscoitoEm(estado);
      const r = assar(antes, dados, 'pao');
      expect(r.retorno).toBe(false);
      expect(r.eventos[0]).toMatchObject({ tipo: 'falhou', motivo: 'fornoOcupado' });
      expect(r.jogo.moedas).toBe(antes.moedas);
      expect(fornoDoRobo(r.jogo)?.produto).toBe('biscoito');
    });
  }

  it('sem moedas suficientes falha com semMoedas', () => {
    const custo = produto('biscoito').custo;
    const r = assar(jogoCom(['biscoito'], { moedas: custo - 1 }), dados, 'biscoito');
    expect(r.retorno).toBe(false);
    expect(r.eventos[0]).toMatchObject({ tipo: 'falhou', motivo: 'semMoedas' });
    expect(r.jogo.moedas).toBe(custo - 1);
    expect(fornoDoRobo(r.jogo)).toBeNull();
  });

  it('produto ainda não liberado falha com produtoTrancado', () => {
    const r = assar(jogoCom(['sensores'], { moedas: 100 }), dados, 'biscoito');
    expect(r.eventos[0]).toMatchObject({ tipo: 'falhou', motivo: 'produtoTrancado' });
  });

  it('produto que não existe falha com produtoDesconhecido (ids não têm acento: "pão" não existe)', () => {
    expect(assar(jogoCom([]), dados, 'torta').eventos[0]).toMatchObject({ motivo: 'produtoDesconhecido' });
    expect(assar(jogoCom([]), dados, 'pão').eventos[0]).toMatchObject({ motivo: 'produtoDesconhecido' });
  });

  it('uma ação que falha também gasta o seu tick', () => {
    const r = assar(jogoCom([]), dados, 'torta');
    expect(r.jogo.estatisticas.ticksTotais).toBe(1);
  });
});

describe('retirar', () => {
  it('forno vazio: não faz nada, retorna False', () => {
    const r = retirar(jogoCom([]), dados);
    expect(r.retorno).toBe(false);
    expect(r.eventos[0]).toEqual({ tipo: 'retirouVazio', x: 0, y: 0 });
    expect(r.jogo.estatisticas.ticksTotais).toBe(1);
  });

  it('forno assando: tira cru, limpa o forno, não rende nada nem conta como produzido', () => {
    const antes = biscoitoEm('assando');
    const r = retirar(antes, dados);
    expect(r.retorno).toBe(false);
    expect(r.eventos[0]).toEqual({ tipo: 'retirouCru', produto: 'biscoito', x: 0, y: 0 });
    expect(fornoDoRobo(r.jogo)).toBeNull();
    expect(r.jogo.moedas).toBe(antes.moedas);
    expect(r.jogo.estatisticas.produzidos.biscoito).toBeUndefined();
  });

  it('forno pronto: vende, soma o valor, conta como produzido e retorna True', () => {
    const antes = biscoitoEm('pronto');
    const r = retirar(antes, dados);
    const venda = produto('biscoito').venda;
    expect(r.retorno).toBe(true);
    expect(r.eventos[0]).toEqual({ tipo: 'vendeu', produto: 'biscoito', valor: venda, x: 0, y: 0 });
    expect(r.jogo.moedas).toBe(antes.moedas + venda);
    expect(r.jogo.estatisticas.produzidos.biscoito).toBe(1);
    expect(fornoDoRobo(r.jogo)).toBeNull();
  });

  it('forno queimado: limpa o forno e não rende nada', () => {
    const antes = biscoitoEm('queimado');
    const r = retirar(antes, dados);
    expect(r.retorno).toBe(false);
    expect(r.eventos[0]).toEqual({ tipo: 'retirouQueimado', produto: 'biscoito', x: 0, y: 0 });
    expect(r.jogo.moedas).toBe(antes.moedas);
    expect(r.jogo.estatisticas.produzidos.biscoito).toBeUndefined();
  });
});

describe('mover e wrap-around (SPEC §2.1)', () => {
  const casos: [Direcao, [number, number], [number, number], boolean][] = [
    ['Norte', [1, 1], [1, 2], false],
    ['Sul', [1, 1], [1, 0], false],
    ['Leste', [1, 1], [2, 1], false],
    ['Oeste', [1, 1], [0, 1], false],
    ['Norte', [1, 2], [1, 0], true],
    ['Sul', [1, 0], [1, 2], true],
    ['Leste', [2, 1], [0, 1], true],
    ['Oeste', [0, 1], [2, 1], true],
  ];
  for (const [direcao, [x, y], [nx, ny], deuVolta] of casos) {
    it(`3×3: ${direcao} de (${x},${y}) vai para (${nx},${ny})`, () => {
      const jogo = { ...jogoCom(['cozinha_3x3']), robo: { x, y } };
      const r = mover(jogo, dados, direcao);
      expect(r.jogo.robo).toEqual({ x: nx, y: ny });
      expect(r.eventos[0]).toEqual({ tipo: 'moveu', direcao, de: { x, y }, para: { x: nx, y: ny }, deuVolta });
      expect(r.jogo.estatisticas.ticksTotais).toBe(1);
    });
  }

  it('3×1: Norte e Sul dão a volta e o robô fica na mesma célula (o gate é quem barra Norte antes da 3×3)', () => {
    const jogo = jogoCom(['cozinha_3x1']);
    expect(mover(jogo, dados, 'Norte').jogo.robo).toEqual({ x: 0, y: 0 });
    expect(mover(jogo, dados, 'Sul').jogo.robo).toEqual({ x: 0, y: 0 });
  });

  it('três passos para Leste na 3×1 voltam ao começo', () => {
    let jogo = jogoCom(['cozinha_3x1']);
    for (let i = 0; i < 3; i++) jogo = mover(jogo, dados, 'Leste').jogo;
    expect(jogo.robo).toEqual({ x: 0, y: 0 });
  });

  it('direção inválida é erro de programação (o runner valida antes)', () => {
    expect(() => mover(jogoCom(['cozinha_3x3']), dados, 'norte' as Direcao)).toThrow();
  });
});

describe('esperar', () => {
  it('só passa um tick', () => {
    const jogo = jogoCom([]);
    const r = esperar(jogo, dados);
    expect(r.jogo).toEqual({ ...jogo, estatisticas: { ...jogo.estatisticas, ticksTotais: 1 } });
    expect(r.eventos).toEqual([{ tipo: 'tempoPassou', ticks: 1, ticksTotais: 1 }]);
  });
});

describe('sensores (0 ticks)', () => {
  it('leem o forno atual sem mudar nada', () => {
    const jogo = biscoitoEm('pronto');
    const copia = structuredClone(jogo);
    expect(estaPronto(jogo, dados)).toBe(true);
    expect(estadoAtual(jogo, dados)).toBe('pronto');
    expect(produtoAtual(jogo)).toBe('biscoito');
    expect(tamanho(jogoCom(['cozinha_4x4']))).toBe(4);
    expect(jogo).toEqual(copia);
  });

  it('forno vazio: estado "vazio", produto None', () => {
    const jogo = jogoCom([]);
    expect(estadoAtual(jogo, dados)).toBe('vazio');
    expect(estaPronto(jogo, dados)).toBe(false);
    expect(produtoAtual(jogo)).toBeNull();
  });
});

describe('pureza', () => {
  it('nenhuma ação altera o estado recebido', () => {
    let jogo = jogoCom(['cozinha_3x3'], { moedas: 500 });
    jogo = assar(jogo, dados, 'pao').jogo;
    const congelado = structuredClone(jogo);
    assar(jogo, dados, 'pao');
    retirar(jogo, dados);
    esperar(jogo, dados);
    mover(jogo, dados, 'Norte');
    aplicar(jogo, dados, { tipo: 'comprarUnlock', id: 'sensores' });
    aplicar(jogo, dados, { tipo: 'comprarMelhoria', id: 'forno_turbo' });
    expect(jogo).toEqual(congelado);
  });

  it('aplicar despacha para a ação certa', () => {
    const jogo = jogoCom(['cozinha_3x3']);
    expect(aplicar(jogo, dados, { tipo: 'mover', direcao: 'Norte' }).jogo.robo).toEqual({ x: 0, y: 1 });
    expect(aplicar(jogo, dados, { tipo: 'assar', produto: 'pao' }).retorno).toBe(true);
    expect(aplicar(jogo, dados, { tipo: 'retirar' }).retorno).toBe(false);
    expect(aplicar(jogo, dados, { tipo: 'esperar' }).jogo.estatisticas.ticksTotais).toBe(1);
  });
});
