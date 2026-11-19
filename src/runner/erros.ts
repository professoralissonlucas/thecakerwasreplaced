// Tradução dos erros do Python para português simples, com a linha (SPEC §5.4).

import { comandosLiberados, type Dados, type Jogo } from '../engine/index.ts';
import { ICONES, TEXTOS } from '../ui/textos.ts';
import { ehAmigavel } from './comandos.ts';
import type { PyExcecao, Skulpt } from './sk.ts';

export interface ErroAmigavel {
  texto: string;
  linha: number | null;
  icone: string;
}

const E = TEXTOS.erros;

function distancia(a: string, b: string): number {
  const linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let anterior = linha[0]!;
    linha[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const guardado = linha[j]!;
      linha[j] = Math.min(linha[j]! + 1, linha[j - 1]! + 1, anterior + (a[i - 1] === b[j - 1] ? 0 : 1));
      anterior = guardado;
    }
  }
  return linha[b.length]!;
}

/** Nome liberado mais parecido (erro de digitação, maiúscula trocada), ou null. */
function sugerir(nome: string, conhecidos: Iterable<string>): string | null {
  let melhor: string | null = null;
  let menor = Infinity;
  for (const conhecido of conhecidos) {
    const d = conhecido.toLowerCase() === nome.toLowerCase() ? 0 : distancia(nome, conhecido);
    if (d < menor) {
      menor = d;
      melhor = conhecido;
    }
  }
  return melhor !== null && menor <= Math.max(1, Math.floor(nome.length / 4)) ? melhor : null;
}

function unlockQueLibera(dados: Dados, nome: string): string | null {
  const unlock = dados.unlocks.find((u) => u.efeitos.some((e) => e.tipo === 'comandos' && e.nomes.includes(nome)));
  return unlock?.nome ?? null;
}

const recuoDe = (linha: string) => linha.length - linha.trimStart().length;

/**
 * O Skulpt avisa recuo errado como SyntaxError "bad input". Olhando a linha anterior dá para
 * separar os dois casos mais comuns: faltou recuar depois de ":" ou recuou sem ter ":".
 */
function pareceRecuo(codigo: string, numeroLinha: number): boolean {
  const linhas = codigo.split('\n');
  const atual = linhas[numeroLinha - 1];
  if (atual === undefined || atual.trim() === '') return false;
  let i = numeroLinha - 2;
  while (i >= 0 && linhas[i]!.trim() === '') i--;
  if (i < 0) return recuoDe(atual) > 0;
  const anterior = linhas[i]!;
  const abriuBloco = anterior.trimEnd().endsWith(':');
  return abriuBloco ? recuoDe(atual) <= recuoDe(anterior) : recuoDe(atual) > recuoDe(anterior);
}

export function traduzirErro(sk: Skulpt, erro: unknown, codigo: string, jogo: Jogo, dados: Dados): ErroAmigavel {
  if (!(erro instanceof sk.builtin.BaseException)) {
    return { texto: String(erro), linha: null, icone: ICONES.linhas.erro };
  }
  const excecao = erro as PyExcecao;
  const linha = excecao.traceback?.[0]?.lineno ?? null;
  const original = String(excecao.args?.v?.[0]?.v ?? '');
  const comLinha = (texto: string) => (linha === null ? texto : E.naLinha(linha, texto));
  const resposta = (texto: string, icone: string = ICONES.linhas.erro): ErroAmigavel => ({ texto: comLinha(texto), linha, icone });

  if (ehAmigavel(excecao)) return resposta(original);

  switch (excecao.tp$name) {
    case 'NameError': {
      const nome = /name '(.+?)' is not defined/.exec(original)?.[1];
      if (!nome) break;
      const liberados = comandosLiberados(jogo, dados);
      const unlock = unlockQueLibera(dados, nome);
      if (unlock && !liberados.has(nome)) return resposta(E.trancado(nome, unlock), ICONES.trancado);
      const sugestao = sugerir(nome, [...liberados, 'print']);
      return resposta(sugestao ? E.naoConheceSugestao(nome, sugestao) : E.naoConhece(nome));
    }
    case 'SyntaxError':
    case 'IndentationError':
    case 'TabError':
      return resposta(linha !== null && pareceRecuo(codigo, linha) ? E.recuo : E.sintaxe);
    case 'ImportError':
    case 'ModuleNotFoundError':
      return resposta(E.semImport, ICONES.proibido);
    case 'ZeroDivisionError':
      return resposta(E.divisaoPorZero);
    default:
      break;
  }
  return resposta(E.generico(excecao.tp$name, original));
}
