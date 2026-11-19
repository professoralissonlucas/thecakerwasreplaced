import { describe, expect, it } from 'vitest';
import { carregarDados, dadosPadrao, validarDados, type Dados } from '../../src/engine/index.ts';

const copia = (): Dados => structuredClone(dadosPadrao);

describe('dados de jogo (src/data/)', () => {
  it('os JSON atuais passam na validação', () => {
    expect(validarDados(dadosPadrao)).toEqual([]);
  });

  it('o validador acusa id repetido, requisito desconhecido e produto sem unlock', () => {
    const d = copia();
    d.produtos.push({ ...d.produtos[0]!, id: 'torta' });
    d.unlocks.push({ ...d.unlocks[1]!, requisitos: { unlocks: ['nao_existe'] } });
    const problemas = validarDados(d).join('\n');
    expect(problemas).toContain('id repetido "repeticao"');
    expect(problemas).toContain('requisito desconhecido "nao_existe"');
    expect(problemas).toContain('produto torta: nenhum unlock libera este produto');
  });

  it('o validador acusa ciclo de requisitos e estatística desconhecida', () => {
    const d = copia();
    d.unlocks.find((u) => u.id === 'repeticao')!.requisitos = { unlocks: ['contagem'], estatisticas: { 'vendidos.pao': 3 } };
    const problemas = validarDados(d).join('\n');
    expect(problemas).toContain('ciclo de requisitos');
    expect(problemas).toContain('estatística desconhecida "vendidos.pao"');
  });

  it('o validador acusa números inválidos em produtos e melhorias', () => {
    const d = copia();
    d.produtos[0]!.tempo = 0;
    d.melhorias[0]!.efeito.valor = 1.5;
    d.melhorias[0]!.apareceApos = 'nada';
    const problemas = validarDados(d).join('\n');
    expect(problemas).toContain('produto pao: tempo inválido');
    expect(problemas).toContain('tempoMult precisa estar entre 0 e 1');
    expect(problemas).toContain('apareceApos desconhecido "nada"');
  });

  it('carregarDados recusa dados inválidos', () => {
    const d = copia();
    d.unlocks = d.unlocks.filter((u) => !u.inicial);
    expect(() => carregarDados(d)).toThrow(/nenhum unlock inicial/);
  });
});
