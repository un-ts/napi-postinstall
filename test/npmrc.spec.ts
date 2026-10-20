import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { DEFAULT_NPM_REGISTRY, NPMRC, PACKAGE_JSON } from '../src/constants.js'
import {
  getNpmRegistry,
  getProjectDir,
  prepareNpmPrefix,
} from '../src/helpers.js'

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

  it('should resolve the workspace root of a workspace member', () => {
    write(
      path.join(root, PACKAGE_JSON),
      JSON.stringify({
        name: 'root',
        version: '1.0.0',
        workspaces: ['packages/*'],
      }),
    )
    write(
      path.join(root, 'packages', 'a', PACKAGE_JSON),
      JSON.stringify({ name: 'a', version: '1.0.0' }),
    )

    // npm ignores the `.npmrc` of a workspace member, so the member must not
    // shadow the root that actually holds the config.
    expect(
      getProjectDir(path.join(root, 'packages', 'a', 'node_modules', 'host')),
    ).toBe(root)
    expect(getProjectDir(path.join(root, 'packages', 'a'))).toBe(root)
  })

  it('should resolve the root declared by pnpm-workspace.yaml', () => {
    write(path.join(root, 'pnpm-workspace.yaml'), 'packages:\n  - packages/*\n')

    expect(getProjectDir(path.join(root, 'packages', 'a'))).toBe(root)
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

  // npm resolves these against the prefix, which is a temporary directory now.
  it('should absolutize the path values that npm resolves against the prefix', () => {
    write(
      path.join(root, NPMRC),
      [
        'registry=https://registry.example.test/',
        'cafile=./certs/ca.pem',
        'certfile="certs/ca2.pem"',
        'cache=~/.npm-cache',
        'keyfile=/etc/ssl/key.pem',
        'prefix=' + String.raw`C:\certs`,
        'globalconfig=${NPM_GLOBAL_CONFIG}',
      ].join('\n'),
    )

    const prefix = path.join(root, 'npm-install')
    prepareNpmPrefix(prefix, root)

    expect(read(path.join(prefix, NPMRC)).split('\n')).toEqual([
      'registry=https://registry.example.test/',
      `cafile=${path.join(root, 'certs', 'ca.pem')}`,
      `certfile="${path.join(root, 'certs', 'ca2.pem')}"`,
      'cache=~/.npm-cache',
      'keyfile=/etc/ssl/key.pem',
      'prefix=' + String.raw`C:\certs`,
      'globalconfig=${NPM_GLOBAL_CONFIG}',
    ])
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
  it('should read the registry from the project npmrc', () => {
    write(path.join(root, NPMRC), 'registry=http://127.0.0.1:1/npm/')

    expect(getNpmRegistry(root)).toBe('http://127.0.0.1:1/npm/')
  })

  it('should append the trailing slash npm omits', () => {
    write(path.join(root, NPMRC), 'registry=http://127.0.0.1:1/npm')

    expect(getNpmRegistry(root)).toBe('http://127.0.0.1:1/npm/')
  })

  it('should fall back to the default registry without any config', () => {
    const userconfig = path.join(root, 'user.npmrc')
    const globalconfig = path.join(root, 'global.npmrc')
    write(userconfig, '')
    write(globalconfig, '')
    const env = process.env
    process.env = {
      ...env,
      npm_config_globalconfig: globalconfig,
      npm_config_userconfig: userconfig,
    }
    try {
      expect(getNpmRegistry(root)).toBe(DEFAULT_NPM_REGISTRY)
    } finally {
      process.env = env
    }
  })
})
