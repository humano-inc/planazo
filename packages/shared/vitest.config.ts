import { defineConfig } from 'vitest/config';

/**
 * One process for the whole suite.
 *
 * Splitting plan-logic.ts by topic (PLA-113) turned one test file into five,
 * and vitest's default is a forked child process per file with isolation
 * between them. That is five process setups for tests that execute in about
 * 20ms total, and it cost more than the split saved.
 *
 * Isolation buys nothing here: every subject is a pure function, there is no
 * database, no global state and no module-level mutation to leak from one file
 * into the next. If that ever stops being true, delete this file rather than
 * working around it.
 */
export default defineConfig({
  test: {
    isolate: false,
    poolOptions: { forks: { singleFork: true } },
  },
});
