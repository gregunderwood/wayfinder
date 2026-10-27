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
    // Synthesizing a stack bundles the CDK construct tree; the default 5 s is
    // tight on a cold run.
    testTimeout: 30_000,
  },
});
