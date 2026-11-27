import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    maxWorkers: 2,
    setupFiles: './src/test-setup.js',
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.{js,jsx}'],
      exclude: ['src/**/*.test.{js,jsx}', 'src/main.jsx'],
      thresholds: {
        lines: 75,
        statements: 75,
        branches: 75,
        functions: 75,
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy ke Application API
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      // Proxy untuk gambar sampul di public/upload dan template di public/template backend
      '/upload': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/template': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
      '/public': {
        target: 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
})
