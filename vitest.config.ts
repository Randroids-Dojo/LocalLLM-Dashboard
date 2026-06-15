import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  ssr: {
    // VibeKit ships raw .ts; let vite transform it instead of node importing it.
    noExternal: ['@randroids-dojo/vibekit'],
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
