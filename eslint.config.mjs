import base from '@1stg/eslint-config'
import nodeDependencies from 'eslint-plugin-node-dependencies'

export default [
  ...(await base),
  ...nodeDependencies.configs['flat/recommended'],
  {
    rules: {
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'sonarjs/file-permissions': 'off',
      'sonarjs/no-os-command-from-path': 'off',
    },
  },
]
