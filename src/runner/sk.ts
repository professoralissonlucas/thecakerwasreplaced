// Tipos mínimos da API do Skulpt 1.2.0 que o projeto usa (o Skulpt não traz tipos).
// O objeto `Sk` é global: vem de public/vendor/skulpt/skulpt.min.js.

/** Objeto Python qualquer. */
export interface PyObjeto {
  tp$name?: string;
  v?: unknown;
}

export interface PySuspensao {
  data: { type: string; promise?: Promise<unknown> };
  child?: PySuspensao;
  $lineno?: number;
  $filename?: string;
  optional?: boolean;
}

/** Exceção Python lançada pelo Skulpt. */
export interface PyExcecao extends PyObjeto {
  tp$name: string;
  args: { v: PyObjeto[] };
  traceback?: { lineno: number; colno: number; filename: string }[];
  /** Só em ExternalError: o erro JavaScript original. */
  nativeError?: unknown;
}

type ConstrutorExcecao = new (mensagem: string) => PyExcecao;

export interface Skulpt {
  python3: unknown;
  builtins: Record<string, PyObjeto | undefined>;
  builtinFiles?: { files: Record<string, string> };
  configure(opcoes: Record<string, unknown>): void;
  importMainWithBody(nome: string, mostrarJs: boolean, corpo: string, podeSuspender: boolean): unknown;
  misceval: {
    asyncToPromise(
      fn: () => unknown,
      handlers: Record<string, (s: PySuspensao) => Promise<unknown> | undefined>,
    ): Promise<unknown>;
    promiseToSuspension(promessa: Promise<PyObjeto>): PyObjeto;
  };
  builtin: {
    func: new (fn: (...args: PyObjeto[]) => PyObjeto) => PyObjeto;
    str: new (valor: string | PyObjeto) => PyObjeto & { v: string };
    int_: new (valor: number) => PyObjeto;
    bool: { true$: PyObjeto; false$: PyObjeto };
    none: { none$: PyObjeto };
    BaseException: abstract new (...args: never[]) => PyExcecao;
    TypeError: ConstrutorExcecao;
    ValueError: ConstrutorExcecao;
    ImportError: ConstrutorExcecao;
  };
}

/** O Skulpt carregado (ou `undefined` se o script ainda não chegou). */
export function skulptGlobal(): Skulpt | undefined {
  return (globalThis as { Sk?: Skulpt }).Sk;
}
