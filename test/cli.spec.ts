import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { run } from '../src/cli.js'
import { checkAndPreparePackage } from '../src/index.js'

vi.mock('../src/index.js', () => ({
  checkAndPreparePackage: vi.fn(),
}))

const originalCwd = process.cwd()
const originalExitCode = process.exitCode

let tempDir: string

beforeEach(() => {
  tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
  fs.writeFileSync(
    path.join(tempDir, 'package.json'),
    JSON.stringify({ name: 'fake-host', version: '1.0.0' }),
  )
  process.chdir(tempDir)
  process.exitCode = 0
  vi.mocked(checkAndPreparePackage)
    .mockReset()
    .mockImplementation(() => Promise.resolve())
})

afterEach(() => {
  process.chdir(originalCwd)
  process.exitCode = originalExitCode
  fs.rmSync(tempDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

describe('cli', () => {
  it('should use the cwd package when name and version match', async () => {
    await expect(run('fake-host', '1.0.0', '1')).resolves.toBeUndefined()

    expect(checkAndPreparePackage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fake-host', version: '1.0.0' }),
      true,
    )
  })

  it('should fall back to name and version when the cwd package differs', async () => {
    await expect(run('other-host', '2.0.0', '0')).resolves.toBeUndefined()

    expect(checkAndPreparePackage).toHaveBeenCalledWith(
      'other-host',
      '2.0.0',
      false,
    )
  })

  it('should surface failures through the exit code', async () => {
    const error = new Error('boom')
    vi.mocked(checkAndPreparePackage).mockRejectedValueOnce(error)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => 0)

    await expect(run('fake-host', '1.0.0', '1')).resolves.toBeUndefined()

    expect(consoleError).toHaveBeenCalledWith(error)
    expect(process.exitCode).toBe(1)
  })
})
