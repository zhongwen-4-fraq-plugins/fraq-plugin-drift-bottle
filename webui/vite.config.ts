import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  build: {
    emptyOutDir: false,
    outDir: '../dist/webui',
  },
  plugins: [react()],
});
