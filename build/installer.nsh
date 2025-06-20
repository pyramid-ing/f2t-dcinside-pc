; Windows 인스톨러에서 파일 권한 설정
!macro customInstall
  ; resources 폴더의 모든 파일에 쓰기 권한 부여
  DetailPrint "Setting file permissions for database files..."
  ExecWait 'icacls "$INSTDIR\resources" /grant Users:F /T'
  ExecWait 'attrib -R "$INSTDIR\resources\*.*" /S'
!macroend 