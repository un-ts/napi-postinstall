#!/usr/bin/env node

import { checkAndPreparePackage, isNpm } from './index.js'

if (isNpm()) {
  void checkAndPreparePackage(
    process.argv[2],
    ['1', 'check', 'true', 'yes'].includes(process.argv[3]),
  )
}
