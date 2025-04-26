#!/usr/bin/env node

import { checkAndPreparePackage } from './index.js'

void checkAndPreparePackage(
  process.argv[2],
  process.argv[3],
  ['1', 'check', 'true', 'yes'].includes(process.argv[4]),
)
