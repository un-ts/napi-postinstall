import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { movePath } from '../src/helpers.js'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
})

afterEach(() => {
  vi.restoreAllMocks()
  fs.rmSync(root, { recursive: true, force: true })
})

const createSource = () => {
  const from = path.join(root, 'from')
  fs.mkdirSync(from)
  fs.writeFileSync(path.join(from, 'file'), 'content')
  return from
}

describe('movePath', () => {
  it('should rename on the same filesystem', () => {
    const from = createSource()
    const to = path.join(root, 'to')

    movePath(from, to)

    expect(fs.readFileSync(path.join(to, 'file'), 'utf8')).toBe('content')
    expect(fs.existsSync(from)).toBe(false)
  })

  // a linked host package can live on another volume, which `rename` cannot cross
  it('should copy and drop the source across filesystems', () => {
    const from = createSource()
    const to = path.join(root, 'to')
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('cross-device link'), { code: 'EXDEV' })
    })

    movePath(from, to)

    expect(fs.readFileSync(path.join(to, 'file'), 'utf8')).toBe('content')
    expect(fs.existsSync(from)).toBe(false)
  })

  it('should rethrow anything else', () => {
    const from = createSource()
    vi.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' })
    })

    expect(() => movePath(from, path.join(root, 'to'))).toThrow(
      'permission denied',
    )
  })
})
