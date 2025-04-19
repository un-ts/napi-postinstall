import { checkAndPreparePackage } from 'napi-postinstall'

describe('napi-postinstall', () => {
  it('should check and prepare package', async () => {
    await expect(
      checkAndPreparePackage('rollup', true),
    ).rejects.toMatchInlineSnapshot(
      `[Error: No version found for \`rollup\` with \`@rollup/rollup-linux-ppc64-gnu\`.]`,
    )
    await expect(checkAndPreparePackage('rollup')).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('@swc/core', true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('unrs-resolver', true),
    ).resolves.not.toThrow()

    await expect(
      checkAndPreparePackage('napi-postinstall'),
    ).rejects.toThrowErrorMatchingInlineSnapshot(
      `[Error: No \`napi.targets\` nor \`napi.triples.additional\` field found in \`napi-postinstall\`'s \`package.json\`. Please ensure the package is built with NAPI support.]`,
    )
  })
})
