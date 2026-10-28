import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Not vite.config.ts: the @nx/vite plugin would infer a second build target.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/server',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'server',
    watch: false,
    globals: true,
    environment: 'node',
    globalSetup: ['src/testing/global-setup.ts'],
    restoreMocks: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/server',
      provider: 'v8',
      include: ['src/app/auth/**', 'src/app/posts/**'],
      exclude: [
        '**/*.module.ts',
        '**/*.controller.ts',
        '**/dto/**',
        '**/models.ts',
      ],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
