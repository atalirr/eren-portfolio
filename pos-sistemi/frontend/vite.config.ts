import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/store': path.resolve(__dirname, './src/store'),
    },
  },
  server: {
    port: 5174,
    strictPort: true, // Her zaman 5174 kullan, meşgulse hata ver (Electron 5174 bekliyor)
    fs: {
      strict: false,
      allow: ['..'],
    },
    proxy: {
      // Dev ortamında backend API isteklerini aynı origin üzerinden geçir (CORS engelini kaldırır)
      '/api': {
        target: 'http://127.0.0.1:14532',
        changeOrigin: true,
        secure: false,
      },
      // Dev ortamında n8n webhook CORS sorununu çözer:
      // Frontend -> /n8n/... -> Vite proxy -> http://localhost:5678/...
      '/n8n': {
        target: 'http://localhost:5678',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p.replace(/^\/n8n/, ''),
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
})

