import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import fallback from 'napi-postinstall/fallback'
import { vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execFileSync: vi.fn(),
}))

describe('fallback CLI', () => {
  it('should invoke the locally installed CLI', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    const pkgDir = path.join(root, 'pkg')
    fs.mkdirSync(pkgDir, { recursive: true })
    fs.writeFileSync(
      path.join(pkgDir, 'package.json'),
      JSON.stringify({
        name: 'fake-host',
        version: '1.0.0',
        main: 'index.js',
        napi: {
          binaryName: 'fake',
          packageName: '@fake/binding',
          targets: ['x86_64-unknown-linux-gnu'],
        },
      }),
    )
    fs.writeFileSync(
      path.join(pkgDir, 'index.js'),
      'module.exports = { ok: true }',
    )

    try {
      expect(
        fallback<{ ok: boolean }>(path.join(pkgDir, 'package.json'), true),
      ).toEqual({ ok: true })
      expect(execFileSync).toHaveBeenCalledWith(
        process.execPath,
        [expect.stringMatching(/lib[\\/]cli\.js$/), 'fake-host', '1.0.0', '1'],
        { cwd: pkgDir, stdio: 'inherit' },
      )
      expect(process.env.SKIP_FAKE_HOST_FALLBACK).toBe('1')
    } finally {
      delete process.env.SKIP_FAKE_HOST_FALLBACK
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
