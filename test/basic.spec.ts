import { checkAndPreparePackage } from 'napi-postinstall'

describe('napi-postinstall', () => {
  it('should check and prepare package', async () => {
    await expect(
      checkAndPreparePackage('rollup', undefined, true),
    ).resolves.not.toThrow()
    await expect(checkAndPreparePackage('rollup')).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('@swc/core', undefined, true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('unrs-resolver', undefined, true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('napi-postinstall'),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: [napi-postinstall@0.2.4] No \`napi.targets\` nor \`napi.triples.additional\` field found in \`napi-postinstall\`'s \`package.json\`. Please ensure the package is built with NAPI support.]`,
    )
  })
})
