import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkAndPreparePackage } from 'napi-postinstall'
import type { PackageJson } from 'napi-postinstall'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const HOST = 'fake-host'
const VERSION = '1.0.0'
const BINARY_NAME = 'fake'
const BINDING_PKG = '@fake/binding-wasm32-wasi'
const SUBPATH = `${BINARY_NAME}.wasm32-wasi.wasm`

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

afterEach(() => {
  vi.mocked(execSync).mockReset()
})

describe('runtime fallback install', () => {
  it('should copy the installed binary into the host package', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-install-'))
    const hostDir = path.join(root, 'node_modules', HOST)
    const cwd = process.cwd()

    write(
      path.join(hostDir, 'package.json'),
      JSON.stringify({ name: HOST, version: VERSION, main: 'index.js' }),
    )

    const packageJson: PackageJson = {
      name: HOST,
      version: VERSION,
      napi: {
        binaryName: BINARY_NAME,
        packageName: '@fake/binding',
        targets: ['wasm32-wasip1-threads'],
      },
      optionalDependencies: { [BINDING_PKG]: VERSION },
    }

    vi.mocked(execSync).mockImplementation(command => {
      if (typeof command !== 'string' || !command.startsWith('npm install')) {
        return JSON.stringify({ registry: 'http://127.0.0.1:1/' })
      }

      const prefix = /--prefix (\S+)/.exec(command)?.[1]
      if (!prefix) {
        throw new Error(`unexpected command: ${command}`)
      }

      const installDir = path.resolve(prefix)
      const bindingDir = path.join(
        installDir,
        'node_modules',
        '@fake',
        'binding-wasm32-wasi',
      )
      write(
        path.join(bindingDir, 'package.json'),
        JSON.stringify({ name: BINDING_PKG, version: VERSION, main: SUBPATH }),
      )
      write(path.join(bindingDir, SUBPATH), 'fake binary')
      return ''
    })

    process.chdir(root)

    try {
      await expect(
        checkAndPreparePackage(packageJson, false),
      ).resolves.toBeUndefined()
      expect(fs.existsSync(path.join(hostDir, SUBPATH))).toBe(true)
      expect(
        fs.existsSync(path.join(hostDir, 'node_modules', BINDING_PKG)),
      ).toBe(true)
    } finally {
      process.chdir(cwd)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
