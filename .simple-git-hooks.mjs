import base from '@1stg/simple-git-hooks'

export default {
  ...base,
  'pre-commit': `npm run build && git add lib && ${base['pre-commit']}`,
}
