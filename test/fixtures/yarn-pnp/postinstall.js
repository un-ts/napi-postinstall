const { checkAndPreparePackage } = require('napi-postinstall')

checkAndPreparePackage('rollup', '4.40.0', true).catch(() => {
  console.error('Failed to install rollup v4.40.0')
  process.exitCode = 1
})
