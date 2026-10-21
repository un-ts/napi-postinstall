#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import { getSkipFallbackEnv } from './helpers.js'

export interface PatchOptions {
  /** Entry to patch, relative to cwd. Defaults to `index.js`. */
  entry?: string
  /** Package name used for the skip env. */
  name: string
  /** Extra JavaScript appended after the fallback. */
  append?: string
}

const ANCHOR = '\nif (!nativeBinding) {\n'
const FALLBACK_MARKER = `
    nativeBinding = require('napi-postinstall/fallback')(
      require.resolve('./package.json'),
      true,
    )`

/**
 * Injects the all-platform runtime fallback into a generated napi-rs loader.
 */
export function patch({ entry = 'index.js', name, append }: PatchOptions) {
  if (!name) {
    throw new Error('name is required')
  }

  const entryPath = path.resolve(entry)
  let code = fs.readFileSync(entryPath, 'utf8')

  if (code.includes(FALLBACK_MARKER)) {
    return
  }

  if (!code.includes(ANCHOR)) {
    throw new Error(`cannot find ${JSON.stringify(ANCHOR)} in ${entry}`)
  }

  code = code.replace(
    ANCHOR,
    `
if (!nativeBinding && process.env[${JSON.stringify(getSkipFallbackEnv(name))}] !== '1') {
  try {${FALLBACK_MARKER}
    if (
      typeof __napiLoadedBindingTarget !== 'undefined' &&
      typeof nativeBinding.__napiBindingTarget === 'string'
    ) {
      __napiLoadedBindingTarget = nativeBinding.__napiBindingTarget
    }
  } catch (err) {
    loadErrors.push(err)
  }
}
` + ANCHOR,
  )

  if (append) {
    code += `${code.endsWith('\n') ? '' : '\n'}\n${append}\n`
  }

  fs.writeFileSync(entryPath, code)
}

/* v8 ignore start */
if (require.main === module) {
  let [entry = 'index.js', name = ''] = process.argv.slice(2)
  if (!name) {
    if (entry.includes('.')) {
      name = (
        JSON.parse(fs.readFileSync('package.json', 'utf8')) as { name: string }
      ).name
    } else {
      name = entry
      // eslint-disable-next-line sonarjs/no-redundant-assignments
      entry = 'index.js'
    }
  }
  patch({ entry, name })
}
/* v8 ignore stop */
