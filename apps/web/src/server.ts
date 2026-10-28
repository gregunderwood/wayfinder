import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSitemap, listSitemapPaths } from './app/core/sitemap';

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

app.get('/sitemap.xml', (_request, response) => {
  response.type('application/xml').send(buildSitemap(listSitemapPaths()));
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

if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || DEFAULT_PORT;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// The Angular CLI finds the SSR handler by this exact export name.
export const reqHandler = createNodeRequestHandler(app);
