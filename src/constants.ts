import path from 'node:path'

import type { PackageJson } from './types.js'

export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/'

export const meta = require(
  path.resolve(__dirname, '../package.json'),
) as PackageJson

const { name, version } = meta

export const LOG_PREFIX = `[${name}@${version}] `

export const WASM32 = 'wasm32'
export const WASI = 'wasi'
export const WASM32_WASI = `${WASM32}-${WASI}`

export const EABI = 'eabi'

export const PACKAGE_JSON = 'package.json'

export const NPMRC = '.npmrc'

/**
 * The binding package name and the version that ends up in the temporary install
 * directory and in the npm command. Both come from the dependency's own manifest
 * (`napi.packageName` and the matching `optionalDependencies` value), which npm
 * never validates, so they are checked here: a leading `.`/`_` is not a valid npm
 * name, and `.`/`..` as a whole version would walk out of the intended directory.
 */
export const NPM_PACKAGE_NAME = /^(?:@[a-z0-9-][\w.-]*\/)?[a-z0-9-][\w.-]*$/i

export const NPM_PINNED_VERSION = /^(?!\.\.?$)[\w.+-]+$/
