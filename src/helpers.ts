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

const NODE_MODULES_SEGMENT = /[\\/]node_modules[\\/]/
const PNPM_WORKSPACE = 'pnpm-workspace.yaml'

function stripNodeModules(dir: string) {
  const index = dir.search(NODE_MODULES_SEGMENT)
  return index === -1 ? dir : dir.slice(0, index)
}

function declaresWorkspaces(dir: string) {
  try {
    const { workspaces } = JSON.parse(
      fs.readFileSync(path.join(dir, PACKAGE_JSON), 'utf8'),
    ) as { workspaces?: unknown }
    return Boolean(workspaces)
  } catch {
    return false
  }
}

function findWorkspaceRoot(dir: string) {
  let current = dir
  for (;;) {
    if (
      fs.existsSync(path.join(current, PNPM_WORKSPACE)) ||
      declaresWorkspaces(current)
    ) {
      return current
    }
    const parent = path.dirname(current)
    if (parent === current) {
      return dir
    }
    current = parent
  }
}

/**
 * The directory holding the `.npmrc` that applies to the current install.
 *
 * npm only reads project config from `<localPrefix>/.npmrc`, and it resolves no
 * prefix at all when its cwd is inside `node_modules`, so neither the cwd nor an
 * ancestor lookup is enough on its own.
 */
export function getProjectDir(cwd = process.cwd()) {
  // npm computes `localPrefix` from its own working directory and exports it to
  // lifecycle scripts, so this value already accounts for nested installs and
  // for workspaces.
  const localPrefix = process.env.npm_config_local_prefix
  if (localPrefix) {
    return stripNodeModules(path.resolve(localPrefix))
  }
  // pnpm/yarn do not export it and programmatic callers have no env at all:
  // rebuild it the way npm does. Drop the `node_modules/<pkg>` segments the
  // package was installed into, then walk up to the workspace root, because npm
  // ignores the `.npmrc` of a workspace member.
  return findWorkspaceRoot(stripNodeModules(path.resolve(cwd)))
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
  try {
    const npmrc = path.join(dir, NPMRC)
    fs.copyFileSync(path.join(projectDir, NPMRC), npmrc)
    fs.chmodSync(npmrc, 0o600)
  } catch {
    // A missing or unreadable `.npmrc` is not fatal, npm falls back to its
    // built-in defaults just like it does for the caller.
  }
}

export function getNpmRegistry(projectDir = getProjectDir()) {
  let tempDir: string | undefined
  try {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'napi-postinstall-'))
    prepareNpmPrefix(tempDir, projectDir)
    const registry = execSync('npm config get registry', {
      cwd: tempDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    if (!registry) {
      return DEFAULT_NPM_REGISTRY
    }
    return registry.endsWith('/') ? registry : `${registry}/`
  } catch {
    return DEFAULT_NPM_REGISTRY
  } finally {
    if (tempDir) {
      try {
        removeRecursive(tempDir)
      } catch {}
    }
  }
}

export function removeRecursive(dir: string) {
  for (const entry of fs.readdirSync(dir)) {
    const entryPath = path.join(dir, entry)
    let stats: fs.Stats
    try {
      stats = fs.lstatSync(entryPath)
    } catch {
      continue // Guard against https://github.com/nodejs/node/issues/4760
    }
    if (stats.isDirectory()) {
      removeRecursive(entryPath)
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
