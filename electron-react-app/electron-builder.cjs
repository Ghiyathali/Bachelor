// electron-builder settings for the installers (npm run dist:win / dist:mac, see scripts/dist.cjs).
// The published API ("server"), the built React app ("ui") and the optional database defaults
// ("bootstrap") are copied next to the app. Secret and development settings files are filtered out.
module.exports = {
  appId: 'org.pangaea.desktop',
  productName: 'Pangaea',
  directories: { output: 'release' },
  files: ['electron/**/*', 'package.json'],
  extraResources: [
    { from: 'build/server', to: 'server', filter: ['**/*', '!**/.env*', '!**/appsettings.Local.json', '!**/appsettings.Development.json'] },
    { from: 'dist', to: 'ui' },
    { from: 'build/bootstrap', to: 'bootstrap', filter: ['.env'] },
  ],
// macOS: a .dmg disk image. Windows: an NSIS installer in which the user can choose the folder.
  mac: {
    target: 'dmg',
    category: 'public.app-category.productivity',
  },
  win: {
    target: 'nsis',
    artifactName: '${productName}-${version}-win-${arch}-setup.${ext}',
  },
  nsis: { oneClick: false, allowToChangeInstallationDirectory: true },
  artifactName: '${productName}-${version}-${arch}.${ext}',
}
