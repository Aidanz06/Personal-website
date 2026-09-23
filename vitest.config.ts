import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Every test targets pure logic in lib/, so the default node
    // environment is enough — no jsdom, no React test renderer.
    environment: 'node',
    include: ['lib/**/*.test.ts'],
    // No pure logic exists until the ASCII renderer lands in milestone 3.
    passWithNoTests: true,
  },
})
