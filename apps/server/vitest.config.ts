import { defineConfig } from 'vite';
import { nxViteTsPaths } from '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Named vitest.config.ts rather than vite.config.ts so the @nx/vite plugin does
// not also infer a `build` target here - the server is built by webpack.
export default defineConfig({
  root: __dirname,
  cacheDir: '../../node_modules/.vite/apps/server',
  plugins: [nxViteTsPaths()],
  test: {
    name: 'server',
    watch: false,
    globals: true,
    environment: 'node',
    // Nothing here yet; without this the empty suite fails the gate before the
    // first module lands.
    passWithNoTests: true,
    include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: '../../coverage/apps/server',
      provider: 'v8',
      // The two places a bug is a security hole or lost writing: the admin
      // login and the content that is the whole point of the site. Broad by
      // directory so new files are measured the day they land.
      include: ['src/app/auth/**', 'src/app/posts/**'],
      // Wiring, not decisions. Counting controllers, DTOs and entities would
      // make the number describe boilerplate volume instead of whether the
      // token and publishing logic is tested.
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
