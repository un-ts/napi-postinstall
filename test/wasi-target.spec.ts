import { checkAndPreparePackage } from 'napi-postinstall'
import type { PackageJson } from 'napi-postinstall'
import { vi } from 'vitest'

vi.mock('node:child_process', () => ({
  execSync: vi.fn(() => {
    throw new Error('npm unavailable in test')
  }),
}))

vi.mock('node:http', () => ({
  default: {
    get: (
      _url: string,
      callback: (response: {
        statusCode: number
        headers: Record<string, string>
      }) => void,
    ) => {
      callback({ statusCode: 404, headers: {} })
      return { on: vi.fn() }
    },
  },
}))

vi.mock('node:https', () => ({
  default: {
    get: (
      _url: string,
      callback: (response: {
        statusCode: number
        headers: Record<string, string>
      }) => void,
    ) => {
      callback({ statusCode: 404, headers: {} })
      return { on: vi.fn() }
    },
  },
}))

describe('napi-postinstall WASI target', () => {
  it('should process a WASI target without optionalDependencies', async () => {
    const packageJson: PackageJson = {
      name: 'fake-wasi-package',
      version: '1.0.0',
      napi: {
        binaryName: 'fake',
        packageName: '@fake/binding',
        targets: ['wasm32-wasip1-threads'],
      },
    }
    const consoleError = vi.spyOn(console, 'error').mockImplementation(vi.fn())

    try {
      await expect(checkAndPreparePackage(packageJson, false)).rejects.toThrow(
        'Failed to install package',
      )
    } finally {
      consoleError.mockRestore()
    }
  })
})
