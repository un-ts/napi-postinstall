import * as childProcess from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { beforeEach, vi } from 'vitest'

import { DEFAULT_NPM_REGISTRY, NPMRC, PACKAGE_JSON } from '../src/constants.js'
import {
  getNpmRegistry,
  getProjectDir,
  isShellSafeArgument,
  prepareNpmPrefix,
} from '../src/helpers.js'

// npm's own behaviour is covered end to end by the registry acceptance test, so
// the unit tests here only drive our parsing and failure handling: a real spawn
// costs 37-65s on a loaded Windows runner.
vi.mock('node:child_process', () => ({ execSync: vi.fn() }))

const LOCAL_PREFIX = 'npm_config_local_prefix'
const originalLocalPrefix = process.env[LOCAL_PREFIX]

const read = (file: string) => fs.readFileSync(file, 'utf8')

const write = (file: string, content: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content)
}

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
  delete process.env[LOCAL_PREFIX]
})

afterEach(() => {
  if (originalLocalPrefix === undefined) {
    delete process.env[LOCAL_PREFIX]
  } else {
    process.env[LOCAL_PREFIX] = originalLocalPrefix
  }
  fs.rmSync(root, { recursive: true, force: true })
})

describe('getProjectDir', () => {
  // npm exports the prefix it resolved from its own cwd, which is the only value
  // that is correct for nested installs, so it wins over the cwd.
  it('should prefer the prefix exported by npm', () => {
    process.env[LOCAL_PREFIX] = root
    expect(getProjectDir(path.join(root, 'node_modules', 'host'))).toBe(root)
  })

  it('should strip the node_modules segments from the cwd', () => {
    expect(getProjectDir(path.join(root, 'node_modules', 'host'))).toBe(root)
    expect(
      getProjectDir(
        path.join(
          root,
          'node_modules',
          '.pnpm',
          'host@1.0.0',
          'node_modules',
          'host',
        ),
      ),
    ).toBe(root)
  })

  // deliberate: deriving workspace roots needs npm's glob and YAML semantics,
  // and an approximation can pick up another project's registry and credentials
  it('should not climb to a workspace root', () => {
    write(
      path.join(root, PACKAGE_JSON),
      JSON.stringify({
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }),
    )
    const member = path.join(root, 'packages', 'a')
    write(
      path.join(member, PACKAGE_JSON),
      JSON.stringify({ name: 'a', version: '1.0.0' }),
    )

    expect(getProjectDir(path.join(member, 'node_modules', 'host'))).toBe(
      member,
    )
  })

  // `C:` is not a usable base for relative resolution, the root has to keep its
  // separator
  it('should return the filesystem root for a path that starts at node_modules', () => {
    const start = path.resolve('/node_modules/pkg')

    expect(getProjectDir(start)).toBe(path.parse(start).root)
  })

  it('should fall back to the cwd outside node_modules', () => {
    const cwd = path.join(root, 'somewhere')

    expect(getProjectDir(cwd)).toBe(cwd)
  })
})

describe('prepareNpmPrefix', () => {
  it('should add an empty package.json and mirror the project npmrc', () => {
    const npmrc = [
      'registry=https://registry.example.test/',
      '//registry.example.test/:_authToken=secret',
      '',
    ].join('\n')
    write(path.join(root, NPMRC), npmrc)

    const prefix = path.join(root, 'node_modules', 'host', 'npm-install')
    prepareNpmPrefix(prefix, root)

    expect(read(path.join(prefix, PACKAGE_JSON))).toBe('{}')
    expect(read(path.join(prefix, NPMRC))).toBe(npmrc)
  })

  // npm resolves relative values in `.npmrc` against its cwd, so the copy stays
  // byte for byte identical; the nested install runs from the project directory.
  it('should copy the file verbatim, path values included', () => {
    const npmrc = [
      'registry=https://registry.example.test/',
      'cafile=./certs/ca.pem',
      'certfile="certs/ca2.pem"',
      '',
    ].join('\n')
    write(path.join(root, NPMRC), npmrc)

    const prefix = path.join(root, 'npm-install')
    prepareNpmPrefix(prefix, root)

    expect(read(path.join(prefix, NPMRC))).toBe(npmrc)
  })

  it('should not fail without a project npmrc', () => {
    const prefix = path.join(root, 'npm-install')
    prepareNpmPrefix(prefix, root)

    expect(fs.readdirSync(prefix)).toEqual([PACKAGE_JSON])
  })

  it('should not fail when the project npmrc cannot be read', () => {
    const npmrc = path.join(root, NPMRC)
    // a directory cannot be read as a file, whatever the user id
    fs.mkdirSync(npmrc)

    const prefix = path.join(root, 'npm-install')
    prepareNpmPrefix(prefix, root)

    expect(fs.readdirSync(prefix)).toEqual([PACKAGE_JSON])
  })
})

describe('getNpmRegistry', () => {
  const execSync = vi.mocked(childProcess.execSync)
  const config = (value: Record<string, string | undefined>) =>
    execSync.mockReturnValue(JSON.stringify(value))

  beforeEach(() => {
    execSync.mockReset()
  })

  it('should read the registry from the project npmrc', () => {
    write(path.join(root, NPMRC), 'registry=http://127.0.0.1:1/npm')
    config({ registry: 'http://127.0.0.1:1/npm' })

    // npm omits the trailing slash, it has to be added back
    expect(getNpmRegistry(undefined, root)).toBe('http://127.0.0.1:1/npm/')
    expect(execSync).toHaveBeenCalledTimes(1)
  })

  it('should prefer the registry configured for the package scope', () => {
    write(
      path.join(root, NPMRC),
      [
        'registry=http://127.0.0.1:1/npm',
        '@corp:registry=https://npm.corp.test/',
      ].join('\n'),
    )
    config({
      '@corp:registry': 'https://npm.corp.test/',
      registry: 'http://127.0.0.1:1/npm',
    })

    expect(getNpmRegistry('@corp/binding-linux-x64-gnu', root)).toBe(
      'https://npm.corp.test/',
    )
    expect(getNpmRegistry('rolldown', root)).toBe('http://127.0.0.1:1/npm/')
  })

  it('should fail instead of using the public registry when npm cannot be queried', () => {
    write(path.join(root, NPMRC), 'registry=http://127.0.0.1:1/npm/')
    execSync.mockImplementation(() => {
      throw new Error('spawn npm ENOENT')
    })

    // falling back here would let the tarball download fetch from a registry the
    // project never configured
    expect(() => getNpmRegistry(undefined, root)).toThrow(
      'Failed to read the registry from',
    )
  })

  it('should fail when the project config exists but cannot be copied', () => {
    fs.mkdirSync(path.join(root, NPMRC))
    config({ registry: DEFAULT_NPM_REGISTRY })

    expect(() => getNpmRegistry(undefined, root)).toThrow('Failed to read')
  })

  it('should fall back to the default registry without any project config', () => {
    execSync.mockImplementation(() => {
      throw new Error('spawn npm ENOENT')
    })

    expect(getNpmRegistry(undefined, root)).toBe(DEFAULT_NPM_REGISTRY)
  })
})

describe('isShellSafeArgument', () => {
  it('should accept the paths npm install directories actually have', () => {
    expect(isShellSafeArgument('node_modules/@scope/host/npm-install')).toBe(
      true,
    )
    expect(
      isShellSafeArgument(
        'node_modules/.pnpm/@scope+host@1.0.0/node_modules/@scope/host/npm-install',
      ),
    ).toBe(true)
  })

  it('should reject anything a shell would interpret', () => {
    for (const value of [
      'with space/npm-install',
      '$(boom)/npm-install',
      'a;rm -rf b',
      'a|b',
      'a&b',
      'a`b`',
      'a"b',
      'a%b',
      'a*b',
    ]) {
      expect(isShellSafeArgument(value)).toBe(false)
    }
  })
})
