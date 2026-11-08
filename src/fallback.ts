import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { WASM32_WASI } from './constants.js'
import {
  errorMessage,
  getNapiInfoFromPackageJson,
  getSkipFallbackEnv,
  hasWasiTarget,
} from './helpers.js'
import type { PackageJson } from './types.js'

/**
 * Fallback for webcontainer and docker environments like
 *
 * @param packageJsonPath The absolute path to the package.json file.
 * @param checkVersion Whether to check version matching
 * @see https://github.com/un-ts/eslint-plugin-import-x/issues/337.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
function fallback<T = unknown>(packageJsonPath: string, checkVersion?: boolean) {
  const packageJson = require(packageJsonPath) as PackageJson

  const { name, version: pkgVersion, optionalDependencies } = packageJson

  const { napi, version = pkgVersion } = getNapiInfoFromPackageJson(packageJson, checkVersion)

  if (checkVersion && pkgVersion !== version) {
    throw new Error(
      errorMessage(
        `Inconsistent package versions found for \`${name}\` v${pkgVersion} vs \`${napi.packageName}\` v${version}.`,
      ),
    )
  }

  const bindingPkgName = `${napi.packageName}-${WASM32_WASI}`

  if (process.versions.webcontainer) {
    // napi keeps the WASI fallback out of `optionalDependencies` when it is not
    // the only target, so also accept the configured `napi.targets`.
    if (!optionalDependencies?.[bindingPkgName] && !hasWasiTarget(napi.targets)) {
      throw new Error(
        errorMessage(`\`${WASM32_WASI}\` target is unavailable for \`${name}\` v${version}`),
      )
    }

    const baseDir = path.resolve(os.tmpdir(), `${name}-${version}`)

    const bindingEntry = path.resolve(
      baseDir,
      `node_modules/${bindingPkgName}/${napi.binaryName}.wasi.cjs`,
    )

    if (!fs.existsSync(bindingEntry)) {
      fs.rmSync(baseDir, { recursive: true, force: true })
      fs.mkdirSync(baseDir, { recursive: true })

      const bindingPkg = `${bindingPkgName}@${version}`

      console.log(errorMessage(`Downloading \`${bindingPkg}\` on WebContainer...`))

      execFileSync('pnpm', ['i', bindingPkg], {
        cwd: baseDir,
        stdio: 'inherit',
      })
    }

    return require(bindingEntry) as T
  }

  const cliPath = require.resolve('napi-postinstall/cli')

  const pkgDir = path.dirname(packageJsonPath)

  execFileSync(process.execPath, [cliPath, name, pkgVersion, checkVersion ? '1' : '0'], {
    cwd: pkgDir,
    stdio: 'inherit',
  })

  const skipFallbackEnv = getSkipFallbackEnv(name)
  const previousSkipFallback = process.env[skipFallbackEnv]

  process.env[skipFallbackEnv] = '1'

  try {
    const PKG_RESOLVED_PATH = require.resolve(pkgDir)

    delete require.cache[PKG_RESOLVED_PATH]

    try {
      return require(pkgDir) as T
    } catch (error) {
      // The loader may have cached the failed WASI lookup from before the install.
      // Try the freshly installed binding directly before giving up on this run.
      if (optionalDependencies?.[bindingPkgName] || hasWasiTarget(napi.targets)) {
        try {
          return require(
            require.resolve(`${bindingPkgName}/${napi.binaryName}.wasi.cjs`, {
              paths: [pkgDir],
            }),
          ) as T
        } catch (wasiError) {
          if (error instanceof Error && wasiError instanceof Error) {
            const hostError = error as Error & { cause?: unknown }
            const wasiFailure = wasiError as Error & { cause?: unknown }
            wasiFailure.cause ??= hostError.cause
            hostError.cause = wasiFailure
          }
        }
      }
      throw error
    }
  } finally {
    // Only guard this reload; another copy of the host package may still need
    // its own fallback.
    if (previousSkipFallback === undefined) {
      delete process.env[skipFallbackEnv]
    } else {
      process.env[skipFallbackEnv] = previousSkipFallback
    }
  }
}

export = fallback
