// Every migration, in order. Listed by hand: the API is a webpack bundle with
// no directory to glob, so a migration missing here never runs in production.
export { CreateAuthTables1793155154390 } from './1793155154390-create-auth-tables';
export { CreateProjectsTable1793340727144 } from './1793340727144-create-projects-table';
export { SeedProjects1793340727145 } from './1793340727145-seed-projects';
