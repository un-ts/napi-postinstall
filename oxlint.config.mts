import { defineConfig } from '@1stg/oxlint-config'

export default defineConfig({
  noMagicNumbers: false,
  overrides: [
    {
      files: ['src/helpers.ts'],
      rules: {
        eqeqeq: 'off',
      },
    },
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
