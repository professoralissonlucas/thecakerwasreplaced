import { describe, expect, it } from 'vitest';
import {
  assar,
  comandosLiberados,
  comprarUnlock,
  criarJogo,
  dimensoesCozinha,
  embutidasLiberadas,
  fecharRequisitos,
  fornoEm,
  mover,
  podeComprarUnlock,
  produtosLiberados,
  sintaxeLiberada,
  unlockPorId,
} from '../../src/engine/index.ts';
import { dados, jogoCom } from './ajuda.ts';

const custo = (id: string) => unlockPorId(dados, id)!.custo;

describe('começo', () => {
  it('cozinha 1×1 vazia, robô em (0,0), 0 moedas, só o básico liberado', () => {
    const jogo = criarJogo(dados);
    expect(jogo.cozinha).toEqual({ largura: 1, altura: 1, fornos: [[null]] });
    expect(jogo.robo).toEqual({ x: 0, y: 0 });
    expect(jogo.moedas).toBe(0);
    expect(comandosLiberados(jogo, dados)).toEqual(new Set(['assar', 'retirar', 'esperar', 'dizer']));
    expect(embutidasLiberadas(jogo, dados)).toEqual(new Set(['print']));
    expect(produtosLiberados(jogo, dados)).toEqual(new Set(['pao']));
    expect(sintaxeLiberada(jogo, dados).has('While')).toBe(false);
  });
});

describe('comprar unlock', () => {
  it('desconta o custo, registra o unlock e não gasta ticks', () => {
    const r = comprarUnlock(criarJogo(dados, { moedas: custo('repeticao') }), dados, 'repeticao');
    expect(r.retorno).toBe(true);
    expect(r.jogo.moedas).toBe(0);
    expect(r.jogo.unlocks).toEqual(['repeticao']);
    expect(r.jogo.estatisticas.ticksTotais).toBe(0);
    expect(r.eventos).toEqual([{ tipo: 'comprouUnlock', id: 'repeticao', custo: custo('repeticao') }]);
    expect(sintaxeLiberada(r.jogo, dados).has('While')).toBe(true);
  });

  it('recusa sem moedas suficientes', () => {
    const jogo = criarJogo(dados, { moedas: custo('repeticao') - 1 });
    expect(podeComprarUnlock(jogo, dados, 'repeticao')).toEqual({ ok: false, motivo: 'semMoedas' });
    const r = comprarUnlock(jogo, dados, 'repeticao');
    expect(r.retorno).toBe(false);
    expect(r.jogo).toBe(jogo);
    expect(r.eventos).toEqual([{ tipo: 'compraFalhou', id: 'repeticao', motivo: 'semMoedas' }]);
  });

  it('recusa sem os unlocks pedidos como requisito', () => {
    const jogo = criarJogo(dados, { moedas: 10_000 });
    expect(podeComprarUnlock(jogo, dados, 'cozinha_3x1')).toEqual({ ok: false, motivo: 'requisitos' });
  });

  it('recusa comprar de novo, comprar o inicial ou um id que não existe', () => {
    const jogo = jogoCom(['repeticao'], { moedas: 10_000 });
    expect(podeComprarUnlock(jogo, dados, 'repeticao')).toEqual({ ok: false, motivo: 'jaComprado' });
    expect(podeComprarUnlock(jogo, dados, 'comeco')).toEqual({ ok: false, motivo: 'jaComprado' });
    expect(podeComprarUnlock(jogo, dados, 'cozinha_9x9')).toEqual({ ok: false, motivo: 'desconhecido' });
  });

  it('requisito de estatística: Bolo pede produzidos.biscoito ≥ 30', () => {
    const minimo = unlockPorId(dados, 'bolo')!.requisitos.estatisticas!['produzidos.biscoito']!;
    const base = jogoCom(['receitas'], { moedas: 10_000 });
    const quase = { ...base, estatisticas: { ...base.estatisticas, produzidos: { biscoito: minimo - 1 } } };
    const pronto = { ...base, estatisticas: { ...base.estatisticas, produzidos: { biscoito: minimo } } };
    expect(podeComprarUnlock(quase, dados, 'bolo')).toEqual({ ok: false, motivo: 'requisitos' });
    expect(podeComprarUnlock(pronto, dados, 'bolo')).toEqual({ ok: true });
  });

  it('liberações acumulam: na 3×3 há mover com as 4 direções, posição e tamanho', () => {
    const comandos = comandosLiberados(jogoCom(['cozinha_3x3']), dados);
    for (const nome of ['mover', 'Norte', 'Sul', 'Leste', 'Oeste', 'pos_x', 'pos_y', 'tamanho', 'assar']) {
      expect(comandos.has(nome)).toBe(true);
    }
    expect(comandosLiberados(jogoCom(['cozinha_3x1']), dados).has('Norte')).toBe(false);
    expect(embutidasLiberadas(jogoCom(['contagem']), dados).has('range')).toBe(true);
  });
});

describe('crescimento da cozinha (SPEC §2.1)', () => {
  it('fornos antigos mantêm posição e estado, novos começam vazios, robô fica onde está', () => {
    let jogo = jogoCom(['repeticao'], { moedas: 10_000 });
    jogo = assar(jogo, dados, 'pao').jogo; // forno (0,0) com progresso 1

    const r3x1 = comprarUnlock(jogo, dados, 'cozinha_3x1');
    expect(r3x1.eventos).toContainEqual({ tipo: 'cozinhaCresceu', largura: 3, altura: 1 });
    jogo = r3x1.jogo;
    expect(fornoEm(jogo.cozinha, 0, 0)).toEqual({ produto: 'pao', progresso: 1 });
    expect(fornoEm(jogo.cozinha, 1, 0)).toBeNull();
    expect(fornoEm(jogo.cozinha, 2, 0)).toBeNull();

    jogo = mover(mover(jogo, dados, 'Leste').jogo, dados, 'Leste').jogo; // robô em (2,0); pão em 3
    jogo = assar(jogo, dados, 'pao').jogo; // forno (2,0) = 1, forno (0,0) = 4
    jogo = comprarUnlock(jogo, dados, 'contagem').jogo;
    const r3x3 = comprarUnlock(jogo, dados, 'cozinha_3x3');
    jogo = r3x3.jogo;
    expect(r3x3.eventos).toContainEqual({ tipo: 'cozinhaCresceu', largura: 3, altura: 3 });
    expect(jogo.robo).toEqual({ x: 2, y: 0 });
    expect(fornoEm(jogo.cozinha, 0, 0)).toEqual({ produto: 'pao', progresso: 4 });
    expect(fornoEm(jogo.cozinha, 2, 0)).toEqual({ produto: 'pao', progresso: 1 });
    for (let y = 1; y < 3; y++) for (let x = 0; x < 3; x++) expect(fornoEm(jogo.cozinha, x, y)).toBeNull();
  });

  it('cada unlock de cozinha dá o tamanho da tabela do §4.1', () => {
    expect(dimensoesCozinha({ unlocks: [] }, dados)).toEqual({ largura: 1, altura: 1 });
    expect(dimensoesCozinha({ unlocks: fecharRequisitos(dados, ['cozinha_3x1']) }, dados)).toEqual({ largura: 3, altura: 1 });
    expect(dimensoesCozinha({ unlocks: fecharRequisitos(dados, ['cozinha_3x3']) }, dados)).toEqual({ largura: 3, altura: 3 });
    expect(dimensoesCozinha({ unlocks: fecharRequisitos(dados, ['cozinha_4x4']) }, dados)).toEqual({ largura: 4, altura: 4 });
  });

  it('unlock que não mexe na cozinha não emite cozinhaCresceu', () => {
    const r = comprarUnlock(jogoCom(['cozinha_3x3'], { moedas: 10_000 }), dados, 'sensores');
    expect(r.eventos.some((e) => e.tipo === 'cozinhaCresceu')).toBe(false);
  });
});

describe('fecharRequisitos', () => {
  it('traz a cadeia inteira de requisitos, na ordem dos dados, sem o inicial', () => {
    expect(fecharRequisitos(dados, ['contagem'])).toEqual(['repeticao', 'cozinha_3x1', 'contagem']);
    expect(fecharRequisitos(dados, ['comeco'])).toEqual([]);
    expect(() => fecharRequisitos(dados, ['nao_existe'])).toThrow();
  });
});
