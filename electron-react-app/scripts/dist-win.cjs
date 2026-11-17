// npm run dist:win [-- arm64|x64]: builds the Windows installer (default x64).
const { build } = require('./dist.cjs')
build('win', process.argv[2] || 'x64')
