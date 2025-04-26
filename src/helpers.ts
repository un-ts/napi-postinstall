import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'

import { DEFAULT_NPM_REGISTRY } from './constants.js'
import { parseTriple } from './target.js'
import { NapiInfo, PackageJson } from './types.js'

export function getGlobalNpmRegistry() {
  try {
    const registry = execSync('npm config get registry', {
      encoding: 'utf8',
    }).trim()
    return registry.endsWith('/') ? registry : `${registry}/`
  } catch {
    return DEFAULT_NPM_REGISTRY
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
  return path.join(pkgLibDir, `${path.basename(subpath)}`)
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
      `No \`napi.targets\` nor \`napi.triples.additional\` field found in \`${name}\`'s \`package.json\`. Please ensure the package is built with NAPI support.`,
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
          `Inconsistent package versions found for \`${name}\` with \`${pkg}\` v${packageVersion} vs v${version}.`,
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

// eslint-disable-next-line sonarjs/cognitive-complexity, sonarjs/function-return-type
export function getNapiNativeTarget(): string[] | string {
  switch (process.platform) {
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
        return 'win32-x64-msvc'
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
  }

  return []
}

const WASI_TARGET = 'wasm32-wasi'

export function getNapiNativeTargets() {
  const targets = getNapiNativeTarget()
  if (Array.isArray(targets)) {
    return [...targets, WASI_TARGET]
  }
  return [targets, WASI_TARGET]
}

export function getErrorMessage(err: unknown) {
  return (err as Error | undefined)?.message || String(err)
}
