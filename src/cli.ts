#!/usr/bin/env node

import fs from 'node:fs'

import { PACKAGE_JSON, PACKAGE_JSON_ENV } from './constants'

import { checkAndPreparePackage, PackageJson } from './index.js'

function readCwdPackage(
  packageName: string,
  packageVersion: string,
): PackageJson | undefined {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(PACKAGE_JSON, 'utf8'),
    ) as PackageJson
    if (
      packageJson.name === packageName &&
      packageJson.version === packageVersion
    ) {
      return packageJson
    }
  } catch {}
}

const packageName = process.argv[2]
const packageVersion = process.argv[3]
const checkVersion = ['1', 'check', 'true', 'yes'].includes(process.argv[4])

const packageJsonPath = process.env[PACKAGE_JSON_ENV]

const packageJson = packageJsonPath
  ? (require(packageJsonPath) as PackageJson)
  : readCwdPackage(packageName, packageVersion)

const promise = packageJson
  ? checkAndPreparePackage(packageJson, checkVersion)
  : checkAndPreparePackage(packageName, packageVersion, checkVersion)

void promise.catch((err: unknown) => {
  console.error(err)
  process.exitCode = 1
})
