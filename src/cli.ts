#!/usr/bin/env node

import * as fs from 'node:fs'

import { PACKAGE_JSON } from './constants'

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

const packageJson = readCwdPackage(packageName, packageVersion)

if (packageJson) {
  void checkAndPreparePackage(packageJson, checkVersion)
} else {
  void checkAndPreparePackage(packageName, packageVersion, checkVersion)
}
