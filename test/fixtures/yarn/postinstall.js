const { checkAndPreparePackage } = require('napi-postinstall')

checkAndPreparePackage('rolldown', '1.2.14', true).catch(() => {
  console.error('Failed to install rolldown v1.2.14')
  process.exitCode = 1
})
