import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/**
 * The fixtures install this package from the repository root, and the `npmrc`
 * acceptance test copies it, so both need `lib/`. Build it here when a plain
 * `yarn test` runs on a clean checkout instead of skipping the only end-to-end
 * proof of the fix in some test file.
 */
export default function setup() {
  if (!fs.existsSync(path.join(ROOT, 'lib', 'index.js'))) {
    execSync('yarn build', { cwd: ROOT, stdio: 'inherit' })
  }
}
