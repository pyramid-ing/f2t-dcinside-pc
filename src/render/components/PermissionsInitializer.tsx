import React, { useEffect, useState } from 'react'
import { Spin } from 'antd'
import { usePermissions } from '@render/hooks/usePermissions'

interface PermissionsInitializerProps {
  children: React.ReactNode
}

const PermissionsInitializer: React.FC<PermissionsInitializerProps> = ({ children }) => {
  const { loadLicenseInfo, isLoading, error } = usePermissions()
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    const initializePermissions = async () => {
      try {
        // 앱 시작 시에만 서버에서 라이센스 정보를 로드
        await loadLicenseInfo()
        setIsInitialized(true)
      } catch (error) {
        console.error('Failed to initialize permissions:', error)
        // 권한 초기화 실패 시에도 앱은 계속 실행
        setIsInitialized(true)
      }
    }

    // 앱 시작 시에만 한 번 실행
    initializePermissions()
  }, []) // loadLicenseInfo 의존성 제거

  if (!isInitialized || isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <Spin size="large" />
        <div>권한 정보를 확인하는 중...</div>
      </div>
    )
  }

  if (error) {
    console.warn('Permissions initialization error:', error)
    // 에러가 있어도 앱은 계속 실행 (권한 체크는 각 컴포넌트에서 수행)
  }

  return <>{children}</>
}

export default PermissionsInitializer
