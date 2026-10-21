import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'

import { PACKAGE_JSON } from '../src/constants.js'
import { getNapiNativeTarget } from '../src/helpers.js'

const VERSION = '1.0.0'
const BINARY_NAME = 'fake'
const HOST = 'fake-host'
// `test/` -> repository root, the fixture runs against the built `lib/`
const REPO_ROOT = path.resolve(import.meta.dirname, '..')

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
  // while this package can be linked from a tree that cannot see it. Resolving
  // from our own location fails there; the lifecycle script runs with the cwd
  // set to the host package, which can.
  it(
    'should find a binding that is only visible from the host package',
    { timeout: 120_000 },
    async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-pnpm-'))
      const consumer = path.join(root, 'a')
      const store = path.join(root, 'b')
      const nested = path.join(root, 'c')
      const hostDir = path.join(consumer, 'node_modules', HOST)

      try {
        const target = getNapiNativeTarget()
        const platformTarget = Array.isArray(target) ? target[0] : target
        const bindingName = `@fake/binding-${platformTarget}`
        const subpath = `${BINARY_NAME}.${platformTarget}.node`

        write(
          path.join(
            store,
            'node_modules',
            `fake-binding-${platformTarget}`,
            PACKAGE_JSON,
          ),
          JSON.stringify({ name: bindingName, version: VERSION }),
        )
        write(
          path.join(
            store,
            'node_modules',
            `fake-binding-${platformTarget}`,
            subpath,
          ),
          'fake binary',
        )

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

        // the binding is a sibling of the host, reached through a scope symlink
        link(
          path.join(store, 'node_modules', `fake-binding-${platformTarget}`),
          path.join(
            consumer,
            'node_modules',
            '@fake',
            `binding-${platformTarget}`,
          ),
        )

        const napiPostinstall = path.join(
          nested,
          'node_modules',
          'napi-postinstall',
        )
        fs.cpSync(
          path.join(REPO_ROOT, 'lib'),
          path.join(napiPostinstall, 'lib'),
          {
            recursive: true,
          },
        )
        fs.copyFileSync(
          path.join(REPO_ROOT, PACKAGE_JSON),
          path.join(napiPostinstall, PACKAGE_JSON),
        )
        link(
          napiPostinstall,
          path.join(consumer, 'node_modules', 'napi-postinstall'),
        )

        // no registry, no npm: the only way out is resolving the installed
        // binding, which is what a build sandbox relies on
        const env = { ...process.env }
        delete env.npm_config_local_prefix
        env.npm_config_registry = 'http://127.0.0.1:1/'
        env.npm_config_update_notifier = 'false'

        const result = await exec(
          process.execPath,
          [
            '-e',
            `require('napi-postinstall')
              .checkAndPreparePackage('${HOST}', '${VERSION}')
              .then(() => console.log('RESOLVED'), error => {
                console.error(error)
                process.exitCode = 1
              })`,
          ],
          { nodeOptions: { cwd: hostDir, env } },
        )

        expect(result.stderr).toBe('')
        expect(result.stdout.trim()).toBe('RESOLVED')
        expect(result.exitCode).toBe(0)
        // nothing was installed, so the consumer tree only holds what the
        // fixture created
        expect(fs.readdirSync(path.join(consumer, 'node_modules'))).toEqual(
          expect.arrayContaining(['@fake', 'fake-host', 'napi-postinstall']),
        )
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    },
  )
})
