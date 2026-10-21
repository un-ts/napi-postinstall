import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { patch } from '../src/patch.js'

const originalCwd = process.cwd()

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
  process.chdir(root)
  fs.writeFileSync(
    path.join(root, 'package.json'),
    JSON.stringify({ name: 'fake-host', version: '1.0.0' }),
  )
})

afterEach(() => {
  process.chdir(originalCwd)
  fs.rmSync(root, { recursive: true, force: true })
})

const loader = `let nativeBinding = null
let __napiLoadedBindingTarget = 'native'
const loadErrors = []
if (!nativeBinding) {
  throw new Error('missing binding')
}
`

describe('napi-patch', () => {
  it('should patch index.js by default', () => {
    fs.writeFileSync(path.join(root, 'index.js'), loader)

    patch({ name: 'fake-host' })

    const patched = fs.readFileSync(path.join(root, 'index.js'), 'utf8')
    expect(patched).toContain("require('napi-postinstall/fallback')")
    expect(patched).toContain(
      'if (!nativeBinding && process.env["SKIP_FAKE_HOST_FALLBACK"] !== \'1\') {',
    )
    expect(patched).toContain(
      "typeof __napiLoadedBindingTarget !== 'undefined'",
    )
    expect(patched).not.toContain('webcontainer')
  })

  it('should patch a nested entry', () => {
    const napiDir = path.join(root, 'napi')
    fs.mkdirSync(napiDir)
    fs.writeFileSync(path.join(napiDir, 'index.js'), loader)

    patch({ entry: 'napi/index.js', name: 'fake-host' })
    const once = fs.readFileSync(path.join(napiDir, 'index.js'), 'utf8')
    expect(once).toContain("require.resolve('./package.json')")
    expect(once).toContain(
      'if (!nativeBinding && process.env["SKIP_FAKE_HOST_FALLBACK"] !== \'1\') {',
    )

    patch({ entry: 'napi/index.js', name: 'fake-host' })
    expect(fs.readFileSync(path.join(napiDir, 'index.js'), 'utf8')).toBe(once)
  })

  it('should append extra text through the API', () => {
    fs.writeFileSync(path.join(root, 'index.js'), loader)
    const extra = `if (process.versions.pnp) {
  process.env.FAKE_PNP = '1'
}`

    patch({ name: 'fake-host', append: extra })
    expect(fs.readFileSync(path.join(root, 'index.js'), 'utf8')).toContain(
      extra,
    )
  })

  it('should not append when the fallback is already present', () => {
    fs.writeFileSync(path.join(root, 'index.js'), loader)
    patch({ name: 'fake-host' })
    const once = fs.readFileSync(path.join(root, 'index.js'), 'utf8')

    patch({ name: 'fake-host', append: 'extra()' })
    expect(fs.readFileSync(path.join(root, 'index.js'), 'utf8')).toBe(once)
  })

  it('should reject a missing name', () => {
    fs.writeFileSync(path.join(root, 'index.js'), loader)

    expect(() => patch({ name: '' })).toThrow('name is required')
  })
})
