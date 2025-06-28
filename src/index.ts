// based on https://github.com/evanw/esbuild/blob/4475787eef4c4923b92b9fa37ebba1c88b9e1d9b/lib/npm/node-install.ts

import { execSync } from 'node:child_process'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as path from 'node:path'
import * as zlib from 'node:zlib'

import { meta, PACKAGE_JSON, WASM32, WASM32_WASI } from './constants.js'
import {
  downloadedNodePath,
  errorLog,
  errorMessage,
  getErrorMessage,
  getGlobalNpmRegistry,
  getNapiInfoFromPackageJson,
  getNapiNativeTargets,
  removeRecursive,
} from './helpers.js'
import type { PackageJson } from './types.js'

export type * from './types.js'

const REDIRECT_STATUS_CODES = new Set([301, 302, 307, 308])

function fetch(url: string) {
  return new Promise<Buffer>((resolve, reject) => {
    https
      .get(url, res => {
        if (
          REDIRECT_STATUS_CODES.has(res.statusCode!) &&
          res.headers.location
        ) {
          fetch(res.headers.location).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          return reject(new Error(`Server responded with ${res.statusCode}`))
        }
        const chunks: Buffer[] = []
        res.on('data', (chunk: Buffer) => chunks.push(chunk))
        res.on('end', () => resolve(Buffer.concat(chunks)))
      })
      .on('error', reject)
  })
}

function extractFileFromTarGzip(buffer: Buffer, subpath: string) {
  try {
    buffer = zlib.unzipSync(buffer)
  } catch (err) {
    throw new Error(
      errorMessage(`Invalid gzip data in archive`, getErrorMessage(err)),
    )
  }
  const str = (i: number, n: number) =>
    // eslint-disable-next-line sonarjs/slow-regex
    String.fromCodePoint(...buffer.subarray(i, i + n)).replace(/\0.*$/, '')
  let offset = 0
  subpath = `package/${subpath}`
  while (offset < buffer.length) {
    const name = str(offset, 100)
    const size = Number.parseInt(str(offset + 124, 12), 8)
    offset += 512
    if (!Number.isNaN(size)) {
      if (name === subpath) {
        return buffer.subarray(offset, offset + size)
      }
      offset += (size + 511) & ~511
    }
  }
  throw new Error(errorMessage(`Could not find \`${subpath}\` in archive`))
}

export function isNpm() {
  return process.env.npm_config_user_agent?.startsWith('npm/')
}

export function isPnp() {
  return !!process.versions.pnp
}

// eslint-disable-next-line sonarjs/cognitive-complexity
function installUsingNPM(
  hostPkg: string,
  pkg: string,
  version: string,
  target: string,
  subpath: string,
  nodePath: string,
) {
  // WASM32_WASI is a special case because it requires the whole "node_modules"
  // of its dependencies to be present.
  const isWasm32Wasi = target === WASM32_WASI

  // Erase "npm_config_global" so that "npm install --global <napi>" works.
  // Otherwise this nested "npm install" will also be global, and the install
  // will deadlock waiting for the global installation lock.
  const env = { ...process.env, npm_config_global: undefined }

  // Create a temporary directory inside the "<napi>" package with an empty
  // "package.json" file. We'll use this to run "npm install" in.
  const pkgDir = path.dirname(require.resolve(hostPkg + `/${PACKAGE_JSON}`))
  const installDir = path.join(pkgDir, 'npm-install')
  try {
    fs.mkdirSync(installDir, { recursive: true })
  } catch (err) {
    const error = err as NodeJS.ErrnoException
    if (error.code === 'EROFS') {
      // This can happen if the package is installed in a read-only location
      // (e.g. "node_modules" inside a read-only directory). In this case, we
      // can't install the package and should just give up.
      errorLog(
        `Failed to create the temporary directory on read-only location: ${error.message}`,
      )
      errorLog(`You have to install \`${pkg}\` manually in this case.`)
      return
    }
    throw err
  }
  try {
    const packageJsonPath = path.join(installDir, PACKAGE_JSON)

    fs.writeFileSync(packageJsonPath, '{}')

    // Run "npm install" in the temporary directory which should download the
    // desired package. Try to avoid unnecessary log output. This uses the "npm"
    // command instead of a HTTP request so that it hopefully works in situations
    // where HTTP requests are blocked but the "npm" command still works due to,
    // for example, a custom configured npm registry and special firewall rules.
    // eslint-disable-next-line sonarjs/os-command
    execSync(
      `npm install --loglevel=error --prefer-offline --no-audit --progress=false${
        isWasm32Wasi ? ` --cpu=${WASM32} --force` : ''
      } ${pkg}@${version}`,
      { cwd: installDir, stdio: 'pipe', env },
    )

    // Remove the unused "package.json" file
    if (isWasm32Wasi) {
      fs.unlinkSync(packageJsonPath)
    }

    const nodeModulesDir = path.join(installDir, 'node_modules')

    try {
      if (isWasm32Wasi) {
        const newNodeModulesDir = path.resolve(installDir, '../node_modules')
        const dirs = fs.readdirSync(nodeModulesDir)
        for (const dir of dirs) {
          // scoped packages need to be moved recursively in case there are same
          // scoped packages already installed by the <napi> package
          if (dir.startsWith('@')) {
            const newPath = path.join(newNodeModulesDir, dir)
            fs.mkdirSync(newPath, { recursive: true })
            const subdir = path.join(nodeModulesDir, dir)
            const nestedDirs = fs.readdirSync(subdir)
            for (const nestedDir of nestedDirs) {
              try {
                fs.renameSync(
                  path.join(subdir, nestedDir),
                  path.join(newPath, nestedDir),
                )
              } catch {
                // Ignore errors when renaming the directory, for example the
                // dependency could already be present.
              }
            }
          } else {
            try {
              fs.renameSync(
                path.join(nodeModulesDir, dir),
                path.join(newNodeModulesDir, dir),
              )
            } catch {
              // Ignore errors when renaming the directory, for example the
              // dependency could already be present.
            }
          }
        }
      } else {
        /**
         * Try to move up the <napi> package directory to the parent
         * "node_modules". This is a bit of a hack but it works around the
         * problem that legacy npm versions does not respect
         * "optionalDependencies" when "package-lock.json" presented, but it's
         * fine to fail here.
         *
         * See also [npm/cli#4828](https://github.com/npm/cli/issues/4828)
         */
        const newPath = path.resolve(
          pkgDir,
          hostPkg
            .split('/')
            .map(() => '..')
            .join('/'),
          pkg,
        )
        fs.mkdirSync(newPath, { recursive: true })
        fs.renameSync(path.join(nodeModulesDir, pkg), newPath)
      }
    } catch {
      // Move the downloaded binary executable into place. The destination path
      // is the same one that the JavaScript API code uses so it will be able to
      // find the binary executable here later.
      fs.renameSync(path.join(nodeModulesDir, pkg, subpath), nodePath)
    }
  } finally {
    try {
      // Try to clean up afterward so we don't unnecessarily waste file system
      // space. Leaving nested "node_modules" directories can also be problematic
      // for certain tools that scan over the file tree and expect it to have a
      // certain structure.
      removeRecursive(installDir)
    } catch {
      // Removing a file or directory can randomly break on Windows, returning
      // EBUSY for an arbitrary length of time. I think this happens when some
      // other program has that file or directory open (e.g. an anti-virus
      // program). This is fine on Unix because the OS just unlinks the entry
      // but keeps the reference around until it's unused. There's nothing we
      // can do in this case so we just leave the directory there.
    }
  }
}

async function downloadDirectlyFromNPM(
  pkg: string,
  version: string,
  subpath: string,
  nodePath: string,
) {
  // If that fails, the user could have npm configured incorrectly or could not
  // have npm installed. Try downloading directly from npm as a last resort.
  const url = `${getGlobalNpmRegistry()}${pkg}/-/${pkg.startsWith('@') ? pkg.split('/')[1] : pkg}-${version}.tgz`
  errorLog(`Trying to download ${JSON.stringify(url)}`)
  try {
    fs.writeFileSync(
      nodePath,
      extractFileFromTarGzip(await fetch(url), subpath),
    )
  } catch (err) {
    errorLog(`Failed to download ${JSON.stringify(url)}`, getErrorMessage(err))
    throw err
  }
}

export async function checkAndPreparePackage(
  packageName: string,
  version?: string,
  checkVersion?: boolean,
): Promise<void>
export async function checkAndPreparePackage(
  packageJson: PackageJson,
  checkVersion?: boolean,
): Promise<void>
// eslint-disable-next-line sonarjs/cognitive-complexity
export async function checkAndPreparePackage(
  packageNameOrPackageJson: PackageJson | string,
  versionOrCheckVersion?: boolean | string,
  checkVersion?: boolean,
) {
  let packageJson: PackageJson

  if (typeof packageNameOrPackageJson === 'string') {
    try {
      packageJson = require(
        packageNameOrPackageJson + `/${PACKAGE_JSON}`,
      ) as PackageJson
    } catch {
      // could fail with `pnpm`, `yarn` v2+, etc, fallback to load from npm registry instead
      if (typeof versionOrCheckVersion !== 'string') {
        throw new TypeError(
          errorMessage(
            `Failed to load \`${PACKAGE_JSON}\` from \`${packageNameOrPackageJson}\`, please provide a version.`,
          ),
        )
      }
      const pkg = packageNameOrPackageJson
      const packageJsonBuffer = await fetch(
        `${getGlobalNpmRegistry()}${pkg}/${versionOrCheckVersion}`,
      )
      packageJson = JSON.parse(
        packageJsonBuffer.toString('utf8'),
      ) as PackageJson
    }
  } else {
    packageJson = packageNameOrPackageJson
    if (
      checkVersion === undefined &&
      typeof versionOrCheckVersion === 'boolean'
    ) {
      checkVersion = versionOrCheckVersion
    }
  }

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

  const targets = getNapiNativeTargets()

  for (const target of targets) {
    const pkg = `${napi.packageName}-${target}`

    if (!optionalDependencies?.[pkg]) {
      continue
    }

    const isWasm32Wasi = target === WASM32_WASI

    const binaryPrefix = napi.binaryName ? `${napi.binaryName}.` : ''
    const subpath = `${binaryPrefix}${target}.${isWasm32Wasi ? 'wasm' : 'node'}`

    try {
      // First check for the binary package from our "optionalDependencies". This
      // package should have been installed alongside this package at install time.
      require.resolve(`${pkg}/${subpath}`)
      break
    } catch {
      try {
        // Check whether it's already been patched
        require.resolve(`${name}/${subpath}`)
        break
      } catch {}
      if (isPnp()) {
        if (isWasm32Wasi) {
          try {
            // eslint-disable-next-line sonarjs/os-command
            execSync(`yarn add -D ${pkg}@${version}`)
          } catch (err) {
            errorLog(
              `Failed to install package \`${pkg}\` automatically in the yarn P'n'P environment`,
              getErrorMessage(err),
            )
            errorLog("You'll have to install it manually in this case.")
          }
        }
        return
      }

      if (!isNpm()) {
        errorLog(`Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
${PACKAGE_JSON} feature is used by ${name} to install the correct napi binary
for your current platform. This install script will now attempt to work around
this. If that fails, you need to remove the "--no-optional" flag to use ${name}.
`)
      }

      // If that didn't work, then someone probably installed <napi> with the
      // "--no-optional" flag. Attempt to compensate for this by downloading the
      // package using a nested call to "npm" instead.
      //
      // THIS MAY NOT WORK. Package installation uses "optionalDependencies" for
      // a reason: manually downloading the package has a lot of obscure edge
      // cases that fail because people have customized their environment in
      // some strange way that breaks downloading. This code path is just here
      // to be helpful but it's not the supported way of installing <napi>.
      let nodePath: string
      try {
        nodePath = downloadedNodePath(name, subpath)
      } catch {
        // could fail with `yarn` P'n'P or unknown situation, try our best to
        // guess the path from current location
        const nodeModulesDir = path.resolve(
          require.resolve(meta.name + `/${PACKAGE_JSON}`),
          '../..',
        )
        nodePath = path.join(nodeModulesDir, name, subpath)
        fs.mkdirSync(path.dirname(nodePath), { recursive: true })
      }
      try {
        errorLog(`Trying to install package "${pkg}" using npm`)
        installUsingNPM(name, pkg, version, target, subpath, nodePath)
        break
      } catch (err) {
        errorLog(
          `Failed to install package "${pkg}" using npm`,
          getErrorMessage(err),
        )

        // If that didn't also work, then something is likely wrong with the "npm"
        // command. Attempt to compensate for this by manually downloading the
        // package from the npm registry over HTTP as a last resort.
        try {
          await downloadDirectlyFromNPM(pkg, version, subpath, nodePath)
          break
        } catch (err) {
          throw new Error(
            errorMessage(
              `Failed to install package "${pkg}"`,
              getErrorMessage(err),
            ),
          )
        }
      }
    }
  }
}
