import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The engine and providers are deterministic by design: same input,
    // same output, every run. Any flake here is a real bug, not a retry.
    retry: 0,
  },
});
