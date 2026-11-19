// Roteiros de referência como teste de balanceamento (SPEC §2.6). Se mudar qualquer número em
// src/data/, estes testes precisam continuar passando. O nome de cada teste mostra o valor medido.
import { describe, expect, it } from 'vitest';
import { ROTEIROS, rodarRoteiro, type ResultadoRoteiro } from './roteiro.ts';

// Um script roda por vez no Skulpt: os roteiros rodam em sequência, antes dos testes.
const m: Record<keyof typeof ROTEIROS, ResultadoRoteiro> = {} as never;
for (const [chave, roteiro] of Object.entries(ROTEIROS) as [keyof typeof ROTEIROS, (typeof ROTEIROS)[keyof typeof ROTEIROS]][]) {
  m[chave] = await rodarRoteiro(roteiro);
}
const resumo = (r: ResultadoRoteiro) => `lucro ${r.lucro}, ${r.vendidos} vendidos, ${r.perdas} perdas, ${r.ticks} ticks`;

describe('roteiros de referência em Python (SPEC §2.6)', () => {
  it(`01_manual: +1 moeda em 4 ticks → ${resumo(m.r01)}`, () => {
    expect(m.r01.ticks).toBe(4);
    expect(m.r01.lucro).toBe(1);
    expect(m.r01.perdas).toBe(0);
  });

  it(`02_repeticao: ≥ 90 moedas em 400 ticks, 0 perdas → ${resumo(m.r02)}`, () => {
    expect(m.r02.ticks).toBe(400);
    expect(m.r02.lucro).toBeGreaterThanOrEqual(90);
    expect(m.r02.perdas).toBe(0);
  });

  it(`03_varredura_3x1: ≥ 120 moedas em 400 ticks, 0 perdas → ${resumo(m.r03)}`, () => {
    expect(m.r03.ticks).toBe(400);
    expect(m.r03.lucro).toBeGreaterThanOrEqual(120);
    expect(m.r03.perdas).toBe(0);
  });

  it(`04_varredura_3x3: ≥ 150 moedas em 600 ticks, 0 perdas → ${resumo(m.r04)}`, () => {
    expect(m.r04.ticks).toBe(600);
    expect(m.r04.lucro).toBeGreaterThanOrEqual(150);
    expect(m.r04.perdas).toBe(0);
  });

  it(`05_biscoito_3x3: lucro maior que o 04 (${m.r04.lucro}), 0 perdas → ${resumo(m.r05)}`, () => {
    expect(m.r05.ticks).toBe(600);
    expect(m.r05.lucro).toBeGreaterThan(m.r04.lucro);
    expect(m.r05.perdas).toBe(0);
  });

  it(`06_bolo_sem_if: tem perdas (crus) → ${resumo(m.r06)}, ${m.r06.crus} crus`, () => {
    expect(m.r06.ticks).toBe(600);
    expect(m.r06.crus).toBeGreaterThan(0);
  });

  it(`07_bolo_com_if: lucro maior que o 05 (${m.r05.lucro}), 0 perdas → ${resumo(m.r07)}`, () => {
    expect(m.r07.ticks).toBe(600);
    expect(m.r07.lucro).toBeGreaterThan(m.r05.lucro);
    expect(m.r07.perdas).toBe(0);
  });

  it(`08_bolo_4x4: melhorias no máximo, 0 perdas e lucro → ${resumo(m.r08)}`, () => {
    expect(m.r08.ticks).toBe(1000);
    expect(m.r08.perdas).toBe(0);
    expect(m.r08.lucro).toBeGreaterThan(0);
  });
});
