import eslint from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

const MAX_LINES_WARNING = ['warn', { max: 300, skipBlankLines: true, skipComments: true }];
const MAX_LINES_PRODUCTION_ERROR = [
  'error',
  { max: 500, skipBlankLines: true, skipComments: true },
];
/**
 * Test suites collect scenarios for one boundary, so AGENTS.md exempts test
 * material from the production size guideline. The threshold below is a
 * backstop against unbounded accumulation, not a target.
 */
const MAX_LINES_TEST_WARNING = ['warn', { max: 800, skipBlankLines: true, skipComments: true }];

/**
 * Large-but-cohesive files with a recorded decomposition exception
 * (docs/engineering/coding-rules.md): splitting them would fragment one
 * aggregate adapter, one workspace shell or one public contract.
 */
const DECOMPOSITION_EXCEPTIONS = [
  'apps/desktop/src/renderer/features/journal/journal-view.tsx',
  'apps/desktop/src/renderer/i18n.ts',
  'apps/desktop/src/shared/desktop-api.ts',
  'platform/database/src/sqlite-account-store.ts',
  'platform/database/src/sqlite-trade-store.ts',
  'platform/database/src/sqlite-vault-database.ts',
];

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/out/**',
      '**/release/**',
      '**/coverage/**',
      '**/.webpack/**',
      '**/.tsbuild/**',
      '**/storybook-static/**',
    ],
  },
  eslint.configs.recommended,
  {
    files: ['**/*.{cjs,mjs}'],
    languageOptions: {
      globals: {
        __dirname: 'readonly',
        console: 'readonly',
        exports: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
      },
    },
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'max-lines': MAX_LINES_WARNING,
      'no-console': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Production code above 500 lines fails the build unless it has a recorded
    // decomposition exception; dictionaries, generated files, the public IPC
    // contract and large fixtures are exempt by policy.
    files: ['**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}', 'test/**', ...DECOMPOSITION_EXCEPTIONS],
    rules: {
      'max-lines': MAX_LINES_PRODUCTION_ERROR,
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', 'test/**'],
    rules: {
      'max-lines': MAX_LINES_TEST_WARNING,
    },
  },
  {
    files: DECOMPOSITION_EXCEPTIONS,
    rules: {
      'max-lines': 'off',
    },
  },
  {
    // Only gateway adapters may touch the typed preload API.
    files: ['apps/desktop/src/renderer/**/*.{ts,tsx}'],
    ignores: ['apps/desktop/src/renderer/gateway/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          message:
            'Only gateway adapters may access the typed preload API; presenters receive it through the RendererGateway.',
          selector: "MemberExpression[object.name='window'][property.name='tjournal']",
        },
      ],
    },
  },
  {
    files: ['**/*.test.{ts,tsx}', '**/test/**/*.ts'],
    rules: {
      'no-console': 'off',
    },
  },
);
