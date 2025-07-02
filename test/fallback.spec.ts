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
