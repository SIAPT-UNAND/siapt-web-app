import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['src/**/*.js'],
      exclude: ['src/**/*.test.js', 'src/server.js'],
      thresholds: {
        lines: 75,
        statements: 75,
        branches: 75,
        functions: 75,
      },
    },
  },
});
