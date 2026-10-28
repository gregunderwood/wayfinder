/**
 * Every migration, listed explicitly and in order.
 *
 * A webpack bundle has no directory to scan, so the glob the TypeORM CLI uses
 * cannot work inside the shipped image. Adding a migration means adding it
 * here; forgetting leaves a schema change that runs in development and
 * silently does not in production.
 */
export {};
