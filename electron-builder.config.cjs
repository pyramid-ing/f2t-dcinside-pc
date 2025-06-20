/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.winsoft.dcinside',
  productName: 'winsoft-dcinside',
  directories: {
    output: 'dist/electron',
  },
  npmRebuild: false,
  publish: [
    {
      provider: 'github',
      owner: 'pyramid-ing',
      repo: 'f2t-dcinside-pc',
      releaseType: 'release',
    },
  ],
  asar: true,
  asarUnpack: [
    'node_modules/@prisma/engines/**/*',
  ],
  files: [
    'dist/main/**/*',
    'dist/preload/**/*',
    'dist/render/**/*',
  ],
  extraResources: [
    {
      from: 'node_modules/@prisma',
      to: 'node_modules/@prisma',
      filter: ['**/*'],
    },
    {
      from: 'node_modules/.prisma',
      to: 'node_modules/.prisma',
      filter: ['**/*'],
    },
    {
      from: 'node_modules/prisma',
      to: 'node_modules/prisma',
      filter: ['**/*'],
    },
    {
      from: 'resources',
      to: 'resources',
      filter: ['**/*'],
    },
  ],
  mac: {
    icon: 'build/icon.icns',
    target: [
      'dmg',
    ],
    category: 'public.app-category.utilities',
    identity: null,
    hardenedRuntime: false,
    gatekeeperAssess: false,
  },
  win: {
    icon: 'build/icon.ico',
    target: [
      'nsis',
    ],
    requestedExecutionLevel: 'requireAdministrator',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    perMachine: true,
    include: 'build/installer.nsh',
  },
}

module.exports = config
