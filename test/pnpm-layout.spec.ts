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

// a directory symlink, which Windows only allows as a junction
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
  // while this package is installed somewhere that cannot see it. Resolving from
  // our own location fails there; the postinstall runs with the cwd set to the
  // host package, which can.
  it('should find a binding that is only visible from the host package', async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-pnpm-'))
    const consumer = path.join(root, 'a')
    const store = path.join(root, 'b')
    const hostDir = path.join(consumer, 'node_modules', HOST)
    const cwd = process.cwd()
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
      // no registry and no npm: the only way through is resolving the installed
      // binding, which is what an offline build sandbox relies on
      await expect(
        checkAndPreparePackage(HOST, VERSION),
      ).resolves.toBeUndefined()

      expect(consoleError).not.toHaveBeenCalled()
      // nothing was installed: the consumer tree still only holds the fixture,
      // so no nested install or download was attempted
      expect(fs.readdirSync(path.join(consumer, 'node_modules'))).toEqual(
        expect.arrayContaining(['@fake', HOST]),
      )
    } finally {
      process.chdir(cwd)
      consoleError.mockRestore()
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
