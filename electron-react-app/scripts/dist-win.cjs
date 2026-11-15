const { build } = require('./dist.cjs')
build('win', process.argv[2] || 'x64')
