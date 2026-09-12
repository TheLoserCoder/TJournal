/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'domain-must-not-depend-on-outer-layers',
      severity: 'error',
      from: { path: '^modules/[^/]+/src/domain' },
      to: { path: '^(apps|platform)|/adapters/|/presentation/' },
    },
    {
      name: 'application-must-not-depend-on-presentation',
      severity: 'error',
      from: { path: '^modules/[^/]+/src/application' },
      to: { path: '/presentation/' },
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
    includeOnly: '^(apps|modules|platform)',
    tsConfig: { fileName: 'tsconfig.json' },
  },
};
