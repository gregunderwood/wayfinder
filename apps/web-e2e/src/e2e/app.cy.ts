// Every public route renders its own heading and is reachable from the
// primary navigation. Admin routes join this suite with the three-case
// visibility template once authentication exists.
const PAGES = [
  { path: '/', heading: /full-stack software engineer/i },
  { path: '/work', heading: /things i’ve built/i },
  { path: '/work/lvcc', heading: /lardeau valley community centre/i },
  { path: '/about', heading: /a generalist, on purpose/i },
  { path: '/resume', heading: /greg underwood/i },
];

describe('public pages', () => {
  for (const page of PAGES) {
    it(`renders ${page.path}`, () => {
      cy.visit(page.path);
      cy.get('h1').invoke('text').should('match', page.heading);
      cy.get('link[rel="canonical"]')
        .should('have.attr', 'href')
        .and('contain', 'underwoodstyles.ca');
    });
  }

  it('navigates between pages from the header', () => {
    cy.visit('/');
    cy.get('nav[aria-label="Primary"]').contains('a', 'Work').click();
    cy.location('pathname').should('eq', '/work');
    cy.get('nav[aria-label="Primary"] a[aria-current="page"]').should(
      'contain',
      'Work',
    );
  });

  it('shows a not-found page for unknown routes', () => {
    cy.visit('/no-such-page', { failOnStatusCode: false });
    cy.get('h1').should('contain', 'Page not found');
  });
});
