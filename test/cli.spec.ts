import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { checkAndPreparePackage } from 'napi-postinstall'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('napi-postinstall', () => ({
  checkAndPreparePackage: vi.fn(),
}))

const originalArgv = process.argv
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
  vi.resetModules()
})

afterEach(() => {
  process.argv = originalArgv
  process.chdir(originalCwd)
  process.exitCode = originalExitCode
  fs.rmSync(tempDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function loadCli() {
  return import('napi-postinstall/cli')
}

describe('cli', () => {
  it('should use the cwd package when name and version match', async () => {
    process.argv = ['node', 'cli.js', 'fake-host', '1.0.0', '1']

    await loadCli()

    expect(checkAndPreparePackage).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'fake-host', version: '1.0.0' }),
      true,
    )
  })

  it('should fall back to name and version when the cwd package differs', async () => {
    process.argv = ['node', 'cli.js', 'other-host', '2.0.0', '0']

    await loadCli()

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
    process.argv = ['node', 'cli.js', 'fake-host', '1.0.0', '1']

    await loadCli()
    await vi.waitFor(() => expect(process.exitCode).toBe(1))

    expect(consoleError).toHaveBeenCalledWith(error)
  })
})
