module.exports = {
  appId: 'org.pangaea.desktop',
  productName: 'Pangaea',
  directories: { output: 'release' },
  files: ['electron/**/*.cjs', 'package.json'],
  extraResources: [
    { from: 'build/server', to: 'server', filter: ['**/*', '!**/.env*', '!**/appsettings.Local.json', '!**/appsettings.Development.json'] },
    { from: 'dist', to: 'ui' },
  ],
  mac: {
    target: 'dmg',
    category: 'public.app-category.productivity',
  },
  artifactName: '${productName}-${version}-${arch}.${ext}',
}
