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
