// Painel do script: editor, ▶ Executar, ⏹ Parar e velocidade. Liga o editor ao runner.

import { executar, type Execucao, type FimExecucao } from '../runner/execucao.ts';
import { skulptGlobal } from '../runner/sk.ts';
import { obterSkulpt } from '../runner/skulpt.ts';
import type { Store } from '../store.ts';
import type { Lousa } from './console.ts';
import { el } from './dom.ts';
import { criarEditor } from './editor.ts';
import type { Grade } from './grade.ts';
import { ICONES, TEXTOS } from './textos.ts';

/** Velocidades do controle deslizante, do mais devagar ao mais rápido (ms por tick). */
const VELOCIDADES = [1000, 600, 350, 200, 120, 60, 30];

const T = TEXTOS.editor;

export function montarScript(alvo: HTMLElement, store: Store, lousa: Lousa, grade: Grade): void {
  const titulo = el('h2', 'painel-titulo', T.titulo);
  const caixaEditor = el('div', 'editor');

  const executarBotao = el('button', 'botao botao-executar');
  executarBotao.type = 'button';
  executarBotao.title = T.dica(T.atalhoExecutar);
  executarBotao.append(icone(ICONES.executar), el('span', '', T.executar));

  const pararBotao = el('button', 'botao botao-secundario botao-parar');
  pararBotao.type = 'button';
  pararBotao.title = T.dica(T.atalhoParar);
  pararBotao.append(icone(ICONES.parar), el('span', '', T.parar));

  const velocidade = criarVelocidade(store);
  const barra = el('div', 'script-controles');
  barra.append(executarBotao, pararBotao, velocidade);
  alvo.replaceChildren(titulo, caixaEditor, barra);

  const inicial = store.dados.unlocks.find((u) => u.inicial)?.exemplo ?? '';
  const editor = criarEditor(caixaEditor, { inicial, rotulo: T.rotulo, aoExecutar: rodarScript, aoParar: pararScript });

  let atual: Execucao | null = null;

  function mostrarFim(fim: FimExecucao): void {
    const E = TEXTOS.execucao;
    switch (fim.tipo) {
      case 'concluiu':
        lousa.escrever({ tipo: 'info', texto: E.terminou });
        break;
      case 'parou':
        lousa.escrever({ tipo: 'info', texto: E.parou, icone: ICONES.parar });
        break;
      case 'limiteTicks':
        lousa.escrever({ tipo: 'info', texto: E.limiteTicks(fim.ticks) });
        break;
      case 'roboParado':
        lousa.escrever({ tipo: 'erro', texto: E.roboParado, icone: ICONES.parado });
        break;
      case 'erro':
        editor.marcar('erro', fim.erro.linha);
        lousa.escrever({ tipo: 'erro', texto: fim.erro.texto, icone: fim.erro.icone });
        break;
    }
  }

  async function rodarScript(): Promise<void> {
    if (store.obter().execucao.rodando) return;
    store.definirExecucao({ rodando: true });
    editor.marcar('erro', null);
    editor.somenteLeitura(true);
    try {
      if (!skulptGlobal()) lousa.escrever({ tipo: 'info', texto: TEXTOS.execucao.carregando });
      const sk = await obterSkulpt().catch(() => null);
      if (!sk) {
        lousa.escrever({ tipo: 'erro', texto: TEXTOS.execucao.falhaCarregar });
        return;
      }
      atual = executar(sk, store, editor.texto(), {
        aoEscrever(texto) {
          lousa.escrever({ tipo: 'dizer', texto });
          grade.falar(texto);
        },
        aoMudarLinha: (linha) => editor.marcar('executando', linha),
      });
      mostrarFim(await atual.fim);
    } finally {
      atual = null;
      editor.somenteLeitura(false);
      store.definirExecucao({ rodando: false });
    }
  }

  function pararScript(): void {
    atual?.parar();
  }

  executarBotao.addEventListener('click', () => void rodarScript());
  pararBotao.addEventListener('click', pararScript);

  // Os atalhos também valem com o foco fora do editor (o editor trata os dele).
  document.addEventListener('keydown', (evento) => {
    if (evento.key !== 'Enter' || !(evento.ctrlKey || evento.metaKey)) return;
    if ((evento.target as HTMLElement | null)?.closest('.cm-editor')) return;
    evento.preventDefault();
    if (evento.shiftKey) pararScript();
    else void rodarScript();
  });

  const atualizar = () => {
    const { rodando } = store.obter().execucao;
    executarBotao.disabled = rodando;
    pararBotao.disabled = !rodando;
    alvo.classList.toggle('rodando', rodando);
  };
  atualizar();
  store.subscribe(atualizar);
}

function icone(texto: string): HTMLElement {
  const span = el('span', 'botao-icone', texto);
  span.setAttribute('aria-hidden', 'true');
  return span;
}

function criarVelocidade(store: Store): HTMLElement {
  const caixa = el('label', 'velocidade');
  const nome = el('span', 'velocidade-nome', T.velocidade);
  const devagar = icone(ICONES.devagar);
  const rapido = icone(ICONES.rapido);
  const controle = el('input', 'velocidade-controle');
  controle.type = 'range';
  controle.min = '0';
  controle.max = String(VELOCIDADES.length - 1);
  controle.step = '1';
  const valor = el('span', 'velocidade-valor');

  const mostrar = (ms: number) => {
    const texto = T.msPorTick(ms);
    valor.textContent = texto;
    controle.setAttribute('aria-valuetext', texto);
  };
  const ms = store.obter().config.msPorTick;
  const mais = VELOCIDADES.reduce((perto, v, i) => (Math.abs(v - ms) < Math.abs(VELOCIDADES[perto]! - ms) ? i : perto), 0);
  controle.value = String(mais);
  mostrar(ms);

  controle.addEventListener('input', () => {
    const escolhido = VELOCIDADES[Number(controle.value)] ?? ms;
    store.configurar({ msPorTick: escolhido });
    mostrar(escolhido);
  });

  const trilho = el('span', 'velocidade-trilho');
  trilho.append(devagar, controle, rapido);
  caixa.append(nome, trilho, valor);
  return caixa;
}
