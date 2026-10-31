import { defineConfig } from 'cypress';

// The production images behind Caddy, as `docker compose up` runs them, with an admin made by
// `create-admin`. These credentials exist only in CI and local stacks.
export default defineConfig({
  e2e: {
    baseUrl: 'https://localhost',
    specPattern: 'src/**/*.cy.ts',
    supportFile: 'src/support/e2e.ts',
    fixturesFolder: 'src/fixtures',
    screenshotsFolder: '../../dist/cypress/web-e2e/stack/screenshots',
    video: false,
    env: {
      adminEmail: 'admin@example.com',
      adminPassword: 'ci-only-admin-password',
    },
  },
});
