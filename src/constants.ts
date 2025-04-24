import * as path from 'node:path'

import { PackageJson } from './types.js'

export const DEFAULT_NPM_REGISTRY = 'https://registry.npmjs.org/'

export const { name, version } = require(
  path.resolve(__dirname, '../package.json'),
) as PackageJson

export const LOG_PREFIX = `[${name}@${version}] `

export const WASM32 = 'wasm32'
export const WASI = 'wasi'
export const WASM32_WASI = `${WASM32}-${WASI}`

export const EABI = 'eabi'

export const PACKAGE_JSON = 'package.json'
