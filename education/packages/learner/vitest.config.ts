import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // T06 writes @edu/learner but has no permission to run pnpm install, so the
    // @edu/storage workspace symlink may not exist yet. Tests consume the real
    // storage source directly; the main controller resolves the package link on
    // install and the alias remains a no-op equivalent.
    alias: {
      '@edu/storage': path.resolve(here, '../storage/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: false,
  },
});
