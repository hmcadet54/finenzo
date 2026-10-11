import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    // Integration tests share one database.
    fileParallelism: false,
    testTimeout: 20000,
  },
});
