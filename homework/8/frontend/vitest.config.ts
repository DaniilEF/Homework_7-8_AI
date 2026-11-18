import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['./tests/setup.ts'],
    env: { VITE_ITEMS_WEBHOOK_URL: 'https://validator.test/items' },
    restoreMocks: true,
    unstubEnvs: true,
    testTimeout: 10000,
  },
})
