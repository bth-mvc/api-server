import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    env: {
      ADMIN_TOKEN: 'test-admin-token',
      SERVICE_TOKEN: 'test-service-token',
    },
  },
})
