import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const apiTarget = process.env.API_URL || 'http://127.0.0.1:4000';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
      '/robots.txt': { target: apiTarget, changeOrigin: true },
      '/sitemap.xml': { target: apiTarget, changeOrigin: true },
      '/uploads': { target: apiTarget, changeOrigin: true },
    },
  },
  preview: { host: '0.0.0.0', port: 5173, allowedHosts: true },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    // Vite splits the lazy-loaded exam, result and admin pages automatically.
    // Keep the framework runtime and the icon set in their own long-lived
    // chunks so an app edit does not invalidate the largest cached assets.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]node_modules[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return 'react-vendor';
          if (id.includes('lucide-react')) return 'icons';
          return undefined;
        },
      },
    },
  },
});
