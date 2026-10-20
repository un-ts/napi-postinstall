import { checkAndPreparePackage } from 'napi-postinstall'
import { vi } from 'vitest'

// the requests made by the JS API carry no credentials, so they must fail on the
// configured registry rather than read the manifest from somewhere else
vi.mock('node:child_process', () => ({
  execSync: vi.fn(() =>
    JSON.stringify({ registry: 'https://private.example/' }),
  ),
}))

interface MockResponse {
  statusCode: number
  headers: Record<string, string>
  on: (event: string, listener: (chunk?: Buffer) => void) => void
}

const requests: string[] = []

vi.mock('node:https', () => ({
  default: {
    get: (url: string, callback: (response: MockResponse) => void) => {
      requests.push(url)
      callback({ statusCode: 401, headers: {}, on: vi.fn() })
      return { on: vi.fn() }
    },
  },
}))

describe('registry', () => {
  it('should fail on the configured registry instead of reading the public one', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    try {
      await expect(checkAndPreparePackage('fake-pkg', '1.0.0')).rejects.toThrow(
        'Server responded with 401',
      )
    } finally {
      consoleError.mockRestore()
    }

    expect(requests).toEqual(['https://private.example/fake-pkg/1.0.0'])
  })
})
