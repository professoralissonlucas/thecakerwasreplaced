// Console do jogo, desenhado como a lousa da padaria. Mostra o que o robô fez (vendas, perdas,
// avisos) e, a partir da fase 3, o dizer/print e os erros do script.

import type { Store } from '../store.ts';
import { el } from './dom.ts';
import { linhaDoEvento, type Linha } from './mensagens.ts';
import { ICONES, TEXTOS } from './textos.ts';

/** Linhas guardadas na lousa; as mais antigas saem. */
const MAXIMO_LINHAS = 200;

export interface Lousa {
  escrever(linha: Linha): void;
  apagar(): void;
}

export function montarConsole(alvo: HTMLElement, store: Store): Lousa {
  const cabecalho = el('div', 'lousa-cabecalho');
  const titulo = el('h2', 'lousa-titulo', TEXTOS.console.titulo);
  const apagar = el('button', 'botao-giz', TEXTOS.console.apagar);
  apagar.type = 'button';
  cabecalho.append(titulo, apagar);

  const vazia = el('p', 'lousa-vazia', TEXTOS.console.vazio);
  const linhas = el('ol', 'lousa-linhas');
  linhas.setAttribute('role', 'log');
  linhas.setAttribute('aria-live', 'polite');
  alvo.replaceChildren(cabecalho, vazia, linhas);

  const atualizarVazia = () => {
    vazia.hidden = linhas.childElementCount > 0;
  };

  const lousa: Lousa = {
    escrever({ tipo, texto, icone: iconeProprio }) {
      const item = el('li', `lousa-linha lousa-${tipo}`);
      const icone = el('span', 'lousa-icone', iconeProprio ?? ICONES.linhas[tipo]);
      icone.setAttribute('aria-hidden', 'true');
      item.append(icone, el('span', 'lousa-texto', texto));
      linhas.append(item);
      while (linhas.childElementCount > MAXIMO_LINHAS) linhas.firstElementChild?.remove();
      linhas.scrollTop = linhas.scrollHeight;
      atualizarVazia();
    },
    apagar() {
      linhas.replaceChildren();
      atualizarVazia();
    },
  };

  apagar.addEventListener('click', () => lousa.apagar());
  store.subscribe((estado, eventos) => {
    for (const evento of eventos) {
      const linha = linhaDoEvento(evento, estado.jogo, store.dados);
      if (linha) lousa.escrever(linha);
    }
  });
  atualizarVazia();
  return lousa;
}
