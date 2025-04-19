#!/usr/bin/env node

import { checkAndPreparePackage } from './index.js'

void checkAndPreparePackage(
  process.argv[2],
  ['1', 'check', 'true', 'yes'].includes(process.argv[3]),
)
