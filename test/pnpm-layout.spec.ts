import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkAndPreparePackage } from 'napi-postinstall'
import { describe, expect, it, vi } from 'vitest'

import { PACKAGE_JSON } from '../src/constants.js'
import { getNapiNativeTarget } from '../src/helpers.js'

const VERSION = '1.0.0'
const BINARY_NAME = 'fake'
const HOST = 'fake-host'

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

// a directory symlink; Windows allows one only with the privilege, so fall back to
// a junction there, which does not need it
const link = (target: string, linkPath: string) => {
  fs.mkdirSync(path.dirname(linkPath), { recursive: true })
  fs.symlinkSync(
    target,
    linkPath,
    process.platform === 'win32' ? 'junction' : 'dir',
  )
}

describe('pnpm-style layout', () => {
  // https://github.com/un-ts/napi-postinstall/issues/53 — with `hoist=false` the
  // binding is a sibling of the host package in the consumer's `node_modules`,
  // while this package is loaded through the tsconfig alias from the repository,
  // which cannot see either. Resolving from our own location fails there; the
  // postinstall runs with the cwd set to the host package, which can.
  it('should find a binding that is only visible from the host package', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-pnpm-'))
    const consumer = path.join(root, 'a')
    const store = path.join(root, 'b')
    const hostDir = path.join(consumer, 'node_modules', HOST)
    const cwd = process.cwd()
    const registry = process.env.npm_config_registry
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    try {
      const target = getNapiNativeTarget()
      const platformTarget = Array.isArray(target) ? target[0] : target
      const bindingName = `@fake/binding-${platformTarget}`
      const subpath = `${BINARY_NAME}.${platformTarget}.node`
      const bindingDir = path.join(
        store,
        'node_modules',
        `fake-binding-${platformTarget}`,
      )

      write(
        path.join(bindingDir, PACKAGE_JSON),
        JSON.stringify({ name: bindingName, version: VERSION }),
      )
      write(path.join(bindingDir, subpath), 'fake binary')
      write(
        path.join(hostDir, PACKAGE_JSON),
        JSON.stringify({
          name: HOST,
          version: VERSION,
          napi: {
            binaryName: BINARY_NAME,
            packageName: '@fake/binding',
            targets: [platformTarget],
          },
          optionalDependencies: { [bindingName]: VERSION },
        }),
      )
      // the binding is reached through a scope symlink next to the host
      link(
        bindingDir,
        path.join(
          consumer,
          'node_modules',
          '@fake',
          `binding-${platformTarget}`,
        ),
      )

      process.chdir(hostDir)
      // the registry points at a closed port, so a regression fails fast instead
      // of reaching the public one, like the offline sandbox in the issue
      process.env.npm_config_registry = 'http://127.0.0.1:1/'
      await expect(
        checkAndPreparePackage(HOST, VERSION),
      ).resolves.toBeUndefined()

      expect(consoleError).not.toHaveBeenCalled()
      // neither fallback may have run: the nested install would use this prefix
      // and grow a `node_modules` inside the host, the download would write the
      // binary into the host package itself
      expect(
        fs.existsSync(path.join(consumer, 'node_modules', '.napi-postinstall')),
      ).toBe(false)
      expect(fs.existsSync(path.join(hostDir, 'node_modules'))).toBe(false)
      expect(fs.existsSync(path.join(hostDir, subpath))).toBe(false)
    } finally {
      process.chdir(cwd)
      if (registry === undefined) {
        delete process.env.npm_config_registry
      } else {
        process.env.npm_config_registry = registry
      }
      consoleError.mockRestore()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
