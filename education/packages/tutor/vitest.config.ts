import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    // T07 cannot run `pnpm install` (workspace lock is owned by the controller),
    // so the @edu/knowledge and @edu/learner links may not exist yet. Tests and
    // typecheck consume the accepted workspace sources directly; after the
    // controller installs, the links resolve to the same entry files.
    alias: {
      '@edu/domain': path.resolve(here, '../domain/src/index.ts'),
      '@edu/knowledge': path.resolve(here, '../knowledge/src/index.ts'),
      '@edu/learner': path.resolve(here, '../learner/src/index.ts'),
      '@edu/storage': path.resolve(here, '../storage/src/index.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    passWithNoTests: false,
    testTimeout: 20000,
  },
});
