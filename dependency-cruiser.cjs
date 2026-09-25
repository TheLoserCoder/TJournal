/**
 * Architecture guards. Each rule must reject a real violation: the fixture tree
 * in `test/architecture-fixtures` plants one violation per rule and
 * `test/architecture-fixtures/verify-guards.mjs` fails when a rule stops
 * reporting it.
 */

// Runtime infrastructure that inner layers must never import. Core modules are
// reported without the `node:` prefix, npm packages as resolved node_modules
// paths and workspace packages as their unresolved `@tjournal/*` specifier.
const INFRASTRUCTURE =
  '^(electron|react|react-dom|drizzle-orm|fs|fs/promises|path|os|child_process|worker_threads|node:fs|node:fs/promises|node:path|node:os|node:child_process|node:worker_threads|node:sqlite|sqlite)$' +
  '|^node_modules/\\.pnpm/[^/]+/node_modules/(electron|react|react-dom|drizzle-orm)(/|$)' +
  '|^node_modules/\\.pnpm/[^/]+/node_modules/@types/(electron|react|react-dom)(/|$)' +
  '|^@tjournal/platform-database$';

/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'inner-layers-must-not-depend-on-outer-layers',
      comment:
        'Domain, application and contracts stay independent of apps, platform adapters, /adapters/ and /presentation/.',
      severity: 'error',
      from: { path: '^modules/[^/]+/src/(domain|application|contracts)', pathNot: '\\.test\\.ts$' },
      to: { path: '^(apps|platform)|^@tjournal/platform-|/adapters/|/presentation/' },
    },
    {
      name: 'inner-layers-must-not-depend-on-runtime-infrastructure',
      comment:
        'Electron, React, SQLite, Drizzle, filesystem, process and worker APIs are outer details.',
      severity: 'error',
      from: { path: '^modules/[^/]+/src/(domain|application|contracts)', pathNot: '\\.test\\.ts$' },
      to: { path: INFRASTRUCTURE },
    },
    {
      name: 'desktop-application-must-not-depend-on-adapters',
      comment:
        'Application commands orchestrate through ports they own; history/database adapters and IPC registrars stay outer.',
      severity: 'error',
      from: {
        path: '^apps/desktop/src/main/application',
        pathNot: '\\.test\\.ts$',
      },
      to: { path: '^apps/desktop/src/main/(history|register-|desktop-container)' },
    },
    {
      name: 'desktop-application-must-not-depend-on-runtime-infrastructure',
      comment:
        'Electron, SQLite adapters, filesystem and npm infrastructure must stay behind ports owned by the application layer.',
      severity: 'error',
      from: {
        path: '^apps/desktop/src/main/application',
        pathNot: '\\.test\\.ts$',
      },
      to: { path: INFRASTRUCTURE },
    },
    {
      name: 'application-must-not-depend-on-presentation',
      severity: 'error',
      from: { path: '^modules/[^/]+/src/application' },
      to: { path: '/presentation/' },
    },
    {
      name: 'renderer-views-must-not-depend-on-transport',
      comment:
        'Views receive ViewModels and callbacks; gateway and preload access belongs to presenters and gateway adapters.',
      severity: 'error',
      from: { path: '^apps/desktop/src/renderer/features/.+(-view|-dialogs)\\.tsx$' },
      to: { path: '^(apps/desktop/src/preload/|apps/desktop/src/renderer/gateway/)' },
    },
    {
      name: 'no-cross-module-internal-imports',
      comment: 'Cross-module imports use the documented public entry points only.',
      severity: 'error',
      from: {},
      to: { path: '^@tjournal/[^/]+/(?!palette$|calculations$|report-contracts$|note-rules$)' },
    },
    {
      name: 'main-process-must-use-compiled-module-entries',
      comment:
        'Electron main, preload and shared runtime code require workspace packages at runtime, so browser-safe TypeScript subpaths stay renderer-only.',
      severity: 'error',
      from: { path: '^apps/desktop/src/(main|preload|shared)/' },
      to: { path: '^@tjournal/[^/]+/(calculations|note-rules|palette|report-contracts)$' },
    },
    {
      name: 'ipc-registrars-must-not-depend-on-database-adapters',
      comment: 'Only the composition root constructs concrete SQLite adapters.',
      severity: 'error',
      from: { path: '^apps/desktop/src/main/register-.*\\.ts$' },
      to: { path: '^(platform/database|@tjournal/platform-database)' },
    },
    {
      name: 'no-circular-dependencies',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
