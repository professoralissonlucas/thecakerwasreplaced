import { describe, expect, it } from 'vitest';
import { criarJogo, dadosPadrao as dados, type Evento } from '../../src/engine/index.ts';
import { linhaDoEvento } from '../../src/ui/mensagens.ts';

const jogo = criarJogo(dados, { moedas: 2 });
const linha = (evento: Evento) => linhaDoEvento(evento, jogo, dados);

describe('linhas da lousa a partir dos eventos', () => {
  it('venda mostra o nome do produto (dos dados), a posição e o valor', () => {
    expect(linha({ tipo: 'vendeu', produto: 'pao', valor: 1, x: 2, y: 0 })).toEqual({
      tipo: 'venda',
      texto: 'Pão vendido em (2, 0): +1 moeda',
    });
  });

  it('retirar cru ou queimado vira uma mensagem engraçada do tipo perda', () => {
    expect(linha({ tipo: 'retirouCru', produto: 'bolo', x: 0, y: 0 })).toMatchObject({ tipo: 'perda' });
    expect(linha({ tipo: 'retirouCru', produto: 'bolo', x: 0, y: 0 })!.texto.toLowerCase()).toContain('bolo');
    expect(linha({ tipo: 'retirouQueimado', produto: 'bolo', x: 0, y: 0 })).toMatchObject({ tipo: 'perda' });
  });

  it('falta de moedas diz quanto custa e quanto o jogador tem', () => {
    expect(linha({ tipo: 'falhou', acao: 'assar', motivo: 'semMoedas', produto: 'biscoito', x: 0, y: 0 })!.texto).toBe(
      'Biscoito custa 3 moedas e você tem 2 moedas. Venda mais um pouco antes.',
    );
  });

  it('produto com acento sugere o id sem acento', () => {
    expect(linha({ tipo: 'falhou', acao: 'assar', motivo: 'produtoDesconhecido', produto: 'Pão', x: 0, y: 0 })!.texto).toContain(
      'Você quis dizer "pao"?',
    );
    expect(linha({ tipo: 'falhou', acao: 'assar', motivo: 'produtoDesconhecido', produto: 'torta', x: 0, y: 0 })!.texto).toContain(
      '"pao", "biscoito", "bolo"',
    );
  });

  it('compras usam o nome do unlock ou da melhoria', () => {
    expect(linha({ tipo: 'comprouUnlock', id: 'cozinha_3x3', custo: 120 })!.texto).toBe('Liberado: Cozinha 3×3!');
    expect(linha({ tipo: 'compraFalhou', id: 'forno_turbo', motivo: 'nivelMaximo' })!.texto).toBe('Forno Turbo já está no nível máximo.');
  });

  it('eventos que só a grade mostra não escrevem na lousa', () => {
    const silenciosos: Evento[] = [
      { tipo: 'assou', produto: 'pao', custo: 0, x: 0, y: 0 },
      { tipo: 'retirouVazio', x: 0, y: 0 },
      { tipo: 'moveu', direcao: 'Leste', de: { x: 0, y: 0 }, para: { x: 1, y: 0 }, deuVolta: false },
      { tipo: 'ficouPronto', produto: 'pao', x: 0, y: 0 },
      { tipo: 'tempoPassou', ticks: 1, ticksTotais: 1 },
    ];
    for (const evento of silenciosos) expect(linha(evento)).toBeNull();
  });
});
