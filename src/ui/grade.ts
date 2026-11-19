// Grade da cozinha: fornos em CSS Grid e o robô numa camada por cima.
// O desenho vem do estado; os eventos disparam os efeitos de momento (moeda subindo, aviso,
// robô saindo por uma borda e entrando pela outra).

import type { Direcao, Evento, Jogo } from '../engine/index.ts';
import type { EstadoApp, Store } from '../store.ts';
import { el, prefereMenosMovimento, repetirAnimacao } from './dom.ts';
import { lerForno, type LeituraForno } from './forno.ts';
import { ICONES, TEXTOS } from './textos.ts';

interface Celula {
  x: number;
  y: number;
  raiz: HTMLElement;
  item: HTMLElement;
}

type Movimento = Extract<Evento, { tipo: 'moveu' }>;

const PASSO: Record<Direcao, [number, number]> = { Norte: [0, 1], Sul: [0, -1], Leste: [1, 0], Oeste: [-1, 0] };

/** Tempo máximo de um efeito flutuante na tela (segurança caso o animationend não dispare). */
const MS_EFEITO = 1400;
/** Quanto tempo o balão de fala fica visível e quantos caracteres ele mostra. */
const MS_BALAO = 2200;
const MAX_BALAO = 60;

function descrever(x: number, y: number, leitura: LeituraForno, nome: string): string {
  const f = TEXTOS.cozinha.forno;
  switch (leitura.estado) {
    case 'vazio':
      return f.vazio(x, y);
    case 'assando':
      return f.assando(x, y, nome, Math.floor(leitura.fracao * 100));
    case 'pronto':
      return leitura.alerta ? f.prontoQuaseQueimando(x, y, nome) : f.pronto(x, y, nome);
    case 'queimado':
      return f.queimado(x, y, nome);
  }
}

function criarCelula(x: number, y: number): Celula {
  const raiz = el('div', (x + y) % 2 === 1 ? 'ladrilho ladrilho-escuro' : 'ladrilho');
  raiz.setAttribute('role', 'img');

  const forno = el('div', 'forno');
  const painel = el('div', 'forno-painel');
  const barra = el('span', 'forno-barra');
  barra.append(el('span', 'forno-barra-cheia'));
  painel.append(el('span', 'forno-botao'), el('span', 'forno-botao'), barra);

  const janela = el('div', 'forno-janela');
  const item = el('span', 'forno-item');
  janela.append(item, el('span', 'forno-chama', ICONES.chama));

  forno.append(painel, janela, el('span', 'forno-fumaca', ICONES.fumaca));
  raiz.append(forno, el('span', 'ladrilho-aviso', ICONES.aviso), el('span', 'ladrilho-coord', TEXTOS.cozinha.coordenada(x, y)));
  for (const filho of raiz.children) filho.setAttribute('aria-hidden', 'true');
  return { x, y, raiz, item };
}

export interface Grade {
  /** Balão de fala sobre o robô (dizer/print). O texto também vai para a lousa. */
  falar(texto: string): void;
}

export function montarGrade(alvo: HTMLElement, store: Store): Grade {
  const { dados } = store;

  // O quadro guarda as medidas (--celula, --passo…); o piso corta o robô que atravessa a borda,
  // e o balão fica fora do piso para poder aparecer acima da primeira fileira.
  const quadro = el('div', 'quadro');
  const piso = el('div', 'piso');
  piso.setAttribute('role', 'group');
  const fornos = el('div', 'fornos');
  const robo = el('div', 'robo');
  robo.setAttribute('aria-hidden', 'true');
  const corpo = el('span', 'robo-corpo chef', ICONES.robo);
  robo.append(corpo);
  const efeitos = el('div', 'efeitos');
  efeitos.setAttribute('aria-hidden', 'true');
  piso.append(fornos, robo, efeitos);
  const balao = el('div', 'balao');
  balao.setAttribute('aria-hidden', 'true');
  const balaoTexto = el('span', 'balao-texto');
  balao.append(balaoTexto);
  quadro.append(piso, balao);

  const legenda = el('p', 'legenda');
  const posicao = el('span', 'legenda-posicao');
  posicao.setAttribute('aria-live', 'polite');
  const tamanho = el('span', 'legenda-tamanho');
  legenda.append(posicao, tamanho);
  alvo.replaceChildren(quadro, legenda);

  const celulas = new Map<string, Celula>();
  const chave = (x: number, y: number) => `${x},${y}`;
  let dimensoes = '';
  let timersVolta: number[] = [];

  function construir(jogo: Jogo): void {
    const { largura, altura } = jogo.cozinha;
    const existiam = new Set(celulas.keys());
    celulas.clear();
    quadro.style.setProperty('--colunas', String(largura));
    quadro.style.setProperty('--linhas', String(altura));
    piso.setAttribute('aria-label', TEXTOS.cozinha.rotulo(largura, altura));
    tamanho.textContent = TEXTOS.cozinha.rotulo(largura, altura);
    const novas: HTMLElement[] = [];
    // A linha de cima da tela é o y mais alto: (0,0) fica no canto inferior esquerdo (SPEC §2.1).
    for (let y = altura - 1; y >= 0; y--) {
      for (let x = 0; x < largura; x++) {
        const celula = criarCelula(x, y);
        if (existiam.size > 0 && !existiam.has(chave(x, y))) {
          celula.raiz.classList.add('nova');
          celula.raiz.style.setProperty('--ordem', String(novas.length));
        }
        celulas.set(chave(x, y), celula);
        novas.push(celula.raiz);
      }
    }
    fornos.replaceChildren(...novas);
  }

  function desenharFornos(jogo: Jogo): void {
    for (const c of celulas.values()) {
      const leitura = lerForno(jogo, dados, c.x, c.y);
      const nome = leitura.produto ? (dados.produtos.find((p) => p.id === leitura.produto)?.nome ?? leitura.produto) : '';
      c.raiz.dataset.estado = leitura.estado;
      c.raiz.classList.toggle('alerta', leitura.alerta);
      c.raiz.classList.toggle('eterno', leitura.nuncaQueima);
      c.raiz.style.setProperty('--fracao', leitura.fracao.toFixed(3));
      c.raiz.setAttribute('aria-label', descrever(c.x, c.y, leitura, nome));
      const icone = leitura.produto ? (ICONES.produtos[leitura.produto] ?? ICONES.produtoDesconhecido) : '';
      if (c.item.textContent !== icone) c.item.textContent = icone;
    }
  }

  function posicionar(x: number, y: number): void {
    robo.style.setProperty('--x', String(x));
    robo.style.setProperty('--y', String(y));
  }

  /** O balão acompanha o robô dentro da cozinha; ao atravessar a borda ele some. */
  function posicionarBalao(x: number, y: number): void {
    balao.style.setProperty('--x', String(x));
    balao.style.setProperty('--y', String(y));
  }

  let timerBalao = 0;
  function falar(texto: string): void {
    const { x, y } = store.obter().jogo.robo;
    posicionarBalao(x, y);
    balaoTexto.textContent = texto.length > MAX_BALAO ? `${texto.slice(0, MAX_BALAO - 1)}…` : texto;
    repetirAnimacao(balao, 'visivel');
    window.clearTimeout(timerBalao);
    timerBalao = window.setTimeout(() => balao.classList.remove('visivel'), MS_BALAO);
  }

  function teleportar(x: number, y: number): void {
    robo.classList.add('sem-transicao');
    posicionar(x, y);
    void robo.offsetWidth;
    robo.classList.remove('sem-transicao');
  }

  function cancelarVolta(): void {
    for (const t of timersVolta) window.clearTimeout(t);
    timersVolta = [];
    robo.classList.remove('saindo', 'dando-volta');
  }

  /** Movimento simples desliza; atravessar a borda sai por um lado e entra pelo outro. */
  function moverRobo(ev: Movimento): void {
    cancelarVolta();
    if (!ev.deuVolta || prefereMenosMovimento()) {
      posicionar(ev.para.x, ev.para.y);
      return;
    }
    const [dx, dy] = PASSO[ev.direcao];
    const meio = store.obter().config.msPorTick / 2;
    balao.classList.remove('visivel');
    robo.classList.add('dando-volta', 'saindo');
    posicionar(ev.de.x + dx, ev.de.y + dy);
    timersVolta = [
      window.setTimeout(() => {
        teleportar(ev.para.x - dx, ev.para.y - dy);
        robo.classList.remove('saindo');
        posicionar(ev.para.x, ev.para.y);
      }, meio),
      window.setTimeout(() => robo.classList.remove('dando-volta'), meio * 2),
    ];
  }

  function flutuar(x: number, y: number, texto: string, classe: string): void {
    const caixa = el('span', `flutuante ${classe}`);
    caixa.style.setProperty('--x', String(x));
    caixa.style.setProperty('--y', String(y));
    const conteudo = el('span', 'flutuante-texto', texto);
    caixa.append(conteudo);
    efeitos.append(caixa);
    const remover = () => caixa.remove();
    conteudo.addEventListener('animationend', remover, { once: true });
    window.setTimeout(remover, MS_EFEITO);
  }

  // Classes de efeito saem sozinhas depois de tocar, para não cobrir as animações de estado
  // (brilho do pronto, brasa do assando), que têm a mesma especificidade no CSS.
  const timersEfeito = new Map<string, number>();
  function efeitoTemporario(elemento: HTMLElement, classe: string, id: string): void {
    window.clearTimeout(timersEfeito.get(id));
    repetirAnimacao(elemento, classe);
    timersEfeito.set(id, window.setTimeout(() => elemento.classList.remove(classe), MS_EFEITO));
  }

  function marcar(x: number, y: number, classe: string): void {
    const celula = celulas.get(chave(x, y));
    if (celula) efeitoTemporario(celula.raiz, classe, `${chave(x, y)}:${classe}`);
  }

  const trabalhar = () => efeitoTemporario(corpo, 'trabalhando', 'robo');

  function reagir(eventos: readonly Evento[]): void {
    for (const e of eventos) {
      switch (e.tipo) {
        case 'assou':
          marcar(e.x, e.y, 'recebeu');
          trabalhar();
          break;
        case 'vendeu':
          flutuar(e.x, e.y, `+${e.valor} ${ICONES.moeda}`, 'flutuante-moeda');
          trabalhar();
          break;
        case 'retirouCru':
        case 'retirouQueimado':
          marcar(e.x, e.y, 'tremendo');
          flutuar(e.x, e.y, e.tipo === 'retirouCru' ? ICONES.cru : ICONES.lixo, 'flutuante-perda');
          trabalhar();
          break;
        case 'retirouVazio':
          trabalhar();
          break;
        case 'falhou':
          marcar(e.x, e.y, 'aviso');
          break;
        case 'ficouPronto':
          marcar(e.x, e.y, 'ding');
          break;
        case 'queimou':
          marcar(e.x, e.y, 'tremendo');
          break;
        default:
          break;
      }
    }
  }

  function desenhar(estado: EstadoApp, eventos: readonly Evento[]): void {
    const { jogo, config } = estado;
    quadro.style.setProperty('--ms-tick', `${config.msPorTick}ms`);

    const agora = `${jogo.cozinha.largura}x${jogo.cozinha.altura}`;
    const mudouTamanho = agora !== dimensoes;
    if (mudouTamanho) {
      construir(jogo);
      dimensoes = agora;
    }
    desenharFornos(jogo);

    const movimento = eventos.find((e): e is Movimento => e.tipo === 'moveu');
    if (mudouTamanho) {
      cancelarVolta();
      teleportar(jogo.robo.x, jogo.robo.y);
    } else if (movimento) {
      moverRobo(movimento);
      if (!movimento.deuVolta) posicionarBalao(movimento.para.x, movimento.para.y);
    } else if (timersVolta.length === 0) {
      posicionar(jogo.robo.x, jogo.robo.y);
    }

    const textoPosicao = TEXTOS.cozinha.posicaoRobo(jogo.robo.x, jogo.robo.y);
    if (posicao.textContent !== textoPosicao) posicao.textContent = textoPosicao;
    reagir(eventos);
  }

  desenhar(store.obter(), []);
  store.subscribe(desenhar);
  return { falar };
}
