export interface Napi {
  binaryName?: string
  /** @deprecated Use @link {binaryName} instead */
  name?: string
  packageName?: string
  /** @deprecated Use @link {packageName} instead */
  package?: {
    name: string
  }
  targets?: string[]
  /** @deprecated Use @link {targets} instead */
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
  version?: string
}

export interface PackageJson {
  name: string
  version: string
  optionalDependencies?: Partial<Record<string, string>>
  napi?: Napi
}

export type Platform = NodeJS.Platform | 'openharmony' | 'wasi' | 'wasm'

export type NodeJSArch = NodeJS.Architecture | 'universal' | 'wasm32' | 'x32'

export interface Target {
  triple: string
  platformArchABI: string
  platform: Platform
  arch: NodeJSArch
  abi: string | null
}
