import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap, sitemapPaths } from './app/core/sitemap';

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');

const app = express();
// Advertising the framework only helps someone looking for a known exploit.
app.disable('x-powered-by');
// Caddy is the only way in: this port is never published, and Caddy replaces
// any X-Forwarded-* a client sends with its own. Left untrusted, Angular falls
// back to client-side rendering whenever these headers are present, which
// turns every 404 behind the proxy into a soft 200.
const angularApp = new AngularNodeAppEngine({
  trustProxyHeaders: [
    'x-forwarded-for',
    'x-forwarded-proto',
    'x-forwarded-host',
  ],
});

/**
 * Generated from the content on every request, so it can never list a page
 * that does not exist or miss one that does.
 */
app.get('/sitemap.xml', (_req, res) => {
  res.type('application/xml').send(buildSitemap(sitemapPaths()));
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use('/**', (req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
