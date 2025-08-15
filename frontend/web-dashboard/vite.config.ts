import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3002,
    open: false,  // 서버 환경에서 브라우저 자동 열기 비활성화
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
}); 