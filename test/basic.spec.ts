import { checkAndPreparePackage } from 'napi-postinstall'

import { hasWasiTarget } from '../src/helpers.js'

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
})
