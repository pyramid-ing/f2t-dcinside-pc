export interface Settings {
  showBrowserWindow: boolean // 창보임/창숨김 모드 (true = 창보임, false = 창숨김)
  taskDelay: number // 작업간 딜레이 (초)
  actionDelay: number // 포스팅 과정 중 각 동작 사이의 딜레이 (초)
  imageUploadFailureAction: 'fail' | 'skip' // 이미지 업로드 실패 시 처리 방식 ('fail' = 작업 실패, 'skip' = 이미지 무시하고 진행)
  openAIApiKey: string
}
