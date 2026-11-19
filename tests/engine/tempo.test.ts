import { describe, expect, it } from 'vitest';
import { assar, avancarTicks, estadoAtual, fornoEm, mover, retirar } from '../../src/engine/index.ts';
import { dados, esperarVezes, fornoDoRobo, jogoCom, produto } from './ajuda.ts';

describe('regra exata dos ticks (SPEC §2.4)', () => {
  it('assar deixa o progresso em 1 (o forno que acabou de receber massa também ganha o tick)', () => {
    const { jogo } = assar(jogoCom([]), dados, 'pao');
    expect(fornoDoRobo(jogo)?.progresso).toBe(1);
    expect(jogo.estatisticas.ticksTotais).toBe(1);
  });

  it('exemplo do SPEC: assar, esperar, esperar deixa o pão pronto; retirar vende; 4 ticks no total', () => {
    const pao = produto('pao');
    let jogo = assar(jogoCom([]), dados, 'pao').jogo;
    jogo = esperarVezes(jogo, 1);
    expect(estadoAtual(jogo, dados)).toBe('assando');
    jogo = esperarVezes(jogo, 1);
    expect(fornoDoRobo(jogo)?.progresso).toBe(pao.tempo);
    expect(estadoAtual(jogo, dados)).toBe('pronto');
    const r = retirar(jogo, dados);
    expect(r.retorno).toBe(true);
    expect(r.jogo.moedas).toBe(pao.venda);
    expect(r.jogo.estatisticas.ticksTotais).toBe(4);
  });

  for (const id of ['biscoito', 'bolo']) {
    it(`${id}: assando em T-1, pronto em T, ainda pronto em T+L, queimado em T+L+1`, () => {
      const { tempo: T, tolerancia: L } = produto(id);
      if (L === null) throw new Error('o teste precisa de um produto que queima');
      let jogo = assar(jogoCom(['bolo'], { moedas: 1000 }), dados, id).jogo; // progresso 1
      jogo = esperarVezes(jogo, T - 2);
      expect(fornoDoRobo(jogo)?.progresso).toBe(T - 1);
      expect(estadoAtual(jogo, dados)).toBe('assando');
      jogo = esperarVezes(jogo, 1);
      expect(estadoAtual(jogo, dados)).toBe('pronto');
      jogo = esperarVezes(jogo, L);
      expect(fornoDoRobo(jogo)?.progresso).toBe(T + L);
      expect(estadoAtual(jogo, dados)).toBe('pronto');
      jogo = esperarVezes(jogo, 1);
      expect(estadoAtual(jogo, dados)).toBe('queimado');
    });
  }

  it('retirar lê o estado antes do seu tick: em T-1 sai cru, mesmo que o tick levasse a T', () => {
    const { tempo: T } = produto('biscoito');
    let jogo = assar(jogoCom(['biscoito'], { moedas: 100 }), dados, 'biscoito').jogo;
    jogo = esperarVezes(jogo, T - 2);
    const r = retirar(jogo, dados);
    expect(r.retorno).toBe(false);
    expect(r.eventos.map((e) => e.tipo)).toContain('retirouCru');
  });

  it('pão nunca queima', () => {
    const jogo = assar(jogoCom([]), dados, 'pao').jogo;
    const r = avancarTicks(jogo, dados, 100_000);
    expect(estadoAtual(r.jogo, dados)).toBe('pronto');
    expect(r.eventos.some((e) => e.tipo === 'queimou')).toBe(false);
  });

  it('todos os fornos ganham progresso com qualquer ação que gasta tick, inclusive mover', () => {
    let jogo = jogoCom(['cozinha_3x1']);
    jogo = assar(jogo, dados, 'pao').jogo; //            forno0 = 1
    jogo = mover(jogo, dados, 'Leste').jogo; //          forno0 = 2
    jogo = assar(jogo, dados, 'pao').jogo; //            forno0 = 3, forno1 = 1
    jogo = mover(jogo, dados, 'Leste').jogo; //          forno0 = 4, forno1 = 2
    expect(fornoEm(jogo.cozinha, 0, 0)?.progresso).toBe(4);
    expect(fornoEm(jogo.cozinha, 1, 0)?.progresso).toBe(2);
    expect(fornoEm(jogo.cozinha, 2, 0)).toBeNull();
    expect(jogo.estatisticas.ticksTotais).toBe(4);
  });

  it('emite ficouPronto e queimou exatamente no tick da mudança', () => {
    const { tempo: T, tolerancia: L } = produto('biscoito');
    const jogo = assar(jogoCom(['biscoito'], { moedas: 100 }), dados, 'biscoito').jogo;
    const ateProntoMenosUm = avancarTicks(jogo, dados, T - 2);
    expect(ateProntoMenosUm.eventos.some((e) => e.tipo === 'ficouPronto')).toBe(false);
    const pronto = avancarTicks(ateProntoMenosUm.jogo, dados, 1);
    expect(pronto.eventos).toContainEqual({ tipo: 'ficouPronto', produto: 'biscoito', x: 0, y: 0 });
    const queimou = avancarTicks(pronto.jogo, dados, L! + 1);
    expect(queimou.eventos.filter((e) => e.tipo === 'queimou')).toHaveLength(1);
    expect(queimou.eventos.at(-1)).toEqual({ tipo: 'tempoPassou', ticks: L! + 1, ticksTotais: T + L! + 1 });
  });

  it('avancarTicks(0) não muda nada e número de ticks inválido é erro', () => {
    const jogo = assar(jogoCom([]), dados, 'pao').jogo;
    expect(avancarTicks(jogo, dados, 0).jogo).toEqual(jogo);
    expect(() => avancarTicks(jogo, dados, -1)).toThrow();
    expect(() => avancarTicks(jogo, dados, 1.5)).toThrow();
  });
});
