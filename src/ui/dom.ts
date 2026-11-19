// Helpers mínimos de DOM. Texto sempre via textContent (nunca innerHTML com dado do jogo).

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classe?: string,
  texto?: string,
): HTMLElementTagNameMap[K] {
  const elemento = document.createElement(tag);
  if (classe) elemento.className = classe;
  if (texto !== undefined) elemento.textContent = texto;
  return elemento;
}

/** Reinicia uma animação CSS de classe (tira, força o reflow e põe de novo). */
export function repetirAnimacao(elemento: HTMLElement, classe: string): void {
  elemento.classList.remove(classe);
  void elemento.offsetWidth;
  elemento.classList.add(classe);
}

export function prefereMenosMovimento(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
