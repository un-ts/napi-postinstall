import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import unrsResolver = require('unrs-resolver')

// @ts-expect-error -- don't use `import fallback = require('napi-postinstall/fallback')` due to vitest code coverage
import fallback_ from 'napi-postinstall/fallback'

const fallback = fallback_ as typeof import('napi-postinstall/fallback')

describe.skipIf(process.platform === 'win32')('fallback', () => {
  afterEach(() => {
    delete process.env.SKIP_UNRS_RESOLVER_FALLBACK
    delete process.versions.webcontainer
  })

  it('should resolve napi package successfully and set skip env after processing', () => {
    expect(fallback(require.resolve('unrs-resolver/package.json'))).toBe(
      unrsResolver,
    )
    expect(process.env.SKIP_UNRS_RESOLVER_FALLBACK).toBe('1')
  })

  it('should support napi.targets without optionalDependencies', () => {
    const name = 'fake-wasi-target'
    const version = '1.0.0'
    const packageName = '@fake/binding'
    const bindingPkgName = `${packageName}-wasm32-wasi`
    const binaryName = 'fake'
    const baseDir = path.resolve(os.tmpdir(), `${name}-${version}`)
    const bindingEntry = path.resolve(
      baseDir,
      'node_modules',
      bindingPkgName,
      `${binaryName}.wasi.cjs`,
    )

    fs.rmSync(baseDir, { force: true, recursive: true })
    fs.mkdirSync(path.dirname(bindingEntry), { recursive: true })
    fs.writeFileSync(bindingEntry, 'module.exports = { fake: true }')

    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'napi-postinstall-'),
    )
    const packageJsonPath = path.join(fixtureDir, 'package.json')

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name,
        version,
        napi: {
          binaryName,
          packageName,
          targets: ['wasm32-wasip1-threads'],
        },
      }),
    )

    process.versions.webcontainer = '1'

    try {
      expect(fallback<{ fake: boolean }>(packageJsonPath, true)).toEqual({
        fake: true,
      })
    } finally {
      fs.rmSync(fixtureDir, { force: true, recursive: true })
      fs.rmSync(baseDir, { force: true, recursive: true })
    }
  })

  it('should reject a package without a WASI target', () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'napi-postinstall-'),
    )
    const packageJsonPath = path.join(fixtureDir, 'package.json')

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name: 'fake-native-target',
        version: '1.0.0',
        napi: {
          binaryName: 'fake',
          packageName: '@fake/binding',
          targets: ['x86_64-unknown-linux-gnu'],
        },
      }),
    )

    process.versions.webcontainer = '1'

    try {
      expect(() => fallback(packageJsonPath, true)).toThrow(
        'target is unavailable',
      )
    } finally {
      fs.rmSync(fixtureDir, { force: true, recursive: true })
    }
  })

  it('should reject non-WASI wasm32 targets', () => {
    const fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), 'napi-postinstall-'),
    )
    const packageJsonPath = path.join(fixtureDir, 'package.json')

    fs.writeFileSync(
      packageJsonPath,
      JSON.stringify({
        name: 'fake-wasix-target',
        version: '1.0.0',
        napi: {
          binaryName: 'fake',
          packageName: '@fake/binding',
          targets: ['wasm32-wasix'],
        },
      }),
    )

    process.versions.webcontainer = '1'

    try {
      expect(() => fallback(packageJsonPath, true)).toThrow(
        'target is unavailable',
      )
    } finally {
      fs.rmSync(fixtureDir, { force: true, recursive: true })
    }
  })

  it('should support webcontainer', () => {
    process.versions.webcontainer = '1'
    const resolved = fallback<typeof unrsResolver>(
      require.resolve('unrs-resolver/package.json'),
      true,
    )
    expect(resolved).not.toBe(unrsResolver)
    expect(typeof resolved.sync).toBe('function')
  })
})
