import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const target = 'http://127.0.0.1:8080';
export default defineConfig({ plugins: [react()], base: '/admin/', server: { proxy: {
  '/api': { target, changeOrigin: true, configure(proxy) {
    // Development-only same-origin proxy; the production binary still checks Origin/Host.
    proxy.on('proxyReq', request => request.setHeader('Origin', target));
  } },
} } });
