// Monta a app: um store único ligando engine, runner e interface (SPEC §9.3).
import '@fontsource-variable/fredoka';
import '@fontsource-variable/nunito';
import '@fontsource-variable/recursive/full.css';
import './ui/estilos.css';

import { obterSkulpt } from './runner/skulpt.ts';
import { criarStore } from './store.ts';
import { montarConsole } from './ui/console.ts';
import { montarDebug } from './ui/debug.ts';
import { el } from './ui/dom.ts';
import { montarGrade } from './ui/grade.ts';
import { montarScript } from './ui/script.ts';
import { TEXTOS } from './ui/textos.ts';
import { montarTopo } from './ui/topo.ts';

const raiz = document.querySelector<HTMLDivElement>('#app');
if (!raiz) throw new Error('Elemento #app não encontrado no index.html');

document.title = TEXTOS.titulo;
const store = criarStore();

const topo = el('header', 'topo');
const bancada = el('main', 'bancada');
const coluna = el('div', 'coluna-script');
const script = el('section', 'painel-script');
const debug = el('details', 'painel-debug');
coluna.append(script, debug);
const cozinha = el('section', 'painel-cozinha');
const areaGrade = el('div', 'area-grade');
cozinha.append(el('h2', 'visualmente-oculto', TEXTOS.cozinha.titulo), areaGrade);
bancada.append(coluna, cozinha);
const lousa = el('section', 'lousa');
raiz.replaceChildren(topo, bancada, lousa);

montarTopo(topo, store);
const grade = montarGrade(areaGrade, store);
const quadro = montarConsole(lousa, store);
montarScript(script, store, quadro, grade);
montarDebug(debug, store, quadro);

// O Python (~1 MB) carrega em segundo plano, depois que a página já apareceu.
window.addEventListener('load', () => window.setTimeout(() => void obterSkulpt().catch(() => undefined), 300));
