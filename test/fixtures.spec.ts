import path = require('node:path')

import { exec } from 'tinyexec'

vi.setConfig({ testTimeout: 5 * 60_000 })

const fixtures = path.resolve(__dirname, 'fixtures')

const removeUnrelatedWarnings = (stderr: string) =>
  stderr
    .split(/\r?\n/)
    .filter(
      line =>
        !line.startsWith('npm warn') &&
        !line.startsWith('! Corepack is about to download'),
    )
    .join('\n')
    .trim()

describe('npm fixture', () => {
  it('should just work', async () => {
    const res = await exec('npm', ['install'], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'npm'),
      },
    })
    expect(removeUnrelatedWarnings(res.stderr)).toBe('')
  })
})

describe('npm-10 fixture', () => {
  it('should just work', async () => {
    const res = await exec('npm', ['install'], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'npm-10'),
      },
    })
    expect(removeUnrelatedWarnings(res.stderr)).toBe('')
  })
})

describe('pnpm fixture', () => {
  it('should just work', async () => {
    const res = await exec('pnpm', ['install'], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'pnpm'),
      },
    })
    expect(removeUnrelatedWarnings(res.stderr)).toBe('')
  })
})

describe('yarn fixture', () => {
  it('should just work', async () => {
    const res = await exec('yarn', [], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'yarn'),
      },
    })
    expect(removeUnrelatedWarnings(res.stderr)).toBe('')
  })
})

describe('yarn pnp fixture', () => {
  it('should not work and warn user', async () => {
    const res = await exec('yarn', [], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'yarn-pnp'),
      },
    })
    expect(removeUnrelatedWarnings(res.stderr)).toBe('')
  })
})
