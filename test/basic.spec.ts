import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'

import { checkAndPreparePackage } from 'napi-postinstall'
import type { PackageJson } from 'napi-postinstall'

import { copyNpmrcTo, getNpmRegistry, hasWasiTarget } from '../src/helpers.js'

describe('napi-postinstall', () => {
  it('should check and prepare package', async () => {
    await expect(
      checkAndPreparePackage('rolldown', undefined, true),
    ).resolves.not.toThrow()
    await expect(checkAndPreparePackage('rolldown')).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('@swc/core', undefined, true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('unrs-resolver', undefined, true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('napi-postinstall'),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: [napi-postinstall@0.3.5] No \`napi.targets\` nor \`napi.triples.additional\` field found in \`napi-postinstall\`'s \`package.json\`. Please ensure the package is built with NAPI support.]`,
    )
  })

  it('should detect a WASI target from napi.targets', () => {
    expect(hasWasiTarget(['wasm32-wasip1-threads'])).toBe(true)
    expect(hasWasiTarget(['x86_64-unknown-linux-gnu'])).toBe(false)
    expect(hasWasiTarget()).toBeUndefined()
  })

  it('should process a WASI target without optionalDependencies', async () => {
    const packageJson: PackageJson = {
      name: 'fake-wasi-package',
      version: '1.0.0',
      napi: {
        binaryName: 'fake',
        packageName: '@fake/binding',
        targets: ['wasm32-wasip1-threads'],
      },
    }
    const server = http.createServer((_req, res) => {
      res.statusCode = 404
      res.end()
    })
    await new Promise<void>((resolve, reject) => {
      server.listen(0, '127.0.0.1', resolve)
      server.once('error', reject)
    })
    const address = server.address()
    if (!address || typeof address === 'string') {
      throw new Error('Failed to get test server address')
    }
    const previousRegistry = process.env.npm_config_registry
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    process.env.npm_config_registry = `http://127.0.0.1:${address.port}/`

    try {
      await expect(checkAndPreparePackage(packageJson, false)).rejects.toThrow(
        'Failed to install package',
      )
    } finally {
      consoleError.mockRestore()
      if (previousRegistry === undefined) {
        delete process.env.npm_config_registry
      } else {
        process.env.npm_config_registry = previousRegistry
      }
      await new Promise<void>((resolve, reject) => {
        server.close(error => (error ? reject(error) : resolve()))
      })
    }
  })

  it('should copy the project npmrc into the temporary directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    const previousRegistry = process.env.npm_config_registry
    delete process.env.npm_config_registry
    try {
      const installDir = path.join(root, 'node_modules', 'host', 'npm-install')
      fs.mkdirSync(installDir, { recursive: true })
      const content = 'registry=https://registry.example.test/\n'
      fs.writeFileSync(path.join(root, '.npmrc'), content)
      fs.writeFileSync(
        path.join(root, 'package.json'),
        JSON.stringify({
          devEngines: {
            packageManager: { name: 'pnpm', version: '10.9.0' },
          },
        }),
      )

      copyNpmrcTo(installDir, root)

      expect(fs.readFileSync(path.join(installDir, '.npmrc'), 'utf8')).toBe(
        content,
      )
      expect(getNpmRegistry(root)).toBe('https://registry.example.test/')
    } finally {
      if (previousRegistry === undefined) {
        delete process.env.npm_config_registry
      } else {
        process.env.npm_config_registry = previousRegistry
      }
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
