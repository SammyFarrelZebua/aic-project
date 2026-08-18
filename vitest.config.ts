import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The `tests/` directory is reserved for Playwright E2E specs.
    // Vitest unit tests live alongside their modules in `lib/` and `utils/`.
    include: ['lib/**/*.test.ts', 'utils/**/*.test.ts', 'app/**/*.test.ts', 'components/**/*.test.ts'],
    exclude: ['tests/**', 'node_modules/**'],
  },
})
