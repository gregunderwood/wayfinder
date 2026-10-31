const field = (name: string): Cypress.Chainable<JQuery<HTMLElement>> =>
  cy.get(`[formcontrolname="${name}"]`);

function signIn(password: string): void {
  field('email').clear().type(Cypress.env('adminEmail'));
  field('password').clear().type(password);
  cy.contains('button', 'Sign in').click();
}

describe('the admin', () => {
  it('sends a visitor to sign in, and keeps the page out of search', () => {
    cy.visit('/admin/projects');

    cy.location('pathname').should('eq', '/admin/login');
    cy.location('search').should('contain', 'returnUrl=%2Fadmin%2Fprojects');
    cy.get('meta[name="robots"]').should(
      'have.attr',
      'content',
      'noindex, nofollow',
    );
  });

  it('edits a project that the public page then shows, without a deploy', () => {
    cy.visit('/admin/login');
    signIn('not-the-password');
    cy.get('[role="alert"]').should('contain', 'do not match');
    signIn(Cypress.env('adminPassword'));
    cy.location('pathname').should('eq', '/admin/projects');

    cy.contains('a', 'Tempestas').click();
    field('slug').should('be.disabled');
    const edited = `A greenhouse controller, edited ${Date.now()}.`;
    field('tagline').clear().type(edited);
    cy.contains('button', 'Save').click();
    cy.contains('Saved.');

    cy.request('/work/tempestas').its('body').should('contain', edited);
  });

  it('refuses a taken slug, keeps a new project a draft, and deletes it', () => {
    cy.visit('/admin/login');
    signIn(Cypress.env('adminPassword'));
    cy.visit('/admin/projects/new');
    field('name').type('End-to-end draft');
    field('slug').type('lvcc');
    field('tagline').type('Temporary.');
    field('role').type('Tester');
    field('period').type('2026');
    cy.contains('button', 'Save').click();
    cy.contains('Another project uses this slug.');

    field('slug').clear().type('end-to-end-draft');
    cy.contains('button', 'Save').click();
    cy.contains('Saved.');
    cy.request({ url: '/work/end-to-end-draft', failOnStatusCode: false })
      .its('status')
      .should('eq', 404);

    cy.contains('button', 'Delete…').click();
    cy.contains('button', 'Delete for good').click();
    cy.location('pathname').should('eq', '/admin/projects');
    cy.contains('End-to-end draft').should('not.exist');

    cy.contains('button', 'Sign out').click();
    cy.location('pathname').should('eq', '/admin/login');
    cy.visit('/admin/projects');
    cy.location('pathname').should('eq', '/admin/login');
  });
});
