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
core/      api.service.ts (the only HTTP client), api-error.interceptor.ts, auth/, seo.service.ts
features/  home, about, work, blog, testimonials, contact, resume, admin/*
shared/    small presentational pieces
```

### Routes

Public: `/` · `/about` · `/work` · `/work/:slug` · `/blog` · `/blog/:slug` · `/blog/tag/:tag` ·
`/testimonials` · `/contact` · `/resume`. Admin: `/admin/*`, guarded, `noindex`, `RenderMode.Client`.

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

## When to update this file

- A route or render mode changes
- A new cross-cutting service is added to `core/`
