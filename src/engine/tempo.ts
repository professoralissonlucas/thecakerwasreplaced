// Passagem do tempo (SPEC §2.4): a cada tick, todo forno com produto ganha +1 de progresso.

import type { Dados } from './dados.ts';
import { clonarJogo, type Evento, type Jogo, type Resultado } from './estado.ts';
import { estadoDoForno } from './economia.ts';

/**
 * Avança `ticks` ticks direto no jogo recebido (uso interno: o chamador já fez a cópia).
 * Emite `ficouPronto` e `queimou` no tick em que o forno muda de estado.
 */
export function avancarNoRascunho(jogo: Jogo, dados: Dados, ticks: number, eventos: Evento[]): void {
  if (!Number.isInteger(ticks) || ticks < 0) throw new Error(`Número de ticks inválido: ${ticks}`);
  if (ticks === 0) return;
  for (let t = 0; t < ticks; t++) {
    jogo.cozinha.fornos.forEach((linha, y) => {
      linha.forEach((forno, x) => {
        if (!forno) return;
        const antes = estadoDoForno(jogo, dados, forno);
        forno.progresso += 1;
        const depois = estadoDoForno(jogo, dados, forno);
        if (antes === depois) return;
        if (depois === 'pronto') eventos.push({ tipo: 'ficouPronto', produto: forno.produto, x, y });
        if (depois === 'queimado') eventos.push({ tipo: 'queimou', produto: forno.produto, x, y });
      });
    });
    jogo.estatisticas.ticksTotais += 1;
  }
  eventos.push({ tipo: 'tempoPassou', ticks, ticksTotais: jogo.estatisticas.ticksTotais });
}

export function avancarTicks(jogo: Jogo, dados: Dados, ticks: number): Resultado {
  const novo = clonarJogo(jogo);
  const eventos: Evento[] = [];
  avancarNoRascunho(novo, dados, ticks, eventos);
  return { jogo: novo, eventos, retorno: undefined };
}
