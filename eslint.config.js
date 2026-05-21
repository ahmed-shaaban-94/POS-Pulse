// @ts-check
import tsEslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default tsEslint.config(
  {
    ignores: [
      'dist/**',
      'dist-electron/**',
      'node_modules/**',
      'coverage/**',
      '_reference/**',
      '**/*.cjs',
      'eslint.config.js',
      // Generated file (T055): output of `npm run codegen:api`. Linting it is
      // pointless — its shape is dictated by openapi-typescript, not project
      // conventions, and every regeneration would otherwise trip strict rules.
      'src/shared/api-types.ts',
      // Project-local Claude Code automation scripts (PR #191). These .mjs
      // files are not part of any tsconfig project; the project-service-based
      // parser cannot resolve them and fails CI lint with "was not found by
      // the project service". They are tooling, not production source, and
      // are out of scope for the renderer/main/preload type-check rules.
      '.claude/**',
    ],
  },
  tsEslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
  },
  {
    plugins: {
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    settings: { react: { version: 'detect' } },
    rules: {
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // TODO: Add electron-security ESLint plugin rules once package name is confirmed
  // (e.g., eslint-plugin-electron or similar; verify on npm before installing)
);
