const ADMIN_BAR = 'aside[aria-label="Admin"]';

describe('admin shortcuts on the public site', () => {
  it('asks the API nothing for a visitor, and offers the sign-in link', () => {
    cy.intercept('/api/auth/**').as('auth');

    cy.visit('/work/tempestas');
    cy.get('footer')
      .contains('a', 'Admin sign in')
      .should('have.attr', 'rel', 'nofollow');
    cy.get(ADMIN_BAR).should('not.exist');
    cy.contains('Edit this project').should('not.exist');
    // eslint-disable-next-line cypress/no-unnecessary-waiting -- proving an absence takes time
    cy.wait(500);
    cy.get('@auth.all').should('have.length', 0);
  });

  it('follows the admin around the site until they sign out', () => {
    cy.visit('/work/tempestas');
    cy.get('footer').contains('a', 'Admin sign in').click();
    cy.get('[formcontrolname="email"]').type(Cypress.env('adminEmail'));
    cy.get('[formcontrolname="password"]').type(Cypress.env('adminPassword'));
    cy.contains('button', 'Sign in').click();
    cy.location('pathname').should('eq', '/admin/projects');

    cy.visit('/work/tempestas');
    cy.get(ADMIN_BAR).should(
      'contain',
      `Signed in as ${Cypress.env('adminEmail')}`,
    );
    cy.get('footer').should('not.contain', 'Admin sign in');
    cy.contains('a', 'Edit this project').click();
    cy.get('[formcontrolname="name"]').should('have.value', 'Tempestas');

    cy.visit('/work');
    cy.get(ADMIN_BAR).contains('button', 'Sign out').click();
    cy.get(ADMIN_BAR).should('not.exist');
    cy.location('pathname').should('eq', '/work');
    cy.getCookie('wf_signed_in').should('be.null');
    cy.reload();
    cy.get('footer').should('contain', 'Admin sign in');
  });
});
