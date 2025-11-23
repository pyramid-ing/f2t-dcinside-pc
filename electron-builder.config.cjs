/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: 'com.winsoft.dc',
  productName: 'winsoft-dc',
  artifactName: '${productName}-${version}.${ext}',
  directories: {
    output: 'dist/electron',
  },
  npmRebuild: false,
  publish: [
    {
      provider: 'github',
      owner: 'pyramid-ing',
      // 코드 리포는 private(`f2t-dcinside-pc`), 실제 배포/업데이트용은 public(`f2t-dcinside-pc-public`)
      // 으로 분리해서 사용하기 위해 public 리포를 대상으로 설정
      repo: 'f2t-dcinside-pc-public',
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
    {
      from: 'db-force-reset.json',
      to: 'db-force-reset.json',
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
    artifactName: '${productName}-${version}-${arch}.${ext}',
  },
  win: {
    icon: 'build/icon.ico',
    target: [
      'nsis',
    ],
    artifactName: '${productName}-${version}.${ext}',
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    runAfterFinish: true,
    perMachine: true,
    artifactName: '${productName}-Setup.${ext}',
  },
}

module.exports = config
