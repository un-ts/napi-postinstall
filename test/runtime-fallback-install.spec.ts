import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkAndPreparePackage } from 'napi-postinstall'
import type { PackageJson } from 'napi-postinstall'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { getNapiNativeTargets } from '../src/helpers.js'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

const HOST = 'fake-host'
const VERSION = '1.0.0'
const BINARY_NAME = 'fake'
const TARGET = getNapiNativeTargets()[0]
const BINDING_PKG = `@fake/binding-${TARGET}`
const SUBPATH = `${BINARY_NAME}.${TARGET}.node`

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

const setup = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-install-'))
  const hostDir = path.join(root, 'node_modules', HOST)

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

  return { hostDir, packageJson, root }
}

const mockNpmInstall = (withBinary: boolean) => {
  vi.mocked(execSync).mockImplementation((command, options) => {
    if (typeof command !== 'string' || !command.startsWith('npm install')) {
      return JSON.stringify({ registry: 'http://127.0.0.1:1/' })
    }

    const prefix = /--prefix (\S+)/.exec(command)?.[1]
    if (!prefix) {
      throw new Error(`unexpected command: ${command}`)
    }

    const installDir = path.resolve(
      String(options?.cwd ?? process.cwd()),
      prefix,
    )
    const bindingDir = path.join(
      installDir,
      'node_modules',
      '@fake',
      `binding-${TARGET}`,
    )
    write(
      path.join(bindingDir, 'package.json'),
      JSON.stringify({ name: BINDING_PKG, version: VERSION, main: SUBPATH }),
    )
    if (withBinary) {
      write(path.join(bindingDir, SUBPATH), 'fake binary')
    }
    return ''
  })
}

afterEach(() => {
  vi.mocked(execSync).mockReset()
})

describe('runtime fallback install', () => {
  const localPrefix = process.env.npm_config_local_prefix

  afterEach(() => {
    if (localPrefix === undefined) {
      delete process.env.npm_config_local_prefix
    } else {
      process.env.npm_config_local_prefix = localPrefix
    }
  })

  it('should copy the installed binary into the host package', async () => {
    const { hostDir, packageJson, root } = setup()
    const cwd = process.cwd()
    delete process.env.npm_config_local_prefix
    mockNpmInstall(true)
    process.chdir(root)

    try {
      await expect(
        checkAndPreparePackage(packageJson, false),
      ).resolves.toBeUndefined()
      expect(fs.existsSync(path.join(hostDir, SUBPATH))).toBe(true)
      expect(fs.existsSync(path.join(root, 'node_modules', BINDING_PKG))).toBe(
        true,
      )
    } finally {
      process.chdir(cwd)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should reject when the package has no binary to copy', async () => {
    const { packageJson, root } = setup()
    const cwd = process.cwd()
    delete process.env.npm_config_local_prefix
    // A populated destination makes the package move fail.
    write(
      path.join(root, 'node_modules', '@fake', `binding-${TARGET}`, 'keep'),
      '',
    )
    mockNpmInstall(false)
    process.chdir(root)

    try {
      await expect(checkAndPreparePackage(packageJson, false)).rejects.toThrow(
        'Failed to install package',
      )
    } finally {
      process.chdir(cwd)
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
