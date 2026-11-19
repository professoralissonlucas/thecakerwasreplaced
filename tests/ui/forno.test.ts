import { describe, expect, it } from 'vitest';
import { assar, criarJogo, dadosPadrao as dados, fecharRequisitos, produtoPorId, type Jogo } from '../../src/engine/index.ts';
import { lerForno } from '../../src/ui/forno.ts';
import { esperarVezes } from '../engine/ajuda.ts';

const jogoComBiscoito = (): Jogo =>
  assar(criarJogo(dados, { moedas: 100, unlocks: fecharRequisitos(dados, ['biscoito']) }), dados, 'biscoito').jogo;

describe('lerForno (o que a barra do forno mostra)', () => {
  const { tempo: T, tolerancia } = produtoPorId(dados, 'biscoito')!;
  const L = tolerancia!;

  it('vazio: barra zerada', () => {
    expect(lerForno(criarJogo(dados), dados, 0, 0)).toEqual({ estado: 'vazio', produto: null, fracao: 0, nuncaQueima: false, alerta: false });
  });

  it('assando: fração do tempo que já passou', () => {
    const leitura = lerForno(jogoComBiscoito(), dados, 0, 0);
    expect(leitura.estado).toBe('assando');
    expect(leitura.fracao).toBeCloseTo(1 / T);
  });

  it('pronto: começa cheia e esvazia até a hora de queimar, piscando no fim', () => {
    const recemPronto = esperarVezes(jogoComBiscoito(), T - 1);
    expect(lerForno(recemPronto, dados, 0, 0)).toMatchObject({ estado: 'pronto', fracao: 1, alerta: false });
    const ultimoTick = esperarVezes(recemPronto, L);
    const leitura = lerForno(ultimoTick, dados, 0, 0);
    expect(leitura.estado).toBe('pronto');
    expect(leitura.fracao).toBeCloseTo(1 / (L + 1));
    expect(leitura.alerta).toBe(true);
  });

  it('queimado: barra zerada', () => {
    const queimado = esperarVezes(jogoComBiscoito(), T + L);
    expect(lerForno(queimado, dados, 0, 0)).toMatchObject({ estado: 'queimado', fracao: 0 });
  });

  it('pão pronto nunca queima: barra cheia, sem alerta', () => {
    const pao = esperarVezes(assar(criarJogo(dados), dados, 'pao').jogo, 500);
    expect(lerForno(pao, dados, 0, 0)).toMatchObject({ estado: 'pronto', fracao: 1, nuncaQueima: true, alerta: false });
  });
});
