// Editor de código: CodeMirror 6 com Python, numeração e marcas de linha
// (a que está rodando agora e a do último erro).

import { Compartment, EditorState, Prec, StateEffect, StateField } from '@codemirror/state';
import { Decoration, EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers, type DecorationSet } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { bracketMatching, HighlightStyle, indentOnInput, indentUnit, syntaxHighlighting } from '@codemirror/language';
import { python } from '@codemirror/lang-python';
import { tags as t } from '@lezer/highlight';

export type TipoMarca = 'executando' | 'erro';

export interface Editor {
  texto(): string;
  /** Marca uma linha (1 = primeira) ou tira a marca com null. */
  marcar(tipo: TipoMarca, linha: number | null): void;
  somenteLeitura(sim: boolean): void;
}

export interface OpcoesEditor {
  inicial: string;
  rotulo: string;
  aoExecutar(): void;
  aoParar(): void;
}

const definirMarca = StateEffect.define<{ tipo: TipoMarca; linha: number | null }>();

function campoDeMarca(tipo: TipoMarca) {
  const decoracao = Decoration.line({ class: `cm-linha-${tipo}` });
  return StateField.define<DecorationSet>({
    create: () => Decoration.none,
    update(marcas, tr) {
      // Mexer no código apaga a marca de erro (a linha pode nem existir mais).
      let atual = tr.docChanged ? (tipo === 'erro' ? Decoration.none : marcas.map(tr.changes)) : marcas;
      for (const efeito of tr.effects) {
        if (!efeito.is(definirMarca) || efeito.value.tipo !== tipo) continue;
        const { linha } = efeito.value;
        const valida = linha !== null && linha >= 1 && linha <= tr.state.doc.lines;
        atual = valida ? Decoration.set([decoracao.range(tr.state.doc.line(linha).from)]) : Decoration.none;
      }
      return atual;
    },
    provide: (campo) => EditorView.decorations.from(campo),
  });
}

// Cores da padaria: palavras do Python em mel, textos em pistache, números em morango.
const destaque = HighlightStyle.define([
  { tag: [t.keyword, t.controlKeyword, t.definitionKeyword, t.moduleKeyword], color: 'var(--mel)', fontWeight: '600' },
  { tag: [t.bool, t.null], color: 'var(--sintaxe-logico)' },
  { tag: [t.string], color: 'var(--sintaxe-texto)' },
  { tag: [t.number], color: 'var(--sintaxe-numero)' },
  { tag: [t.comment], color: 'var(--sintaxe-comentario)', fontStyle: 'italic' },
  { tag: [t.operator, t.compareOperator, t.logicOperator, t.arithmeticOperator], color: 'var(--sintaxe-operador)' },
  { tag: [t.function(t.variableName), t.function(t.propertyName)], color: 'var(--sintaxe-funcao)' },
  { tag: [t.definition(t.variableName), t.definition(t.function(t.variableName))], color: 'var(--esmalte)', fontWeight: '600' },
  { tag: [t.variableName, t.propertyName], color: 'var(--farinha)' },
  { tag: [t.punctuation, t.paren, t.bracket], color: 'var(--farinha-2)' },
]);

const tema = EditorView.theme(
  {
    '&': { color: 'var(--farinha)', backgroundColor: 'transparent', fontSize: '1rem' },
    '.cm-content': { caretColor: 'var(--mel)', padding: '12px 0' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--mel)', borderLeftWidth: '2px' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--sintaxe-selecao) !important' },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--sintaxe-margem)', border: 'none' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--mel)' },
    '.cm-matchingBracket': { backgroundColor: 'var(--cacau-3)', outline: '1px solid var(--cobre)' },
  },
  { dark: true },
);

export function criarEditor(alvo: HTMLElement, opcoes: OpcoesEditor): Editor {
  const leitura = new Compartment();
  const atalhos = Prec.highest(
    keymap.of([
      { key: 'Mod-Enter', run: () => (opcoes.aoExecutar(), true) },
      { key: 'Mod-Shift-Enter', run: () => (opcoes.aoParar(), true) },
    ]),
  );

  const view = new EditorView({
    parent: alvo,
    state: EditorState.create({
      doc: opcoes.inicial,
      extensions: [
        atalhos,
        lineNumbers(),
        highlightActiveLineGutter(),
        history(),
        drawSelection(),
        indentOnInput(),
        bracketMatching(),
        indentUnit.of('    '),
        EditorState.tabSize.of(4),
        python(),
        syntaxHighlighting(destaque),
        tema,
        campoDeMarca('executando'),
        campoDeMarca('erro'),
        leitura.of(EditorState.readOnly.of(false)),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.contentAttributes.of({ 'aria-label': opcoes.rotulo }),
      ],
    }),
  });

  return {
    texto: () => view.state.doc.toString(),
    marcar(tipo, linha) {
      const efeitos: StateEffect<unknown>[] = [definirMarca.of({ tipo, linha })];
      if (linha !== null && linha >= 1 && linha <= view.state.doc.lines) {
        efeitos.push(EditorView.scrollIntoView(view.state.doc.line(linha).from, { y: 'nearest' }));
      }
      view.dispatch({ effects: efeitos });
    },
    somenteLeitura(sim) {
      view.dispatch({ effects: leitura.reconfigure(EditorState.readOnly.of(sim)) });
    },
  };
}
