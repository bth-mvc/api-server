import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      ADMIN_TOKEN: 'test-admin-token',
      SERVICE_TOKEN: 'test-service-token',
    },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text', 'lcov', 'html'],
    },
  },
})
