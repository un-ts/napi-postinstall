import { execFileSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import { WASM32_WASI } from './constants.js'
import { errorMessage, getNapiInfoFromPackageJson } from './helpers.js'
import type { PackageJson } from './types.js'

const EXECUTORS = {
  npm: 'npx',
  pnpm: 'pnpm',
  yarn: 'yarn',
  bun: 'bun',
  deno: (args: string[]) => ['deno', 'run', `npm:${args[0]}`, ...args.slice(1)],
}

function constructCommand(
  value: string[] | string | ((args: string[]) => string[]),
  args: string[],
) {
  const list =
    typeof value === 'function'
      ? value(args)
      : // eslint-disable-next-line unicorn-x/prefer-spread
        ([] as string[]).concat(value, args)
  return {
    command: list[0],
    args: list.slice(1),
  }
}

/**
 * Fallback for webcontainer and docker environments like
 * @see https://github.com/un-ts/eslint-plugin-import-x/issues/337.
 *
 * @param packageJsonPath The absolute path to the package.json file.
 * @param checkVersion Whether to check version matching
 */
function fallback<T = unknown>(
  packageJsonPath: string,
  checkVersion?: boolean,
) {
  const packageJson = require(packageJsonPath) as PackageJson

  const { name, version: pkgVersion, optionalDependencies } = packageJson

  const { napi, version = pkgVersion } = getNapiInfoFromPackageJson(
    packageJson,
    checkVersion,
  )

  if (checkVersion && pkgVersion !== version) {
    throw new Error(
      errorMessage(
        `Inconsistent package versions found for \`${name}\` v${pkgVersion} vs \`${napi.packageName}\` v${version}.`,
      ),
    )
  }

  if (process.versions.webcontainer) {
    const bindingPkgName = `${napi.packageName}-${WASM32_WASI}`

    if (!optionalDependencies?.[bindingPkgName]) {
      throw new Error(
        errorMessage(
          `\`${WASM32_WASI}\` target is unavailable for \`${name}\` v${version}`,
        ),
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

      console.log(
        errorMessage(`Downloading \`${bindingPkg}\` on WebContainer...`),
      )

      execFileSync('pnpm', ['i', bindingPkg], {
        cwd: baseDir,
        stdio: 'inherit',
      })
    }

    return require(bindingEntry) as T
  }

  const userAgent = ((process.env.npm_config_user_agent || '').split('/')[0] ||
    'npm') as keyof typeof EXECUTORS

  const executor = EXECUTORS[userAgent]

  if (!executor) {
    throw new Error(
      errorMessage(
        `Unsupported package manager: ${userAgent}. Supported managers are: ${Object.keys(
          EXECUTORS,
        ).join(', ')}.`,
      ),
    )
  }

  const { command, args } = constructCommand(executor, [
    'napi-postinstall',
    name,
    version,
    checkVersion ? '1' : '0',
  ])

  const pkgDir = path.dirname(packageJsonPath)

  execFileSync(command, args, {
    cwd: pkgDir,
    stdio: 'inherit',
  })

  // eslint-disable-next-line unicorn-x/prefer-string-replace-all
  process.env[`SKIP_${name.replace(/-/g, '_').toUpperCase()}_FALLBACK`] = '1'

  const PKG_RESOLVED_PATH = require.resolve(pkgDir)

  delete require.cache[PKG_RESOLVED_PATH]

  return require(pkgDir) as T
}

export = fallback
