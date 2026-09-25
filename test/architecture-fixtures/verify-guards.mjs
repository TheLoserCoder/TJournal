/**
 * Verifies that every architecture guard still reports its planted violation.
 * A rule that silently stops matching (for example because a path or an
 * external module is no longer visible to dependency-cruiser) would otherwise
 * make the real graph pass for the wrong reason.
 *
 * dependency-cruiser rules are cruised over the fixture tree; ESLint rules are
 * linted with the repository config from the fixture base path, because their
 * `files` patterns are relative to the configuration root.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { ESLint } from 'eslint';

const fixturesDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(fixturesDirectory, '..', '..');

const expectedRuleNames = [
  'inner-layers-must-not-depend-on-outer-layers',
  'inner-layers-must-not-depend-on-runtime-infrastructure',
  'desktop-application-must-not-depend-on-adapters',
  'desktop-application-must-not-depend-on-runtime-infrastructure',
  'application-must-not-depend-on-presentation',
  'renderer-views-must-not-depend-on-transport',
  'no-cross-module-internal-imports',
  'main-process-must-use-compiled-module-entries',
  'ipc-registrars-must-not-depend-on-database-adapters',
  'no-circular-dependencies',
];

const expectedEslintRuleIds = ['max-lines', 'no-restricted-syntax'];
const eslintFixtureFiles = ['apps/desktop/src/renderer/features/violating/preload-access.ts'];
const OVERSIZED_FIXTURE_LINE_COUNT = 520;

const configPath = path.join(repositoryRoot, 'dependency-cruiser.cjs');
const result = spawnSync(
  process.execPath,
  [
    path.join(repositoryRoot, 'node_modules', 'dependency-cruiser', 'bin', 'dependency-cruise.mjs'),
    '--config',
    configPath,
    '--output-type',
    'json',
    '.',
  ],
  { cwd: fixturesDirectory, encoding: 'utf8' },
);

if (result.status !== 0 || result.error !== undefined) {
  console.error(
    `Architecture guard self-test failed: dependency-cruiser could not cruise the fixture tree (exit code ${result.status}).`,
  );
  console.error(result.error ?? result.stderr);
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout);
} catch (error) {
  console.error('Architecture guard self-test failed: the report was not valid JSON.');
  console.error(error);
  process.exit(1);
}

const reportedRules = new Set(report.summary.violations.map((violation) => violation.rule.name));
const missingRules = expectedRuleNames.filter((rule) => !reportedRules.has(rule));

if (missingRules.length > 0) {
  console.error(
    `Architecture guard self-test failed: ${missingRules.join(', ')} did not report a planted violation.`,
  );
  process.exit(1);
}

const configuredRules = readFileSync(configPath, 'utf8').match(/name: '[^']+'/g) ?? [];
if (configuredRules.length !== expectedRuleNames.length) {
  console.error(
    `Architecture guard self-test failed: the config declares ${configuredRules.length} rules but the self-test covers ${expectedRuleNames.length}.`,
  );
  process.exit(1);
}

const eslintConfigPath = path.join(repositoryRoot, 'eslint.config.mjs');
const eslintConfig = (await import(pathToFileURL(eslintConfigPath).href)).default;
const eslint = new ESLint({
  cwd: fixturesDirectory,
  overrideConfigFile: true,
  overrideConfig: eslintConfig,
});
const oversizedFixture = [
  '// Intentional ESLint violation: a production file above 500 lines must fail max-lines.',
  'export const oversizedGuardFixture = [',
  ...Array.from({ length: OVERSIZED_FIXTURE_LINE_COUNT }, (_, index) => `  ${index},`),
  '];',
].join('\n');
const eslintResults = [
  ...(await eslint.lintFiles(eslintFixtureFiles)),
  ...(await eslint.lintText(oversizedFixture, {
    filePath: path.join(
      fixturesDirectory,
      'apps/desktop/src/renderer/features/violating/oversized.ts',
    ),
  })),
];
const reportedEslintRules = new Set(
  eslintResults.flatMap((eslintResult) =>
    eslintResult.messages
      .filter((message) => message.severity === 2)
      .map((message) => message.ruleId),
  ),
);
const missingEslintRules = expectedEslintRuleIds.filter(
  (ruleId) => !reportedEslintRules.has(ruleId),
);

if (missingEslintRules.length > 0) {
  console.error(
    `Architecture guard self-test failed: ESLint rule(s) ${missingEslintRules.join(', ')} did not report a planted violation.`,
  );
  process.exit(1);
}

console.log(
  `Architecture guards verified: ${expectedRuleNames.length} dependency-cruiser rules and ${expectedEslintRuleIds.length} ESLint rules reported their planted violation.`,
);
