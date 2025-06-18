import { Button, message, Spin } from 'antd'
import React, { useEffect, useState } from 'react'
import { checkLoginStatus, workflowInstagramLogin, workflowInstagramLogout } from '../api'

interface RequireInstagramLoginProps {
  children: React.ReactNode
}

const RequireInstagramLogin: React.FC<RequireInstagramLoginProps> = ({ children }) => {
  const [loginStatus, setLoginStatus] = useState<'checking' | 'loggedIn' | 'needLogin'>('checking')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    handleCheckLoginStatus()
  }, [])

  const handleCheckLoginStatus = async () => {
    setLoading(true)
    try {
      const data = await checkLoginStatus()
      setLoginStatus(data.isLoggedIn ? 'loggedIn' : 'needLogin')
    }
    catch {
      setLoginStatus('needLogin')
    }
    finally {
      setLoading(false)
    }
  }

  const handleOpenLogin = async () => {
    setLoading(true)
    try {
      const result = await workflowInstagramLogin()
      if (result.success) {
        message.success('로그인 완료!')
        setLoginStatus('loggedIn')
      }
      else {
        message.info(result.message || '로그인에 실패했습니다.')
      }
    }
    catch {
      message.error('로그인 시도에 실패했습니다.')
    }
    finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    setLoading(true)
    try {
      const result = await workflowInstagramLogout()
      if (result.success) {
        message.success('로그인 정보가 초기화되었습니다.')
        setLoginStatus('needLogin')
      }
      else {
        message.error(result.message || '로그아웃에 실패했습니다.')
      }
    }
    catch {
      message.error('로그아웃 시도에 실패했습니다.')
    }
    finally {
      setLoading(false)
    }
  }

  if (loginStatus === 'checking') {
    return (
      <div style={{ textAlign: 'center', marginTop: 40 }}>
        <Spin />
        {' '}
        로그인 상태 확인 중...
      </div>
    )
  }

  if (loginStatus !== 'loggedIn') {
    return (
      <div style={{ maxWidth: 350, margin: '0 auto', marginTop: 40 }}>
        <div style={{ marginBottom: 12 }}>
          로그인이 필요합니다.
          <br />
          <span style={{ color: '#888', fontSize: 13 }}>
            자동으로 로그인하면 문제가 있을 수 있습니다.
            <br />
            번거롭지만 수동으로 브라우저가 켜지면 직접 로그인해주세요.
            <br />
            브라우저는 닫지 말고 기다려주시면 자동으로 닫힙니다.
          </span>
        </div>
        <Button type="primary" onClick={handleOpenLogin} loading={loading} block>
          인스타그램 로그인
        </Button>
      </div>
    )
  }

  return (
    <>
      <div style={{ textAlign: 'right', marginBottom: 8 }}>
        <Button size="small" onClick={handleLogout} loading={loading}>
          로그인 초기화
        </Button>
      </div>
      {children}
    </>
  )
}

export default RequireInstagramLogin
