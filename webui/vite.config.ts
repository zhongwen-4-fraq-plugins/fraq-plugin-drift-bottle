import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

import { readFileSync } from 'node:fs';

const packageMetadata = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: false,
    outDir: '../dist/webui',
  },
  define: {
    __PLUGIN_VERSION__: JSON.stringify(packageMetadata.version),
  },
  plugins: [react()],
});
