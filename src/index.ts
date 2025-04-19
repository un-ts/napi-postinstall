// based on https://github.com/evanw/esbuild/blob/4475787eef4c4923b92b9fa37ebba1c88b9e1d9b/lib/npm/node-install.ts

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import zlib from 'node:zlib'

import { LOG_PREFIX } from './constants.js'
import {
  downloadedNodePath,
  getErrorMessage,
  getGlobalNpmRegistry,
  getNapiInfoFromPackageJson,
  getNapiNativeTargets,
  removeRecursive,
} from './helpers.js'
import type { PackageJson } from './types.js'

export type * from './target.js'
export type * from './types.js'

function fetch(url: string) {
  return new Promise<Buffer>((resolve, reject) => {
    https
      .get(url, res => {
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
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
      `Invalid gzip data in archive: ${(err as Error | undefined)?.message || String(err)}`,
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
  throw new Error(`Could not find ${JSON.stringify(subpath)} in archive`)
}

function isNpm() {
  const { npm_config_user_agent } = process.env
  if (npm_config_user_agent) {
    return /\bnpm\//.test(npm_config_user_agent)
  }
  return false
}

function installUsingNPM(
  hostPkg: string,
  pkg: string,
  version: string,
  subpath: string,
  nodePath: string,
) {
  // Erase "npm_config_global" so that "npm install --global <napi>" works.
  // Otherwise this nested "npm install" will also be global, and the install
  // will deadlock waiting for the global installation lock.
  const env = { ...process.env, npm_config_global: undefined }

  // Create a temporary directory inside the "<napi>" package with an empty
  // "package.json" file. We'll use this to run "npm install" in.
  const pkgDir = path.dirname(require.resolve(hostPkg + '/package.json'))
  const installDir = path.join(pkgDir, 'npm-install')
  fs.mkdirSync(installDir, { recursive: true })
  try {
    fs.writeFileSync(path.join(installDir, 'package.json'), '{}')

    // Run "npm install" in the temporary directory which should download the
    // desired package. Try to avoid unnecessary log output. This uses the "npm"
    // command instead of a HTTP request so that it hopefully works in situations
    // where HTTP requests are blocked but the "npm" command still works due to,
    // for example, a custom configured npm registry and special firewall rules.
    // eslint-disable-next-line sonarjs/os-command
    execSync(
      `npm install --loglevel=error --prefer-offline --no-audit --progress=false ${pkg}@${version}`,
      { cwd: installDir, stdio: 'pipe', env },
    )

    try {
      /**
       * Try to move up the <napi> package directory to the parent
       * "node_modules". This is a bit of a hack but it works around the problem
       * that legacy npm versions does not respect "optionalDependencies" when
       * "package-lock.json" presented, but it's fine to fail here.
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
      fs.renameSync(path.join(installDir, 'node_modules', pkg), newPath)
    } catch {
      // Move the downloaded binary executable into place. The destination path
      // is the same one that the JavaScript API code uses so it will be able to
      // find the binary executable here later.
      fs.renameSync(
        path.join(installDir, 'node_modules', pkg, subpath),
        nodePath,
      )
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
  console.error(`${LOG_PREFIX}Trying to download ${JSON.stringify(url)}`)
  try {
    fs.writeFileSync(
      nodePath,
      extractFileFromTarGzip(await fetch(url), subpath),
    )
  } catch (err) {
    console.error(
      `${LOG_PREFIX}Failed to download ${JSON.stringify(url)}: ${getErrorMessage(err)}`,
    )
    throw err
  }
}

// eslint-disable-next-line sonarjs/cognitive-complexity
export async function checkAndPreparePackage(
  packageNameOrPackageJson: PackageJson | string,
  checkVersion?: boolean,
) {
  const packageJson =
    typeof packageNameOrPackageJson === 'string'
      ? (require(packageNameOrPackageJson + '/package.json') as PackageJson)
      : packageNameOrPackageJson

  const { name, version, optionalDependencies } = packageJson

  const { napi, version: napiVersion = version } = getNapiInfoFromPackageJson(
    packageJson,
    checkVersion,
  )

  if (checkVersion && version !== napiVersion) {
    throw new Error(
      `Inconsistent package versions found for \`${name}\` v${version} vs \`${napi.packageName}\` v${napiVersion}.`,
    )
  }

  const targets = getNapiNativeTargets()

  for (const target of targets) {
    const pkg = `${napi.packageName}-${target}`

    if (!optionalDependencies?.[pkg]) {
      continue
    }

    const binaryPrefix = napi.binaryName ? `${napi.binaryName}.` : ''
    const subpath = `${binaryPrefix}${target}.node`

    try {
      // First check for the binary package from our "optionalDependencies". This
      // package should have been installed alongside this package at install time.
      require.resolve(`${pkg}/${subpath}`)
      break
    } catch {
      if (!isNpm()) {
        console.error(`${LOG_PREFIX}Failed to find package "${pkg}" on the file system

This can happen if you use the "--no-optional" flag. The "optionalDependencies"
package.json feature is used by ${name} to install the correct napi binary
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
      const nodePath = downloadedNodePath(name, subpath)
      try {
        console.error(
          `${LOG_PREFIX}Trying to install package "${pkg}" using npm`,
        )
        installUsingNPM(name, pkg, napiVersion, subpath, nodePath)
        break
      } catch (err) {
        console.error(
          `${LOG_PREFIX}Failed to install package "${pkg}" using npm: ${getErrorMessage(err)}`,
        )

        // If that didn't also work, then something is likely wrong with the "npm"
        // command. Attempt to compensate for this by manually downloading the
        // package from the npm registry over HTTP as a last resort.
        try {
          await downloadDirectlyFromNPM(pkg, napiVersion, subpath, nodePath)
          break
        } catch (err) {
          throw new Error(
            `Failed to install package "${pkg}": ${getErrorMessage(err)}`,
          )
        }
      }
    }
  }
}
