// npm run dist:mac [-- arm64|x64]: builds the macOS .dmg (default: this Mac's processor).
const { build } = require('./dist.cjs')
build('mac', process.argv[2] || process.arch)
