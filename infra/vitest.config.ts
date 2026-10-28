import { defineConfig } from 'vite';

export default defineConfig({
  root: __dirname,
  cacheDir: '../node_modules/.vite/infra',
  test: {
    name: 'infra',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['lib/**/*.spec.ts'],
    reporters: ['default'],
    // Synthesizing the stacks on a cold run can exceed the default 5 s.
    testTimeout: 30_000,
  },
});
