import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  publicDir: 'public',
  devToolbar: { enabled: false },
  build: {
    outDir: 'dist'
  },
  vite: {
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:4000',
          changeOrigin: true
        }
      }
    }
  }
});