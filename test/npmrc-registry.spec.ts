import fs from 'node:fs'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'

import { exec } from 'tinyexec'
import { describe, expect, it } from 'vitest'

import { NPMRC, PACKAGE_JSON } from '../src/constants.js'
import { getNapiNativeTarget } from '../src/helpers.js'

const VERSION = '1.0.0'
const BINARY_NAME = 'fake'
const TOKEN = 'napi-postinstall-registry-token'

// `test/` -> repository root, the fixture runs against the built `lib/`.
const REPO_ROOT = path.resolve(import.meta.dirname, '..')

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

interface RegistryHit {
  url: string
  authorization: string | undefined
}

function createRegistry(
  bindingName: string,
  tarballName: string,
  tarball: Buffer,
) {
  const hits: RegistryHit[] = []
  let url = ''
  const server = http.createServer((req, res) => {
    hits.push({
      url: req.url ?? '',
      authorization: req.headers.authorization,
    })
    if (req.headers.authorization !== `Bearer ${TOKEN}`) {
      res.statusCode = 401
      res.setHeader('www-authenticate', 'Bearer')
      res.end('{"error":"unauthorized"}')
      return
    }
    if (req.url?.endsWith('.tgz')) {
      res.setHeader('content-type', 'application/octet-stream')
      res.end(tarball)
      return
    }
    res.setHeader('content-type', 'application/json')
    res.end(
      JSON.stringify({
        name: bindingName,
        'dist-tags': { latest: VERSION },
        versions: {
          [VERSION]: {
            name: bindingName,
            version: VERSION,
            dist: { tarball: `${url}/${bindingName}/-/${tarballName}` },
          },
        },
      }),
    )
  })
  const close = () =>
    new Promise<void>(resolve => {
      server.close(() => resolve())
    })
  return new Promise<{
    host: string
    url: string
    hits: RegistryHit[]
    close: () => Promise<void>
  }>(resolve => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as AddressInfo
      url = `http://127.0.0.1:${port}`
      resolve({ host: `127.0.0.1:${port}`, url, hits, close })
    })
  })
}

describe('project npmrc', () => {
  it(
    'should install the binding from the registry configured in the project npmrc',
    { timeout: 120_000 },
    async () => {
      const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
      const project = path.join(root, 'project')
      const binding = path.join(root, 'binding')
      const target = getNapiNativeTarget()
      const platformTarget = Array.isArray(target) ? target[0] : target
      const bindingName = `@fake/binding-${platformTarget}`
      const subpath = `${BINARY_NAME}.${platformTarget}.node`

      try {
        const libIndex = path.join(REPO_ROOT, 'lib', 'index.js')
        if (!fs.existsSync(libIndex)) {
          throw new Error('`lib/index.js` is missing, run `yarn build` first')
        }

        write(
          path.join(binding, PACKAGE_JSON),
          JSON.stringify({ name: bindingName, version: VERSION }),
        )
        write(path.join(binding, subpath), 'fake binary')

        // reuse npm itself to build the tarball so the fixture stays portable
        await exec('npm', ['pack', '--pack-destination', root], {
          nodeOptions: { cwd: binding },
        })
        const tarballName = fs
          .readdirSync(root)
          .find(file => file.endsWith('.tgz'))
        if (!tarballName) {
          throw new Error('`npm pack` did not produce a tarball')
        }

        const registry = await createRegistry(
          bindingName,
          tarballName,
          fs.readFileSync(path.join(root, tarballName)),
        )
        try {
          // the host package is what a napi-rs package looks like after
          // `npm install --no-optional`: the platform binding is missing
          write(
            path.join(project, 'node_modules', 'fake-host', PACKAGE_JSON),
            JSON.stringify({
              name: 'fake-host',
              version: VERSION,
              napi: {
                binaryName: BINARY_NAME,
                packageName: '@fake/binding',
                targets: ['x86_64-unknown-linux-gnu'],
              },
              optionalDependencies: { [bindingName]: VERSION },
            }),
          )

          // a real install, so `require.resolve` from the library finds the host
          const napiPostinstall = path.join(
            project,
            'node_modules',
            'napi-postinstall',
          )
          fs.cpSync(
            path.join(REPO_ROOT, 'lib'),
            path.join(napiPostinstall, 'lib'),
            { recursive: true },
          )
          fs.copyFileSync(
            path.join(REPO_ROOT, PACKAGE_JSON),
            path.join(napiPostinstall, PACKAGE_JSON),
          )

          write(
            path.join(project, NPMRC),
            [
              `registry=${registry.url}/`,
              `//${registry.host}/:_authToken=${TOKEN}`,
              '',
            ].join('\n'),
          )
          write(path.join(root, 'user.npmrc'), '')
          write(path.join(root, 'global.npmrc'), '')

          // no `npm_config_registry` so the project npmrc is the only source, and
          // no `npm_config_local_prefix` so the cwd based resolution is used by
          // the same path pnpm and yarn take
          const env = { ...process.env }
          delete env.npm_config_local_prefix
          delete env.npm_config_registry
          Object.assign(env, {
            npm_config_cache: path.join(root, 'npm-cache'),
            // fail fast instead of retrying when the auth setup is wrong
            npm_config_fetch_retries: '0',
            npm_config_fetch_retry_maxtimeout: '100',
            npm_config_fetch_retry_mintimeout: '100',
            npm_config_globalconfig: path.join(root, 'global.npmrc'),
            npm_config_userconfig: path.join(root, 'user.npmrc'),
          })

          const result = await exec(
            process.execPath,
            [
              '-e',
              `require('napi-postinstall')
                .checkAndPreparePackage('fake-host', '${VERSION}')
                .catch(error => {
                  console.error(error)
                  process.exitCode = 1
                })`,
            ],
            {
              nodeOptions: {
                cwd: path.join(project, 'node_modules', 'fake-host'),
                env,
              },
            },
          )

          expect(result.stderr).not.toContain('401')
          expect(result.exitCode).toBe(0)
          expect(
            fs.existsSync(path.join(project, 'node_modules', bindingName)),
          ).toBe(true)

          // every request, including the tarball, must carry the project token
          expect(
            registry.hits.filter(
              hit => hit.authorization !== `Bearer ${TOKEN}`,
            ),
          ).toEqual([])
          expect(registry.hits.some(hit => hit.url.endsWith('.tgz'))).toBe(true)
        } finally {
          await registry.close()
        }
      } finally {
        fs.rmSync(root, { recursive: true, force: true })
      }
    },
  )
})
