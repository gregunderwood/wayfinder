# @portfolio/domain

The shared contract between `apps/web` and `apps/server`: interfaces, enums and consts only.
The invariant is stated at the top of [src/index.ts](src/index.ts) and enforced by the module
boundary rule in the root `eslint.config.mjs`.

There are no tests here by design — there is no logic to test. `nx test domain` passes with no
test files.
