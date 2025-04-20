import base from '@1stg/eslint-config'
import nodeDependencies from 'eslint-plugin-node-dependencies'

export default [
  ...base,
  ...nodeDependencies.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'sonarjs/file-permissions': 'off',
      'sonarjs/no-os-command-from-path': 'off',
      'unicorn/import-style': 'off',
      'unicorn/prefer-top-level-await': 'off',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      '@eslint-react/jsx-uses-react': 'off',
    },
  },
]
