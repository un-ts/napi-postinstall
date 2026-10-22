import { checkAndPreparePackage } from 'napi-postinstall'
import type { PackageJson } from 'napi-postinstall'
import { vi } from 'vitest'

import { getSkipFallbackEnv, hasWasiTarget } from '../src/helpers.js'

// The WASI case below only has to reach the fallback; a real `npm install` and a
// real registry lookup cost tens of seconds of npm start-up on a loaded Windows
// runner, which is what made this test time out. Answer both with the same dead
// registry instead, so nothing leaves the process.
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => JSON.stringify({ registry: 'http://127.0.0.1:1/' })),
}))

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
      `[Error: [napi-postinstall@0.3.7] No \`napi.targets\` nor \`napi.triples.additional\` field found in \`napi-postinstall\`'s \`package.json\`. Please ensure the package is built with NAPI support.]`,
    )
  })

  it('should encode package names for the skip env', () => {
    expect(getSkipFallbackEnv('my-package')).toBe('SKIP_MY_PACKAGE_FALLBACK')
    expect(getSkipFallbackEnv('@scope/my-package')).toBe(
      'SKIP_SCOPE_MY_PACKAGE_FALLBACK',
    )
    expect(getSkipFallbackEnv('x.js')).toBe('SKIP_X_JS_FALLBACK')
  })

  it('should detect a WASI target from napi.targets', () => {
    expect(hasWasiTarget(['wasm32-wasip1-threads'])).toBe(true)
    expect(hasWasiTarget(['x86_64-unknown-linux-gnu'])).toBe(false)
    expect(hasWasiTarget()).toBeUndefined()
  })

  it(
    'should process a WASI target without optionalDependencies',
    { timeout: 30_000 },
    async () => {
      const packageJson: PackageJson = {
        name: 'fake-wasi-package',
        version: '1.0.0',
        napi: {
          binaryName: 'fake',
          packageName: '@fake/binding',
          targets: ['wasm32-wasip1-threads'],
        },
      }
      const consoleError = vi
        .spyOn(console, 'error')
        .mockImplementation(vi.fn())

      try {
        await expect(
          checkAndPreparePackage(packageJson, false),
        ).rejects.toThrow('Failed to install package')
      } finally {
        consoleError.mockRestore()
      }
    },
  )
})
