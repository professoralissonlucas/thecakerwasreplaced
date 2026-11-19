/// <reference types="vite/client" />
// Guarda da regra de arquitetura: src/engine/ não conhece DOM, Skulpt nem Firebase (SPEC §9.3).
import { describe, expect, it } from 'vitest';

const fontes = import.meta.glob('../../src/engine/**/*.ts', { query: '?raw', import: 'default', eager: true }) as Record<
  string,
  string
>;

describe('engine puro', () => {
  it('encontra os arquivos do engine', () => {
    expect(Object.keys(fontes).length).toBeGreaterThanOrEqual(6);
  });

  for (const [arquivo, codigo] of Object.entries(fontes)) {
    const nome = arquivo.replace('../../', '');
    it(`${nome} só importa do próprio engine e de src/data/`, () => {
      const imports = [...codigo.matchAll(/\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]/g)].map((m) => m[1] ?? m[2]);
      for (const caminho of imports) expect(caminho).toMatch(/^\.\/|^\.\.\/data\//);
    });
    it(`${nome} não usa DOM, armazenamento do navegador nem Skulpt`, () => {
      expect(codigo).not.toMatch(/\b(document|window|localStorage|sessionStorage|navigator)\s*\./);
      expect(codigo).not.toMatch(/\bSk\s*\./);
    });
  }
});
