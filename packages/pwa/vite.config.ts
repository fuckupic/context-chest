import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/v1': {
        target: `http://localhost:${process.env.API_PORT ?? '3002'}`,
        changeOrigin: true,
      },
    },
  },
});
