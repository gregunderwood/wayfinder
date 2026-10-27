/**
 * @portfolio/domain - the shared contract between the Angular app and the
 * NestJS API.
 *
 * INVARIANT: this library contains interfaces, enums and const objects ONLY.
 * Zero decorators, zero framework imports. NestJS DTO classes live in the
 * server and `implements` these interfaces, so class-validator never reaches
 * the browser bundle while the two sides are still checked against one shape.
 * The eslint module boundary enforces it.
 */
export * from './lib/errors/api-error.model';
export * from './lib/health/health.model';
