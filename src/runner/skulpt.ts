// Carrega o Skulpt vendorizado (public/vendor/skulpt/) no navegador, uma vez só.
// O skulpt-stdlib.js também vem porque o Skulpt importa o módulo interno `sys` ao iniciar;
// qualquer import do jogador é recusado em execucao.ts.

import { skulptGlobal, type Skulpt } from './sk.ts';

const ARQUIVOS = ['vendor/skulpt/skulpt.min.js', 'vendor/skulpt/skulpt-stdlib.js'];

let carregando: Promise<Skulpt> | null = null;

function injetarScript(caminho: string): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const script = document.createElement('script');
    script.src = `${import.meta.env.BASE_URL}${caminho}`;
    script.async = false;
    script.onload = () => resolver();
    script.onerror = () => rejeitar(new Error(`Não foi possível carregar ${caminho}`));
    document.head.append(script);
  });
}

/** Devolve o Skulpt, carregando os arquivos na primeira vez. Pode ser chamado várias vezes. */
export function obterSkulpt(): Promise<Skulpt> {
  const pronto = skulptGlobal();
  if (pronto) return Promise.resolve(pronto);
  carregando ??= (async () => {
    for (const arquivo of ARQUIVOS) await injetarScript(arquivo);
    const sk = skulptGlobal();
    if (!sk) throw new Error('O Skulpt carregou, mas não criou o objeto Sk');
    return sk;
  })().catch((erro: unknown) => {
    carregando = null;
    throw erro;
  });
  return carregando;
}
