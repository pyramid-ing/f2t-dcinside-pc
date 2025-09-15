export class ChromeNotInstalledError extends Error {
  constructor(message: string = '크롬 브라우저가 설치되지 않았습니다. Chrome을 설치한 후 다시 시도해주세요.') {
    super(message)
    this.name = 'ChromeNotInstalledError'
  }
}
