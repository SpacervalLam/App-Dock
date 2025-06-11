// vite.config.js
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { resolve } from 'path';

export default defineConfig({
  root: 'src/renderer',
  base: './',
  publicDir: resolve(__dirname, 'src/renderer/public'),
  plugins: [
    vue(),
  ],
  assetsInclude: ['**/*.wasm'],
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
    assetsDir: '_assets',
    rollupOptions: {
      input: resolve(__dirname, 'src/renderer/index.html'),
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src/renderer'),
    },
  },
  server: {
    port: 3506,
    host: 'localhost',
    strictPort: false,
  },
});
