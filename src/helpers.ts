import { execSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  DEFAULT_NPM_REGISTRY,
  LOG_PREFIX,
  NPMRC,
  PACKAGE_JSON,
  WASM32_WASI,
} from './constants.js'
import { parseTriple } from './target.js'
import type { NapiInfo, PackageJson, Platform } from './types.js'

const NODE_MODULES_SEGMENT = /([\\/])node_modules\1/

function stripNodeModules(dir: string) {
  const index = dir.search(NODE_MODULES_SEGMENT)
  return index === -1 ? dir : dir.slice(0, index)
}

/**
 * The directory holding the `.npmrc` that applies to the current install.
 *
 * npm only reads project config from `<localPrefix>/.npmrc`, and it resolves no
 * prefix at all when its cwd is inside `node_modules`. For lifecycle scripts it
 * exports the prefix it did resolve, so that value wins; otherwise fall back to
 * the directory that owns the `node_modules` the package was installed into,
 * which is the base case of the same rule and covers pnpm and yarn.
 *
 * Workspace roots are deliberately not re-derived: matching `workspaces` globs
 * and `pnpm-workspace.yaml` would mean reimplementing npm's semantics, and an
 * approximation can hand the nested install another project's registry and
 * credentials. Revisit it if there is user feedback that the workspace root
 * config is missing for an install inside a member's `node_modules`.
 */
export function getProjectDir(cwd = process.cwd()) {
  const localPrefix = process.env.npm_config_local_prefix
  const dir = path.resolve(localPrefix ?? cwd)
  const root = path.parse(dir).root
  const stripped = stripNodeModules(dir)
  // a path that starts at `node_modules` strips down to nothing, or to `C:` on
  // Windows, which is a drive-relative path rather than the root directory
  return !stripped || stripped === root.slice(0, -1) ? root : stripped
}

/**
 * Prepares `dir` to be used as an npm prefix for a nested install: an empty
 * `package.json` so npm does not apply the caller's `devEngines`, and a copy of
 * the project `.npmrc` so the install keeps its registry and credentials.
 *
 * npm reads project config from the prefix but resolves relative values in it
 * against its cwd, so the caller has to run npm from the project directory for
 * settings like `cafile=./certs/ca.pem` to keep pointing at the project.
 *
 * @see https://github.com/un-ts/napi-postinstall/issues/37
 * @see https://github.com/un-ts/napi-postinstall/issues/43
 */
export function prepareNpmPrefix(dir: string, projectDir = getProjectDir()) {
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, PACKAGE_JSON), '{}')
  const npmrc = path.join(dir, NPMRC)
  try {
    // write instead of copying so the file is created with its final mode: a
    // copy is readable before `chmod`, and a failed copy can leave an empty file
    // behind, both of which matter because this file may hold `_authToken`
    const content = fs.readFileSync(path.join(projectDir, NPMRC))
    fs.writeFileSync(npmrc, content, { mode: 0o600 })
  } catch {
    // A missing or unreadable `.npmrc` is not fatal, npm falls back to its
    // built-in defaults just like it does for the caller, but never keep a
    // partial copy around for the nested npm to read.
    try {
      fs.unlinkSync(npmrc)
    } catch {}
  }
}

/**
 * The registry npm would use for `pkg`, honouring `@scope:registry`.
 *
 * One `npm config ls --json` answers both, so a scoped package does not cost a
 * second npm start-up. The lookup runs in a temporary prefix because npm
 * validates `devEngines` against its prefix, so asking from the project
 * directory can fail with EBADDEVENGINES (#70); the nested install does not need
 * this, it gets the project `.npmrc` itself.
 */
export function getNpmRegistry(pkg?: string, projectDir = getProjectDir()) {
  let tempDir: string
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
  } catch (error) {
    errorLog(
      `Failed to read the registry, assuming ${DEFAULT_NPM_REGISTRY}`,
      getErrorMessage(error),
    )
    return DEFAULT_NPM_REGISTRY
  }
  try {
    prepareNpmPrefix(tempDir, projectDir)
    const config = JSON.parse(
      execSync('npm config ls --json', {
        cwd: tempDir,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }),
    ) as Record<string, string | undefined>
    const scope = pkg?.startsWith('@') ? pkg.split('/')[0] : undefined
    const registry =
      (scope && config[`${scope}:registry`]) ||
      config.registry ||
      DEFAULT_NPM_REGISTRY
    return registry.endsWith('/') ? registry : `${registry}/`
  } catch (error) {
    errorLog(
      `Failed to read the registry from \`${path.join(projectDir, NPMRC)}\`, assuming ${DEFAULT_NPM_REGISTRY}`,
      getErrorMessage(error),
    )
    return DEFAULT_NPM_REGISTRY
  } finally {
    try {
      removeRecursive(tempDir, true)
    } catch {}
  }
}

/**
 * `renameSync`, falling back to a copy when the destination is on another
 * filesystem: the temporary directory lives under the project, while a linked
 * host package can live on another volume.
 */
export function movePath(from: string, to: string) {
  try {
    fs.renameSync(from, to)
  } catch (error) {
    // `cpSync` needs Node 16.7+, older versions keep the previous failure
    if (
      (error as NodeJS.ErrnoException).code !== 'EXDEV' ||
      typeof fs.cpSync !== 'function'
    ) {
      throw error
    }
    // `verbatimSymlinks` keeps relative link targets pointing at the copied tree
    // instead of resolving them against the source we are about to remove
    fs.cpSync(from, to, { recursive: true, verbatimSymlinks: true })
    removeRecursive(from)
  }
}

/**
 * Removes `target`, which may be a file or a symlink.
 *
 * Pass `isDir` when the caller already knows, so the type is not looked up again;
 * the recursive calls always do.
 */
export function removeRecursive(
  dir: string,
  isDir = fs.lstatSync(dir).isDirectory(),
) {
  if (!isDir) {
    fs.unlinkSync(dir)
    return
  }
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry)
    let stats: fs.Stats
    try {
      stats = fs.lstatSync(entryPath)
    } catch {
      continue // Guard against https://github.com/nodejs/node/issues/4760
    }
    if (stats.isDirectory()) {
      removeRecursive(entryPath, true)
    } else {
      fs.unlinkSync(entryPath)
    }
  }
  fs.rmdirSync(dir)
}

export function downloadedNodePath(name: string, subpath: string) {
  const pkgLibDir = path.dirname(require.resolve(name + '/package.json'))
  return path.join(pkgLibDir, path.basename(subpath))
}

export function getNapiInfoFromPackageJson(
  packageJson: PackageJson,
  checkVersion: true,
): NapiInfo & { version: string }
export function getNapiInfoFromPackageJson(
  packageJson: PackageJson,
  checkVersion?: boolean,
): NapiInfo
export function getNapiInfoFromPackageJson(
  packageJson: PackageJson,
  checkVersion?: boolean,
) {
  const { name, napi: napi_, optionalDependencies } = packageJson

  // eslint-disable-next-line sonarjs/deprecation
  const targets = napi_?.targets ?? napi_?.triples?.additional

  if (!targets?.length) {
    throw new Error(
      errorMessage(
        `No \`napi.targets\` nor \`napi.triples.additional\` field found in \`${name}\`'s \`package.json\`. Please ensure the package is built with NAPI support.`,
      ),
    )
  }

  const napi = napi_!

  // eslint-disable-next-line sonarjs/deprecation
  napi.binaryName ??= napi.name
  // eslint-disable-next-line sonarjs/deprecation
  napi.packageName ??= napi.package?.name ?? name

  napi.targets = targets

  if (!optionalDependencies) {
    return { napi }
  }

  let version: string | undefined

  for (const target of targets) {
    const { platformArchABI } = parseTriple(target)
    const pkg = `${napi.packageName}-${platformArchABI}`
    const packageVersion = optionalDependencies[pkg]

    if (!packageVersion) {
      continue
    }

    if (version) {
      if (checkVersion && version !== packageVersion) {
        throw new Error(
          errorMessage(
            `Inconsistent package versions found for \`${name}\` with \`${pkg}\` v${packageVersion} vs v${version}.`,
          ),
        )
      }
    } else if (packageVersion) {
      version = packageVersion
      if (!checkVersion) {
        break
      }
    }
  }

  return { napi, version }
}

function isMusl() {
  let musl: boolean | null = false
  if (process.platform === 'linux') {
    musl = isMuslFromFilesystem()
    if (musl === null) {
      musl = isMuslFromReport()
    }
    if (musl === null) {
      musl = isMuslFromChildProcess()
    }
  }
  return musl
}

const isFileMusl = (f: string) =>
  f.includes('libc.musl-') || f.includes('ld-musl-')

function isMuslFromFilesystem() {
  try {
    return fs.readFileSync('/usr/bin/ldd', 'utf8').includes('musl')
  } catch {
    return null
  }
}

function isMuslFromReport() {
  let report: object | null = null
  if (typeof process.report.getReport === 'function') {
    // @ts-expect-error -- not a public API
    process.report.excludeNetwork = true
    report = process.report.getReport()
  }
  if (!report) {
    return null
  }
  if (
    'header' in report &&
    report.header != null &&
    typeof report.header === 'object' &&
    'glibcVersionRuntime' in report.header &&
    report.header.glibcVersionRuntime
  ) {
    return false
  }

  return (
    'sharedObjects' in report &&
    Array.isArray(report.sharedObjects) &&
    // type-coverage:ignore-next-line
    (report.sharedObjects as string[]).some(isFileMusl)
  )
}

function isMuslFromChildProcess() {
  try {
    return execSync('ldd --version', { encoding: 'utf8' }).includes('musl')
  } catch {
    // If we reach this case, we don't know if the system is musl or not, so is better to just fallback to false
    return false
  }
}

// https://github.com/napi-rs/napi-rs/blob/2cdf5fd6fb26ba32aaa9a8e8d4ad5020536ce0de/examples/napi/index.cjs#L66
// eslint-disable-next-line sonarjs/cognitive-complexity, sonarjs/function-return-type
export function getNapiNativeTarget(): string[] | string {
  switch (process.platform as Platform) {
    case 'android': {
      if (process.arch === 'arm64') {
        return 'android-arm64'
      }
      if (process.arch === 'arm') {
        return 'android-arm-eabi'
      }

      break
    }
    case 'win32': {
      if (process.arch === 'x64') {
        const targets: string[] = []
        if (
          (
            process.report.getReport() as { header?: { osName?: string } }
          ).header?.osName?.startsWith('MINGW')
        ) {
          targets.push('win32-x64-gnu')
        }
        targets.push('win32-x64-msvc')
        return targets
      }
      if (process.arch === 'ia32') {
        return 'win32-ia32-msvc'
      }
      if (process.arch === 'arm64') {
        return 'win32-arm64-msvc'
      }

      break
    }
    case 'darwin': {
      const targets = ['darwin-universal']

      if (process.arch === 'x64') {
        targets.push('darwin-x64')
      } else if (process.arch === 'arm64') {
        targets.push('darwin-arm64')
      }

      return targets
    }
    case 'freebsd': {
      if (process.arch === 'x64') {
        return 'freebsd-x64'
      }
      if (process.arch === 'arm64') {
        return 'freebsd-arm64'
      }

      break
    }
    case 'linux': {
      if (process.arch === 'x64') {
        if (isMusl()) {
          return 'linux-x64-musl'
        }
        return 'linux-x64-gnu'
      }
      if (process.arch === 'arm64') {
        if (isMusl()) {
          return 'linux-arm64-musl'
        }
        return 'linux-arm64-gnu'
      }
      if (process.arch === 'arm') {
        if (isMusl()) {
          return 'linux-arm-musleabihf'
        }
        return 'linux-arm-gnueabihf'
      }
      if (process.arch === 'loong64') {
        if (isMusl()) {
          return 'linux-loong64-musl'
        }
        return 'linux-loong64-gnu'
      }
      if (process.arch === 'riscv64') {
        if (isMusl()) {
          return 'linux-riscv64-musl'
        }
        return 'linux-riscv64-gnu'
      }
      if (process.arch === 'ppc64') {
        return 'linux-ppc64-gnu'
      }
      if (process.arch === 's390x') {
        return 'linux-s390x-gnu'
      }

      break
    }
    case 'openharmony': {
      if (process.arch === 'arm64') {
        return 'openharmony-arm64'
      }
      if (process.arch === 'x64') {
        return 'openharmony-x64'
      }
      if (process.arch === 'arm') {
        return 'openharmony-arm'
      }

      break
    }
  }

  return []
}

const WASI_TARGET = 'wasm32-wasi'

export function getNapiNativeTargets() {
  if (process.versions.webcontainer) {
    return [WASI_TARGET]
  }
  const targets = getNapiNativeTarget()
  if (Array.isArray(targets)) {
    return [...targets, WASI_TARGET]
  }
  return [targets, WASI_TARGET]
}

export function hasWasiTarget(targets?: string[]) {
  return targets?.some(
    target => parseTriple(target).platformArchABI === WASM32_WASI,
  )
}

export function getErrorMessage(err: unknown) {
  return (err as Error | undefined)?.message || String(err)
}

export function errorLog(message: string, ...args: unknown[]) {
  console.error(`${LOG_PREFIX}${message}`, ...args)
}

export function errorMessage(message: string, extra?: string) {
  return `${LOG_PREFIX}${message}` + (extra ? ': ' + extra : '')
}
