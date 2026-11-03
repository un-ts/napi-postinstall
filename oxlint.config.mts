import { defineConfig } from '@1stg/oxlint-config'

export default defineConfig({
  noMagicNumbers: false,
  rules: {
    eqeqeq: ['error', 'always', { null: 'ignore' }],
    'typescript/no-require-imports': 'off',
    'unicorn/prefer-string-replace-all': 'off',
    'unicorn/prefer-top-level-await': 'off',
  },
  overrides: [
    {
      files: ['test/**'],
      rules: {
        'import/default': 'off',
        'vitest/no-standalone-expect': 'off',
        'vitest/require-mock-type-parameters': 'off',
      },
    },
  ],
})
