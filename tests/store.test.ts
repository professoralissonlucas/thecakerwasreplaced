import { describe, expect, it } from 'vitest';
import { criarJogo, dadosPadrao, type Evento } from '../src/engine/index.ts';
import { CONFIG_PADRAO, criarStore, type EstadoApp } from '../src/store.ts';

describe('store', () => {
  it('começa com um jogo novo e a configuração padrão', () => {
    const store = criarStore();
    expect(store.obter().jogo).toEqual(criarJogo(dadosPadrao));
    expect(store.obter().config).toEqual(CONFIG_PADRAO);
  });

  it('despachar passa a ação ao engine, guarda o estado novo e devolve o retorno', () => {
    const store = criarStore();
    expect(store.despachar({ tipo: 'assar', produto: 'pao' })).toBe(true);
    expect(store.obter().jogo.estatisticas.ticksTotais).toBe(1);
    expect(store.despachar({ tipo: 'assar', produto: 'pao' })).toBe(false);
  });

  it('avisa os inscritos com o estado novo e os eventos daquela ação', () => {
    const store = criarStore();
    const recebidos: [EstadoApp, readonly Evento[]][] = [];
    store.subscribe((estado, eventos) => recebidos.push([estado, eventos]));
    store.despachar({ tipo: 'esperar' });
    expect(recebidos).toHaveLength(1);
    expect(recebidos[0]![0]).toBe(store.obter());
    expect(recebidos[0]![1]).toEqual([{ tipo: 'tempoPassou', ticks: 1, ticksTotais: 1 }]);
  });

  it('cancelar a inscrição para os avisos', () => {
    const store = criarStore();
    let chamadas = 0;
    const cancelar = store.subscribe(() => chamadas++);
    store.despachar({ tipo: 'esperar' });
    cancelar();
    store.despachar({ tipo: 'esperar' });
    expect(chamadas).toBe(1);
  });

  it('trocarJogo, configurar e definirExecucao também avisam', () => {
    const store = criarStore();
    const eventos: (readonly Evento[])[] = [];
    store.subscribe((_, e) => eventos.push(e));
    store.trocarJogo({ ...store.obter().jogo, moedas: 50 });
    store.configurar({ msPorTick: 0 });
    store.definirExecucao({ rodando: true });
    expect(store.obter().jogo.moedas).toBe(50);
    expect(store.obter().config.msPorTick).toBe(0);
    expect(store.obter().execucao.rodando).toBe(true);
    expect(eventos).toEqual([[], [], []]);
  });
});
