import { defineConfig } from 'cypress';

// The compose stack, with an admin made by `create-admin` using these CI- and local-only credentials.
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
