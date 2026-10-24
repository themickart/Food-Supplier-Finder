import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
  base: env.VITE_BASE_PATH || '/',
  build: { target: 'es2022', outDir: mode === 'pages' ? 'dist-pages' : 'dist' },
  plugins: [react()],
  test: { include: ['src/**/*.test.{ts,tsx}'] },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:8000', changeOrigin: false } },
  },
}})
