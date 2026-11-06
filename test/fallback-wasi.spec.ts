import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import fallback from 'napi-postinstall/fallback'
import { describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

const HOST = 'fake-host'
const VERSION = '1.0.0'
const BINDING_PKG = '@fake/binding-wasm32-wasi'

describe('fallback WASI', () => {
  it('should load the installed WASI binding when the host loader still fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    const hostDir = path.join(root, 'node_modules', HOST)
    const bindingDir = path.join(hostDir, 'node_modules', BINDING_PKG)

    fs.mkdirSync(bindingDir, { recursive: true })
    fs.writeFileSync(
      path.join(hostDir, 'package.json'),
      JSON.stringify({
        name: HOST,
        version: VERSION,
        napi: {
          binaryName: 'fake',
          packageName: '@fake/binding',
          targets: ['wasm32-wasip1-threads'],
        },
        optionalDependencies: { [BINDING_PKG]: VERSION },
      }),
    )
    fs.writeFileSync(
      path.join(hostDir, 'index.js'),
      "throw new Error('Cannot find native binding')",
    )
    fs.writeFileSync(path.join(bindingDir, 'package.json'), JSON.stringify({ name: BINDING_PKG }))
    fs.writeFileSync(path.join(bindingDir, 'fake.wasi.cjs'), 'module.exports = { fake: true }')

    try {
      expect(fallback<{ fake: boolean }>(path.join(hostDir, 'package.json'), true)).toEqual({
        fake: true,
      })
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
      delete process.env.SKIP_FAKE_HOST_FALLBACK
    }
  })
})
