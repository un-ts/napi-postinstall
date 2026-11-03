import { defineConfig } from '@1stg/eslint-config'
import { configs } from 'eslint-plugin-node-dependencies'

export default defineConfig({
  configs: [
    ...configs['flat/recommended'],
    {
      files: ['src/patch.ts'],
      rules: {
        'unicorn/no-exports-in-scripts': 'off',
        'unicorn/no-unsafe-string-replacement': 'off',
      },
    },
    {
      files: ['test/**'],
      rules: {
        'unicorn/no-top-level-assignment-in-function': 'off',
        'unicorn/no-unnecessary-parameters': 'off',
      },
    },
    {
      rules: {
        '@typescript-eslint/no-magic-numbers': 'off',
        '@typescript-eslint/no-require-imports': 'off',
        'sonarjs/file-permissions': 'off',
        'sonarjs/no-os-command-from-path': 'off',
        'unicorn/no-computed-property-existence-check': 'off',
        'unicorn/no-optional-chaining-on-undeclared-variable': 'off',
        'unicorn/prefer-await': 'off',
        'unicorn/prefer-then-catch': 'off',
        'unicorn/prefer-split-limit': 'off',
      },
    },
  ],
})
