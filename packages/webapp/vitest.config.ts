import path from 'node:path';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

function stubStyles(): Plugin {
  return {
    name: 'stub-styles',
    enforce: 'pre',
    resolveId(source) {
      if (source.endsWith('.scss') || source.endsWith('.css')) {
        return `\0${source}`;
      }
      return null;
    },
    load(id) {
      if (
        id.startsWith('\0') &&
        (id.endsWith('.scss') || id.endsWith('.css'))
      ) {
        return 'export default {}';
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [stubStyles()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/**/*.spec.ts',
      'src/**/*.spec.tsx',
      'test/**/*.spec.ts',
      'test/**/*.spec.tsx',
    ],
  },
});
