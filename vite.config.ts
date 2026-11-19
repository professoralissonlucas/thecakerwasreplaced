import { defineConfig } from 'vitest/config';

export default defineConfig({
  // GitHub Pages serve o site em https://<usuario>.github.io/<nome-do-repo>/
  base: '/thecakerwasreplaced/',
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
