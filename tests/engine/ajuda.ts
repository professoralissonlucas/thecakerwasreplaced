// Helpers dos testes do engine. Os números de produto vêm de src/data/, então os testes de regra
// continuam valendo se o balanceamento mudar.
import {
  criarJogo,
  dadosPadrao,
  esperar,
  fecharRequisitos,
  fornoEm,
  produtoPorId,
  type Jogo,
  type OpcoesNovoJogo,
  type Produto,
} from '../../src/engine/index.ts';

export const dados = dadosPadrao;

/** Jogo com os unlocks pedidos (e todos os requisitos deles) já ativos. */
export function jogoCom(unlocks: string[], opcoes: Omit<OpcoesNovoJogo, 'unlocks'> = {}): Jogo {
  return criarJogo(dados, { ...opcoes, unlocks: fecharRequisitos(dados, unlocks) });
}

export function produto(id: string): Produto {
  const p = produtoPorId(dados, id);
  if (!p) throw new Error(`produto ${id} não existe nos dados`);
  return p;
}

export function esperarVezes(jogo: Jogo, vezes: number): Jogo {
  let atual = jogo;
  for (let i = 0; i < vezes; i++) atual = esperar(atual, dados).jogo;
  return atual;
}

export function fornoDoRobo(jogo: Jogo) {
  return fornoEm(jogo.cozinha, jogo.robo.x, jogo.robo.y);
}
