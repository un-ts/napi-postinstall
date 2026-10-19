declare module '*.css'
declare module 'github-markdown-css'

declare module '*.md' {
  import type { ComponentType } from 'react'

  const MDXComponent: ComponentType
  export default MDXComponent
}
