// Server-only: the render and the sitemap call the API directly, inside the Compose network.
export const INTERNAL_API_URL_FROM_ENV =
  process.env['API_INTERNAL_URL'] ?? 'http://localhost:3000/api';
