import path = require('node:path')

import { exec } from 'tinyexec'

vi.setConfig({ testTimeout: 5 * 60_000 })

const fixtures = path.resolve(__dirname, 'fixtures')

describe('npm fixture', () => {
  it('should just work', () =>
    expect(
      exec('npm', ['install'], {
        nodeOptions: {
          cwd: path.resolve(fixtures, 'npm'),
        },
      }),
    ).resolves.not.toThrow())
})

describe('npm-10 fixture', () => {
  it('should just work', () =>
    expect(
      exec('npm', ['install'], {
        nodeOptions: {
          cwd: path.resolve(fixtures, 'npm-10'),
        },
      }),
    ).resolves.not.toThrow())
})

describe('pnpm fixture', () => {
  it('should just work', () =>
    expect(
      exec('pnpm', ['install'], {
        nodeOptions: {
          cwd: path.resolve(fixtures, 'pnpm'),
        },
      }),
    ).resolves.not.toThrow())
})

describe('yarn fixture', () => {
  it('should just work', async () => {
    const res = await exec('yarn', [], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'yarn'),
      },
    })
    expect(res.stderr).toEqual('')
  })
})

describe('yarn pnp fixture', () => {
  it('should just work', async () => {
    const res = await exec('yarn', [], {
      nodeOptions: {
        cwd: path.resolve(fixtures, 'yarn-pnp'),
      },
    })
    expect(res.stderr).toEqual('')
  })
})
