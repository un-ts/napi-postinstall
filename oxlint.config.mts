import { defineConfig } from '@1stg/oxlint-config'

export default defineConfig({
  noMagicNumbers: false,
  rules: {
    eqeqeq: ['error', 'always', { null: 'ignore' }],
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
