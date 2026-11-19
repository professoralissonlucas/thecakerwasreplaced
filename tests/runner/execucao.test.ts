import { describe, expect, it } from 'vitest';
import { executar } from '../../src/runner/execucao.ts';
import { esperarMs, rodar, skulptNoNode } from './ajuda.ts';

const ticks = (r: { store: { obter(): { jogo: { estatisticas: { ticksTotais: number } } } } }) =>
  r.store.obter().jogo.estatisticas.ticksTotais;

describe('comandos do jogo no Python', () => {
  it('ações mudam o jogo e devolvem True/False do Python', async () => {
    const r = rodar('assar("pao")\nesperar()\nesperar()\nprint(retirar())\nprint(retirar())');
    expect(await r.fim).toEqual({ tipo: 'concluiu' });
    expect(r.escritos).toEqual(['True', 'False']);
    expect(r.store.obter().jogo.moedas).toBe(1);
    expect(ticks(r)).toBe(5);
  });

  it('dizer e print escrevem uma linha cada', async () => {
    const r = rodar('dizer(1 + 1)\nprint("a", "b")\ndizer(esperar())');
    await r.fim;
    expect(r.escritos).toEqual(['2', 'a b', 'None']);
  });

  it('sensores leem o forno sem gastar ticks', async () => {
    const r = rodar('assar("pao")\nprint(estado(), produto(), esta_pronto())\nesperar()\nesperar()\nprint(estado(), esta_pronto())', {
      unlocks: ['sensores'],
    });
    await r.fim;
    expect(r.escritos).toEqual(['assando pao False', 'pronto True']);
    expect(ticks(r)).toBe(3);
  });

  it('posição, tamanho e direções na 3×3', async () => {
    const r = rodar('mover(Norte)\nmover(Leste)\nmover(Leste)\nmover(Leste)\nprint(pos_x(), pos_y(), tamanho())', {
      unlocks: ['cozinha_3x3'],
    });
    await r.fim;
    expect(r.escritos).toEqual(['0 1 3']);
  });

  it('ticks() conta desde o início da execução; a cozinha continua entre execuções', async () => {
    const primeira = rodar('assar("pao")\nesperar()', { unlocks: ['memoria'] });
    await primeira.fim;
    const segunda = rodar('esperar()\nprint(ticks(), estado())', { store: primeira.store });
    await segunda.fim;
    expect(segunda.escritos).toEqual(['1 pronto']);
    expect(ticks(segunda)).toBe(3);
  });
});

describe('suspensão e animação', () => {
  it('cada comando de tick espera msPorTick e informa a linha que está rodando', async () => {
    const inicio = performance.now();
    const r = rodar('esperar()\nesperar()\n\nassar("pao")', { msPorTick: 15 });
    expect(await r.fim).toEqual({ tipo: 'concluiu' });
    expect(performance.now() - inicio).toBeGreaterThanOrEqual(40);
    expect(r.linhas).toEqual([1, 2, 4, null]);
  });

  it('dentro de uma função, a linha informada é a de dentro da função', async () => {
    const r = rodar('def f():\n    esperar()\n\nf()', { msPorTick: 5 });
    await r.fim;
    expect(r.linhas[0]).toBe(2);
  });

  it('com msPorTick 0 nada suspende (os roteiros rodam sem esperar)', async () => {
    const r = rodar('for i in range(50):\n    esperar()');
    expect(await r.fim).toEqual({ tipo: 'concluiu' });
    expect(r.linhas).toEqual([null]);
    expect(ticks(r)).toBe(50);
  });
});

describe('Parar (SPEC §5.2)', () => {
  it('no meio de while True: esperar(), encerra sem erro e sem nenhuma ação depois do Parar', async () => {
    const r = rodar('while True:\n    esperar()', { msPorTick: 30 });
    await esperarMs(100);
    r.parar();
    const ticksNoParar = ticks(r);
    const antes = performance.now();
    expect(await r.fim).toEqual({ tipo: 'parou' });
    expect(performance.now() - antes).toBeLessThan(30);
    expect(ticks(r)).toBe(ticksNoParar);
  });

  it('para também um loop que não chama nenhum comando', async () => {
    const r = rodar('x = 0\nwhile True:\n    x = x + 1');
    await esperarMs(50);
    r.parar();
    expect(await r.fim).toEqual({ tipo: 'parou' });
  });

  it('limiteTicks encerra em silêncio no tick certo', async () => {
    const r = rodar('while True:\n    esperar()', {}, { limiteTicks: 25 });
    expect(await r.fim).toEqual({ tipo: 'limiteTicks', ticks: 25 });
    expect(ticks(r)).toBe(25);
  });

  it('só um script roda por vez', async () => {
    const r = rodar('while True:\n    esperar()', { msPorTick: 10 });
    expect(() => executar(skulptNoNode(), r.store, 'esperar()')).toThrow();
    r.parar();
    await r.fim;
  });
});

describe('robô parado: o tempo não passa (SPEC §5.2)', () => {
  it('while True: pass encerra com robô parado', async () => {
    const r = rodar('while True:\n    pass', {}, { msParado: 250 });
    expect(await r.fim).toEqual({ tipo: 'roboParado' });
  });

  it('while not esta_pronto(): pass encerra pela contagem de sensores', async () => {
    const r = rodar('while not esta_pronto():\n    pass', { unlocks: ['sensores'] }, { msParado: 60_000 });
    expect(await r.fim).toEqual({ tipo: 'roboParado' });
  });

  it('loop só com dizer também conta', async () => {
    const r = rodar('while True:\n    dizer("oi")', {}, { msParado: 60_000, limiteConsultas: 500 });
    expect(await r.fim).toEqual({ tipo: 'roboParado' });
    expect(r.escritos).toHaveLength(500);
  });

  it('o tempo de animação não conta como parado', async () => {
    const r = rodar('esperar()\nesperar()', { msPorTick: 150 }, { msParado: 100 });
    expect(await r.fim).toEqual({ tipo: 'concluiu' });
  });
});

describe('erros traduzidos (SPEC §5.4)', () => {
  const erroDe = async (codigo: string, unlocks: string[] = []) => {
    const fim = await rodar(codigo, { unlocks }).fim;
    if (fim.tipo !== 'erro') throw new Error(`esperava erro, veio ${fim.tipo}`);
    return fim.erro;
  };

  it('comando ainda não liberado não existe e diz o que liberar', async () => {
    const erro = await erroDe('esperar()\nmover(Leste)');
    expect(erro.linha).toBe(2);
    expect(erro.texto).toBe('Linha 2: mover ainda está trancado. Libere Cozinha 3×1 no Livro de Receitas.');
    expect(erro.icone).toBe('🔒');
  });

  it('erro de digitação sugere o comando certo', async () => {
    expect((await erroDe('asar("pao")')).texto).toBe('Linha 1: O robô não conhece asar. Você quis dizer assar?');
    expect((await erroDe('Esperar()')).texto).toContain('Você quis dizer esperar?');
    expect((await erroDe('xyz()')).texto).toBe('Linha 1: O robô não conhece xyz. Confira se está escrito certo.');
  });

  it('faltou dois-pontos: erro de sintaxe com a linha', async () => {
    const erro = await erroDe('esperar()\nwhile True\n    esperar()');
    expect(erro.linha).toBe(2);
    expect(erro.texto).toContain('dois-pontos');
  });

  it('recuo errado ganha a dica de recuo', async () => {
    expect((await erroDe('esperar()\n  esperar()')).texto).toContain('recuo');
    expect((await erroDe('while True:\nesperar()')).texto).toContain('recuo');
  });

  it('argumentos errados nos comandos', async () => {
    expect((await erroDe('assar()')).texto).toBe('Linha 1: assar() precisa de um valor entre os parênteses, como assar("pao").');
    expect((await erroDe('assar(3)')).texto).toBe('Linha 1: assar() precisa de um texto entre aspas, como assar("pao").');
    expect((await erroDe('retirar(1)')).texto).toBe('Linha 1: retirar() não leva nada entre os parênteses.');
    expect((await erroDe('mover("norte")', ['cozinha_3x1'])).texto).toContain('Norte, Sul, Leste ou Oeste');
  });

  it('import é recusado', async () => {
    expect((await erroDe('import random')).texto).toBe('Linha 1: import não faz parte deste jogo.');
  });

  it('falha de jogo não quebra o script (assar em forno ocupado só devolve False)', async () => {
    const r = rodar('assar("pao")\nprint(assar("pao"))\nprint(assar("bolo"))');
    expect(await r.fim).toEqual({ tipo: 'concluiu' });
    expect(r.escritos).toEqual(['False', 'False']);
    expect(r.eventos.filter((e) => e.tipo === 'falhou')).toHaveLength(2);
  });
});
