import { ProjectKind, type Project } from '@wayfinder/domain';

/**
 * Hardcoded until the CMS lands, typed against the same `Project` contract the
 * API will serve, so replacing this array with an HTTP call changes no page.
 */
export const PROJECTS: Project[] = [
  {
    slug: 'gateway',
    name: 'Gateway',
    tagline:
      'The single sign-on portal for the Sign In Solutions product suite: one login, SAML SSO, MFA and per-product access, on OAuth over AWS Cognito.',
    kind: ProjectKind.Employment,
    role: 'One of two primary developers',
    period: '2025',
    stack: ['OAuth 2.0', 'AWS Cognito', 'SAML 2.0', 'MFA'],
    docsUrl:
      'https://help.signinsolutions.com/en/articles/12694425-how-to-use-the-gateway-portal',
    featured: true,
    sortOrder: 0,
    bodyMarkdown: `
Gateway is the front door to the Sign In Solutions product suite. An organization signs in once
and reaches every product it licenses — visitor management, compliance and the rest — with the
same credentials. I was one of its two primary developers.

## What it does

- **One login across the suite.** The same credentials work in every product.
- **SAML single sign-on.** An organization's admins connect their own identity provider and
  prove they own their email domain with a DNS TXT record before it is trusted.
- **Security policy per organization**: multi-factor authentication on, off or optional, and a
  minimum password length.
- **Per-product access**, granted directly or mapped from SAML group attributes, so access can be
  managed in the customer's own identity provider.
- **User provisioning** through SSO or by hand, with each product applying its own default role.

## How it is built

An OAuth 2.0 authorization server layered over AWS Cognito. Cognito holds the identities; Gateway
adds what an enterprise suite needs on top of it — organization-level identity providers,
verified domains, security policy and product entitlements.
`,
  },
  {
    slug: 'lvcc',
    name: 'Lardeau Valley Community Centre',
    tagline:
      'A volunteer-built platform running a rural community centre: events, memberships, newsletters, governance and AI-drafted meeting minutes.',
    kind: ProjectKind.Volunteer,
    role: 'Sole developer',
    period: '2024 – present',
    stack: [
      'Angular 20 (SSR)',
      'NestJS',
      'PostgreSQL',
      'Auth0',
      'Stripe',
      'Google Cloud',
      'Claude API',
      'Docker',
    ],
    liveUrl: 'https://lvcc.ca',
    featured: true,
    sortOrder: 1,
    bodyMarkdown: `
The Lardeau Valley Community Centre is run entirely by volunteers. It needed one place to publish events, take memberships, send newsletters and keep its governance
records — without a budget for a SaaS stack, and without anyone whose job it is to run one.

## What it does

- **Events and calendar**, synchronised with the centre's Google Workspace calendars.
- **Memberships and payments** through Stripe, with Auth0 sign-in for members and the board.
- **Newsletters** composed in the app and delivered through a queued email pipeline.
- **Governance**: agreements, board nominations, operating hours and a members' forum.
- **Meeting minutes from audio.** Board meeting recordings are picked up from Google Drive,
  transcribed with Google Speech-to-Text, cleaned up, and drafted into minutes by Claude for the
  secretary to review.

## How it is built

An Nx monorepo with an Angular 20 front end rendered on the server for search and link
previews, and a NestJS API on PostgreSQL. Slow work — transcription, email delivery — runs on
Redis-backed queues so a request never waits on it. It ships as Docker images through GitHub
Container Registry, with a deploy script that keeps the previous image for one-step rollback.

The transcription pipeline is modelled as an explicit state machine — download, convert,
transcribe, clean up, draft — so a recording that fails partway can be retried from the step
that failed rather than from scratch, and is never silently dropped.
`,
  },
  {
    slug: 'tempestas',
    name: 'Tempestas',
    tagline:
      'A multi-node greenhouse controller: sensors, relays and an automation loop driving lights, fans and a propane CO₂ generator.',
    kind: ProjectKind.Personal,
    role: 'Sole developer',
    period: '2026 – present',
    stack: [
      'NestJS',
      'Angular 20',
      'PostgreSQL',
      'MQTT',
      'Python',
      'Raspberry Pi',
      'socket.io',
    ],
    featured: true,
    sortOrder: 2,
    bodyMarkdown: `
Tempestas runs a working greenhouse. Its relays switch the grow lights, the exhaust fans and a
propane CO₂ generator that doubles as the night heater — so a bug is not a broken page, it is a
lost crop or a fire.

It replaces eight years of accumulated fixes on a single Raspberry Pi (Flask and Angular 16) with
a multi-node design: a **zone** is an airspace and owns the rules, a **node** is a box of wiring,
and a **device** is a relay on a node. Adding a sensor at the far end of the greenhouse becomes
data, not code.

## Engineering for something that can burn

- **Safety rules are written down and enforced in code.** Commands are never retained on the
  MQTT broker, so a reconnect cannot replay "burner on". A node that drops makes its pins
  *unknown*, not *off*. A missing CO₂ reading is treated as "unknown", never as zero.
- **Publish first, persist on success.** The old system logged a failed relay write and updated
  the database anyway, so the UI showed a heater running when it was not.
- **Admission control.** A new node is held as *pending* until approved; it cannot announce its
  way into controlling hardware.
- **A closed-loop simulator.** A fake hardware driver models temperature and CO₂ responding to the
  burner and fans, so the entire stack — rules included — is developed and tested with no Pi and
  no relays.

## How it is built

An Nx monorepo: a NestJS API on PostgreSQL, an Angular dashboard with live updates over
socket.io, a shared typed contract library, and a Python agent on each node talking MQTT.
Decision logic is pure functions with time passed in, which is what makes the daylight-saving
and cooldown boundaries testable to the second.
`,
  },
  {
    slug: 'wayfinder',
    name: 'Wayfinder',
    tagline:
      'This site: a server-rendered Angular portfolio with its own NestJS CMS, built in the open as a working sample.',
    kind: ProjectKind.Personal,
    role: 'Sole developer',
    period: '2026 – present',
    stack: ['Angular 20 (SSR)', 'NestJS', 'PostgreSQL', 'Nx', 'Vitest'],
    featured: false,
    sortOrder: 3,
    bodyMarkdown: `
The site you are reading. Every public page is prerendered on the server, so it loads as plain
HTML and previews properly when shared. There is no CSS framework and no web font; the whole
design is a few kilobytes of hand-written styles.

## Built with AI agents, held to a human bar

Wayfinder is built the way I now build everything: AI coding agents do much of the typing, and
the repository is set up so they do it well. An \`AGENTS.md\` routes each kind of change to the
document that governs it; lint rules make the architecture impossible to violate quietly; and
nothing is done until lint, tests and production builds all pass.

## What is next

A NestJS and PostgreSQL CMS behind a single-user admin — projects, a blog with scheduled
publishing, and moderated testimonials — arriving underneath the site rather than holding it up.
`,
  },
];

export function findProject(slug: string): Project | undefined {
  return PROJECTS.find((project) => project.slug === slug);
}

export function projectsInOrder(): Project[] {
  return [...PROJECTS].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
}

export const PROJECT_KIND_LABELS: Record<ProjectKind, string> = {
  [ProjectKind.Employment]: 'Professional',
  [ProjectKind.Volunteer]: 'Volunteer',
  [ProjectKind.Personal]: 'Personal',
};
