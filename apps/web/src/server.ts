import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ProjectSummary } from '@wayfinder/domain';
import { INTERNAL_API_TIMEOUT_MS } from './app/core/internal-api.backend';
import { RETRY_AFTER_SECONDS } from './app/core/page-data';
import { buildSitemap, listSitemapPaths } from './app/core/sitemap';
import { INTERNAL_API_URL_FROM_ENV } from './internal-api-url';

const DEFAULT_PORT = 4000;

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
app.disable('x-powered-by');
// Caddy overwrites any client X-Forwarded-*; untrusted, Angular falls back to
// client rendering and every 404 behind the proxy becomes a soft 200.
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: [
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host',
  ],
});

// A sitemap missing every project would tell search engines they are gone; 503 says come back.
app.get('/sitemap.xml', async (_request, response) => {
  try {
    const slugs = await fetchPublishedSlugs();
    response
      .type('application/xml')
      .send(buildSitemap(listSitemapPaths(slugs)));
  } catch {
    response.status(503).set('Retry-After', RETRY_AFTER_SECONDS).end();
  }
});

app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

app.use('/**', (request, response, next) => {
  angularApp
    .handle(request)
    .then((angularResponse) =>
      angularResponse
        ? writeResponseToNodeResponse(angularResponse, response)
        : next(),
    )
    .catch(next);
});

async function fetchPublishedSlugs(): Promise<string[]> {
  const response = await fetch(`${INTERNAL_API_URL_FROM_ENV}/projects`, {
    signal: AbortSignal.timeout(INTERNAL_API_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`The API answered ${response.status}`);
  }
  const projects = (await response.json()) as ProjectSummary[];
  return projects.map((project) => project.slug);
}

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || DEFAULT_PORT;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// The Angular CLI finds the SSR handler by this exact export name.
export const reqHandler = createNodeRequestHandler(app);
