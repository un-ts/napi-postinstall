export interface Napi {
  binaryName?: string
  /** @deprecated USe @link {binaryName} instead */
  name?: string
  packageName?: string
  /** @deprecated USe @link {packageName} instead */
  package?: {
    name: string
  }
  targets?: string[]
  /** @deprecated USe @link {targets} instead */
  triples?: {
    defaults?: boolean
    additional?: string[]
  }
  wasm?: {
    browser?: {
      fs?: boolean
    }
  }
}

export interface NapiInfo {
  napi: Napi
  version: string
}

export interface PackageJson {
  name: string
  version: string
  optionalDependencies?: Partial<Record<string, string>>
  napi?: Napi
}
