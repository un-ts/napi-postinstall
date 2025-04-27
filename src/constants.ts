import * as path from 'node:path'

import { PackageJson } from './types.js'

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
