import base from '@1stg/eslint-config'

export default [
  ...base,
  {
    files: ['**/*.tsx'],
    rules: {
      '@eslint-react/jsx-uses-react': 'off',
    },
  },
]
