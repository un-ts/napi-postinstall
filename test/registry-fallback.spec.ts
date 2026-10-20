import { checkAndPreparePackage } from 'napi-postinstall'
import { vi } from 'vitest'

// the requests made by the JS API carry no credentials, so they must not turn a
// working install into an error when the project registry rejects anonymous
// access
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => 'https://private.example/'),
}))

interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  on: (event: string, listener: (chunk?: Buffer) => void) => void
}

const requests: string[] = []
const manifest = JSON.stringify({
  name: 'fake-pkg',
  version: '1.0.0',
  napi: {
    binaryName: 'fake',
    packageName: '@fake/binding',
    targets: ['x86_64-unknown-linux-gnu'],
  },
})

const responseFor = (url: string): MockResponse =>
  url.startsWith('https://registry.npmjs.org/')
    ? {
        statusCode: 200,
        headers: {},
        on: (event, listener) => {
          if (event === 'data') {
            listener(Buffer.from(manifest))
          } else if (event === 'end') {
            listener()
          }
        },
      }
    : { statusCode: 401, headers: {}, on: vi.fn() }

vi.mock('node:https', () => ({
  default: {
    get: (url: string, callback: (response: MockResponse) => void) => {
      requests.push(url)
      callback(responseFor(url))
      return { on: vi.fn() }
    },
  },
}))

describe('registry fallback', () => {
  // read-only lookup: it keeps working for public packages, and nothing is
  // installed from the fallback
  it('should retry the public registry when the project registry rejects the metadata request', async () => {
    await expect(
      checkAndPreparePackage('fake-pkg', '1.0.0'),
    ).resolves.toBeUndefined()

    expect(requests[0]).toBe('https://private.example/fake-pkg/1.0.0')
    expect(requests[1]).toBe('https://registry.npmjs.org/fake-pkg/1.0.0')
  })
})
