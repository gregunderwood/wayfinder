const field = (name: string): Cypress.Chainable<JQuery<HTMLElement>> =>
  cy.get(`[formcontrolname="${name}"]`);

function submitSignIn(password: string): void {
  field('email').clear().type(Cypress.env('adminEmail'));
  field('password').clear().type(password);
  cy.contains('button', 'Sign in').click();
}

// One sign-in shared by the tests: the API allows five a minute.
function signIn(): void {
  cy.session('admin', () => {
    cy.visit('/admin/login');
    submitSignIn(Cypress.env('adminPassword'));
    cy.location('pathname').should('eq', '/admin/projects');
  });
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

  it('refuses a wrong password', () => {
    cy.visit('/admin/login');
    submitSignIn('not-the-password');

    cy.get('[role="alert"]').should('contain', 'do not match');
    cy.location('pathname').should('eq', '/admin/login');
  });

  it('edits a project that the public page then shows, without a deploy', () => {
    signIn();
    cy.visit('/admin/projects');
    cy.contains('a', 'Tempestas').click();
    field('slug').should('be.disabled');
    field('tagline')
      .invoke('val')
      .then((original) => {
        const edited = `A greenhouse controller, edited ${Date.now()}.`;
        field('tagline').clear().type(edited);
        cy.contains('button', 'Save').click();
        cy.contains('Saved.');

        cy.request('/work/tempestas').its('body').should('contain', edited);

        cy.intercept('PATCH', '/api/admin/projects/*').as('restore');
        field('tagline')
          .clear()
          .type(String(original), { parseSpecialCharSequences: false });
        cy.contains('button', 'Save').click();
        cy.wait('@restore').its('response.statusCode').should('eq', 200);
      });
  });

  it('refuses a taken slug, keeps a new project a draft, and deletes it', () => {
    const slug = `end-to-end-draft-${Date.now()}`;
    signIn();
    cy.visit('/admin/projects/new');
    field('name').type(slug);
    field('slug').type('lvcc');
    field('tagline').type('Temporary.');
    field('role').type('Tester');
    field('period').type('2026');
    cy.contains('button', 'Save').click();
    cy.contains('Another project uses this slug.');

    field('slug').clear().type(slug);
    cy.contains('button', 'Save').click();
    cy.contains('Saved.');
    cy.request({ url: `/work/${slug}`, failOnStatusCode: false })
      .its('status')
      .should('eq', 404);

    cy.contains('button', 'Delete…').click();
    cy.contains('button', 'Delete for good').click();
    cy.location('pathname').should('eq', '/admin/projects');
    cy.contains(slug).should('not.exist');

    cy.contains('button', 'Sign out').click();
    cy.location('pathname').should('eq', '/admin/login');
    cy.visit('/admin/projects');
    cy.location('pathname').should('eq', '/admin/login');
  });
});
