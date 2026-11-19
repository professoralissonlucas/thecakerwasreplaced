// Traduz eventos do engine em linhas da lousa (console). Sem DOM, então dá para testar no Node.

import { melhoriaPorId, produtoPorId, unlockPorId, type Dados, type Evento, type Jogo } from '../engine/index.ts';
import { TEXTOS } from './textos.ts';

export type TipoLinha = 'info' | 'venda' | 'perda' | 'aviso' | 'erro' | 'dizer';

export interface Linha {
  tipo: TipoLinha;
  texto: string;
  /** Troca o ícone padrão do tipo (ex.: 🔒 para comando trancado, ⏳ para robô parado). */
  icone?: string;
}

const T = TEXTOS.eventos;

const semAcento = (texto: string) => texto.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function nomeProduto(dados: Dados, id: string): string {
  return produtoPorId(dados, id)?.nome ?? id;
}

function nomeCompra(dados: Dados, id: string): string {
  return unlockPorId(dados, id)?.nome ?? melhoriaPorId(dados, id)?.nome ?? id;
}

/**
 * Linha da lousa para um evento, ou `null` para eventos que só a grade mostra
 * (andar, assar, tempo passando, forno ficando pronto, retirar de forno vazio).
 * `jogo` é o estado logo depois do evento.
 */
export function linhaDoEvento(evento: Evento, jogo: Jogo, dados: Dados): Linha | null {
  const semente = jogo.estatisticas.ticksTotais;
  switch (evento.tipo) {
    case 'vendeu':
      return { tipo: 'venda', texto: T.vendeu(nomeProduto(dados, evento.produto), evento.valor, evento.x, evento.y) };
    case 'retirouCru':
      return { tipo: 'perda', texto: T.retirouCru(nomeProduto(dados, evento.produto), semente) };
    case 'retirouQueimado':
      return { tipo: 'perda', texto: T.retirouQueimado(nomeProduto(dados, evento.produto), semente) };
    case 'queimou':
      return { tipo: 'aviso', texto: T.queimou(nomeProduto(dados, evento.produto), evento.x, evento.y) };
    case 'falhou': {
      const nome = nomeProduto(dados, evento.produto);
      switch (evento.motivo) {
        case 'fornoOcupado':
          return { tipo: 'aviso', texto: T.fornoOcupado(evento.x, evento.y) };
        case 'semMoedas':
          return { tipo: 'aviso', texto: T.semMoedas(nome, produtoPorId(dados, evento.produto)?.custo ?? 0, jogo.moedas) };
        case 'produtoTrancado':
          return { tipo: 'aviso', texto: T.produtoTrancado(nome) };
        case 'produtoDesconhecido': {
          const parecido = dados.produtos.find((p) => p.id === semAcento(evento.produto));
          const texto = parecido
            ? T.produtoSemAcento(evento.produto, parecido.id)
            : T.produtoDesconhecido(evento.produto, dados.produtos.map((p) => p.id));
          return { tipo: 'aviso', texto };
        }
      }
      break;
    }
    case 'cozinhaCresceu':
      return { tipo: 'info', texto: T.cozinhaCresceu(evento.largura, evento.altura) };
    case 'comprouUnlock':
      return { tipo: 'info', texto: T.comprouUnlock(nomeCompra(dados, evento.id)) };
    case 'comprouMelhoria':
      return { tipo: 'info', texto: T.comprouMelhoria(nomeCompra(dados, evento.id), evento.nivel) };
    case 'compraFalhou': {
      const nome = nomeCompra(dados, evento.id);
      const texto = evento.motivo === 'desconhecido' ? T.compra.desconhecido(evento.id) : T.compra[evento.motivo](nome);
      return { tipo: 'aviso', texto };
    }
    case 'assou':
    case 'retirouVazio':
    case 'moveu':
    case 'ficouPronto':
    case 'tempoPassou':
      return null;
  }
  return null;
}
