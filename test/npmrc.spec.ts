import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { vi } from 'vitest'

import { DEFAULT_NPM_REGISTRY } from '../src/constants.js'
import { copyNpmrcTo, getNpmRegistry } from '../src/helpers.js'

vi.mock('node:child_process', async () => {
  const fs = await import('node:fs')
  const path = await import('node:path')

  return {
    execSync: vi.fn((_command: string, options: { cwd: string }) => {
      const content = fs.readFileSync(path.join(options.cwd, '.npmrc'), 'utf8')
      const registry = /^registry=(.*)$/m.exec(content)?.[1] ?? ''
      return `${registry}\n`
    }),
  }
})

describe('npmrc', () => {
  it('should copy the project npmrc into the temporary directory', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    try {
      const installDir = path.join(root, 'node_modules', 'host', 'npm-install')
      fs.mkdirSync(installDir, { recursive: true })
      const content = 'registry=https://registry.example.test/\n'
      fs.writeFileSync(path.join(root, '.npmrc'), content)

      copyNpmrcTo(installDir, root)

      expect(fs.readFileSync(path.join(installDir, '.npmrc'), 'utf8')).toBe(
        content,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should resolve the registry from the temporary prefix', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    try {
      fs.writeFileSync(
        path.join(root, '.npmrc'),
        'registry=https://registry.example.test/\n',
      )

      expect(getNpmRegistry(root)).toBe('https://registry.example.test/')
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should ignore a missing npmrc', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    try {
      const installDir = path.join(root, 'npm-install')
      fs.mkdirSync(installDir)

      expect(() => copyNpmrcTo(installDir, root)).not.toThrow()
      expect(fs.existsSync(path.join(installDir, '.npmrc'))).toBe(false)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should find the nearest npmrc in a monorepo', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    try {
      const nested = path.join(root, 'packages', 'pkg')
      const installDir = path.join(root, 'npm-install')
      fs.mkdirSync(nested, { recursive: true })
      fs.mkdirSync(installDir)
      const content = 'registry=https://registry.example.test/\n'
      fs.writeFileSync(path.join(root, '.npmrc'), content)

      copyNpmrcTo(installDir, nested)

      expect(fs.readFileSync(path.join(installDir, '.npmrc'), 'utf8')).toBe(
        content,
      )
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })

  it('should fall back to the default registry when npm fails', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    try {
      vi.mocked(execSync).mockImplementationOnce(() => {
        throw new Error('npm unavailable')
      })

      expect(getNpmRegistry(root)).toBe(DEFAULT_NPM_REGISTRY)
    } finally {
      fs.rmSync(root, { recursive: true, force: true })
    }
  })
})
