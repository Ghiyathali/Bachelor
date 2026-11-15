const { build } = require('./dist.cjs')
build('mac', process.argv[2] || process.arch)
