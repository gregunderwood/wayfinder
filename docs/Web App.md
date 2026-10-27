# Web App

## What it is

`apps/web`: Angular 20, standalone, SSR + prerender. Selector prefix `wf-`. Serves the public site
and, under `/admin`, the CMS.

## Key files

- [../apps/web/src/app/app.routes.ts](../apps/web/src/app/app.routes.ts) — route table
- [../apps/web/src/app/app.routes.server.ts](../apps/web/src/app/app.routes.server.ts) — render mode per route
- [../apps/web/src/server.ts](../apps/web/src/server.ts) — Express SSR host

## How it works

### Layout

```
core/      site.config.ts (identity + SITE_URL), seo.service.ts, structured-data.ts, sitemap.ts, markdown.ts
content/   hardcoded projects, skills and résumé — typed against @wayfinder/domain where the CMS will serve them
features/  home, about, work (list + detail), resume, not-found; admin/* arrives with the CMS
shared/    project-card, skill-matrix
```

Zoneless (`provideZonelessChangeDetection`), every component `OnPush`, every route lazy-loaded.
Styling is one hand-written `styles.scss` of tokens and a few shared classes; component `styles:`
hold only what is specific to that component. Dark mode is a token swap under
`prefers-color-scheme`, and print styles make `/resume` a usable PDF.

### Routes

Public: `/` · `/about` · `/work` · `/work/:slug` · `/blog` · `/blog/:slug` · `/blog/tag/:tag` ·
`/testimonials` · `/contact` · `/resume`. Admin: `/admin/*`, guarded, `noindex`, `RenderMode.Client`.

### Rendering

Every public route is prerendered at build time (`app.routes.server.ts`); `/work/:slug` takes its
params from the content. Unknown paths render per request and answer a real **404** — the
catch-all route sets `status: 404`, and an unknown project slug sets it through `RESPONSE_INIT`.
`/sitemap.xml` is served by the Express host in `server.ts`, generated from the same content.

The SSR host only renders for hosts in `security.allowedHosts` (`project.json`); any other `Host`
header gets a 400 (Angular's SSRF guard). Override per environment with `NG_ALLOWED_HOSTS`.

### SEO

One `seo.service.ts` sets title, description, canonical, Open Graph and JSON-LD per route. Every
absolute URL derives from a single `APP_URL` (production: `https://underwoodstyles.ca`), so
nothing else hardcodes the host.

## Patterns to follow

### ✅ Errors are handled in exactly one interceptor

### ✅ Strictly typed reactive forms — no `ngModel`

### ❌ Don't touch browser globals outside `isPlatformBrowser` / `afterNextRender`

Prerender runs in Node; a bare `window` access fails the build.

### ❌ No icon font

Inline SVG only. An icon font is a render-blocking request for a handful of glyphs.

## Pitfalls

- **A new host (staging, a preview URL) silently loses SSR** until it is in `allowedHosts` or
  `NG_ALLOWED_HOSTS` — in Angular 20 it falls back to client rendering with only a log line.
- **`nx serve web --host=<x>` allows only `<x>`.** In dev the allow-list is rebuilt from the serve
  `host` (plus any serve `allowedHosts`), ignoring the build's list, so `--host=0.0.0.0` makes
  `localhost` answer 400. To reach the dev server from another device, add that host to the
  serve target's `allowedHosts`.
- **Taglines double as meta descriptions.** `content.spec.ts` fails one over 160 characters.

## When to update this file

- A route or render mode changes
- A new cross-cutting service is added to `core/`
