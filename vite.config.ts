import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' — чтобы сборку можно было открыть с любого пути (GitHub Pages, артефакт, локальный сервер)
export default defineConfig({
  base: './',
  plugins: [react()],
  server: { port: 5173, host: true },
  build: { target: 'es2020', assetsInlineLimit: 0, chunkSizeWarningLimit: 900 },
});
