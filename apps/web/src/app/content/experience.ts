/**
 * Résumé content. Hardcoded until the CMS lands; it is read by the résumé page
 * and nowhere else, so its shape is local to the web app rather than shared.
 */
export interface Role {
  company: string;
  /** Former names or acquirers, shown after the company. */
  companyNote?: string;
  title: string;
  location: string;
  period: string;
  summary: string;
  highlights: string[];
}

export interface EarlierRole {
  company: string;
  period: string;
  line: string;
}

export interface Education {
  school: string;
  credential?: string;
  period: string;
}

export const ROLES: Role[] = [
  {
    company: 'Sign In Solutions',
    companyNote: 'formerly Traction Guest',
    title: 'Senior Full-Stack Software Engineer',
    location: 'Burnaby, BC · Remote',
    period: 'Feb 2019 – 2026',
    summary:
      'Lead developer on an enterprise visitor-management platform, owning features from architecture and proof of concept through CI, testing and living documentation.',
    highlights: [
      'Built an OAuth 2.0 authorization server on top of AWS Cognito, giving the product suite one sign-in.',
      'Designed asynchronous service-to-service messaging on AWS SNS topics and SQS queues.',
      'Worked on the access control integration, connecting visitor management to physical access systems.',
      'Drove AI adoption across the organization: wiring AI into products, documentation and developer environments.',
      'Led the AngularJS → Angular migration with a progressive micro-frontend architecture, moving the build from Grunt to webpack and onto an Nx monorepo.',
      'Architected the embedded Sisense analytics integration: a Ruby API client, JWT single sign-on, and a multi-tenant microservice so many instances shared one reporting server.',
      'Built the Angular front end for “Sparks” workflow triggers, including an architecture for deeply nested dynamic forms.',
      'Became the authentication subject-matter expert: OAuth 2.0, shared sessions across AngularJS and Angular, and per-domain SAML.',
    ],
  },
  {
    company: 'BMC Software',
    companyNote: 'acquired Partnerpedia',
    title: 'Staff Product Developer',
    location: 'Vancouver, BC',
    period: 'Jan 2013 – Feb 2019',
    summary:
      'Joined Partnerpedia as an intermediate developer six months before the BMC acquisition and grew into the lead developer for every Marketplace product.',
    highlights: [
      'Maintained white-label Rails marketplaces for VMware, Cisco, Avaya and Citrix, with Solr and Sphinx search, Salesforce data sync and Cisco SSO.',
      'Took over the BMC Marketplace in 2014 and, with a team of two to three, replaced a custom Closure-based front-end framework and an unnecessary microservice split.',
      'Rewrote the API and delivered the storefront and admin as one modular Angular 6 application with prerendering and lazy-loaded modules — on a maintenance budget.',
    ],
  },
  {
    company: 'Spruik',
    title: 'Lead Software Developer (contract)',
    location: 'Vancouver, BC',
    period: 'Mar 2012 – Dec 2012',
    summary:
      'Built the proof of concept for a referral-sharing app with micropayments, from start to demo in five months.',
    highlights: [
      'Rails API with a mobile-first Backbone.js front end on Foundation, built heavily on the Google Maps APIs.',
    ],
  },
];

export const EARLIER_ROLES: EarlierRole[] = [
  {
    company: 'Officepools',
    period: '2010 – 2011',
    line: 'Performance and features for a high-traffic Django/PostgreSQL hockey-pool platform through peak season.',
  },
  {
    company: 'Xomo Digital',
    period: '2009 – 2010',
    line: 'Designed and built the BlackBerry event guide promoted as the official guide to the Vancouver 2010 Olympic Games.',
  },
  {
    company: 'Blast Radius',
    period: '2009',
    line: 'Back end for the Starbucks VIA launch site in .NET MVC, against a four-week deadline.',
  },
  {
    company: 'Consensus Medical Systems',
    period: '2009',
    line: 'Started the web rewrite of a vascular-study system with NHibernate and Silverlight.',
  },
  {
    company: 'Resilience Software',
    period: '2005 – 2009',
    line: 'Medical activity tracking on C#/ASP.NET and Python/TurboGears, with sync protocols for Palm, Pocket PC and BlackBerry clients.',
  },
];

export const EDUCATION: Education[] = [
  {
    school: 'British Columbia Institute of Technology',
    credential: 'Diploma, Computer Systems Technology — Client/Server Systems',
    period: '2004 – 2006',
  },
  {
    school: 'University College of the Cariboo',
    period: '2001 – 2004',
  },
];
