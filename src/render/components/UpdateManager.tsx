import React, { useEffect, useState } from 'react'
import { Button, Progress, Modal, Typography, Space, notification } from 'antd'
import { DownloadOutlined, ReloadOutlined, CheckOutlined } from '@ant-design/icons'
import type { UpdateInfo, DownloadProgress, UpdateResult } from '../types/electron'

const { Text, Paragraph } = Typography

interface UpdateManagerProps {
  autoCheck?: boolean
}

export const UpdateManager: React.FC<UpdateManagerProps> = ({ autoCheck = true }) => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)
  const [isChecking, setIsChecking] = useState(false)
  const [updateDownloaded, setUpdateDownloaded] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [currentVersion, setCurrentVersion] = useState<string>('')
  const [isLatestVersion, setIsLatestVersion] = useState<boolean | null>(null) // null: 확인 중, true: 최신, false: 업데이트 필요
  const [initialCheckDone, setInitialCheckDone] = useState(false)

  useEffect(() => {
    // 현재 앱 버전 가져오기
    const getCurrentVersion = async () => {
      try {
        const version = await window.electronAPI.getAppVersion()
        setCurrentVersion(version)
      } catch (error) {
        console.error('현재 버전을 가져오는데 실패했습니다:', error)
      }
    }

    getCurrentVersion()

    // 업데이트 다운로드 진행률 리스너
    window.electronAPI?.onDownloadProgress((progress: DownloadProgress) => {
      setDownloadProgress(progress)
      if (progress.percent === 100) {
        setIsDownloading(false)
      }
    })

    // 업데이트 다운로드 완료 리스너
    window.electronAPI?.onUpdateDownloaded((info: UpdateInfo) => {
      setUpdateDownloaded(true)
      setUpdateInfo(info)
      setShowUpdateModal(true)
      notification.success({
        message: '업데이트 다운로드 완료',
        description: `버전 ${info.version} 업데이트가 다운로드되었습니다. 설치하려면 앱을 재시작하세요.`,
        duration: 0,
      })
    })

    // 자동 업데이트 확인 (조용히 실행)
    if (autoCheck) {
      checkForUpdatesQuietly()
    }

    return () => {
      window.electronAPI?.removeAllListeners('download-progress')
      window.electronAPI?.removeAllListeners('update-downloaded')
    }
  }, [autoCheck])

  // 버전 비교 함수 (semantic versioning)
  const isNewerVersion = (remoteVersion: string, currentVersion: string): boolean => {
    if (!currentVersion || !remoteVersion) return false

    // 'v' 접두사 제거
    const cleanRemote = remoteVersion.replace(/^v/, '')
    const cleanCurrent = currentVersion.replace(/^v/, '')

    const remoteParts = cleanRemote.split('.').map(Number)
    const currentParts = cleanCurrent.split('.').map(Number)

    // 버전 부분 개수를 맞춤 (예: 1.1 vs 1.1.0)
    const maxLength = Math.max(remoteParts.length, currentParts.length)
    while (remoteParts.length < maxLength) remoteParts.push(0)
    while (currentParts.length < maxLength) currentParts.push(0)

    for (let i = 0; i < maxLength; i++) {
      if (remoteParts[i] > currentParts[i]) return true
      if (remoteParts[i] < currentParts[i]) return false
    }

    return false // 같은 버전
  }

  // 조용한 업데이트 확인 (초기 로드 시 사용, 알림 없음)
  const checkForUpdatesQuietly = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      setIsLatestVersion(null)
      setInitialCheckDone(true)
      return
    }

    try {
      const result: UpdateResult = await window.electronAPI.checkForUpdates()

      if (result.error) {
        setIsLatestVersion(null)
      } else if (result.updateInfo) {
        const remoteVersion = result.updateInfo.version

        // 버전 비교하여 실제로 업데이트가 필요한지 확인
        if (isNewerVersion(remoteVersion, currentVersion)) {
          setUpdateAvailable(true)
          setUpdateInfo({
            version: result.updateInfo.version,
            releaseNotes: result.updateInfo.releaseNotes,
          })
          setIsLatestVersion(false)
        } else {
          setIsLatestVersion(true)
        }
      } else {
        setIsLatestVersion(true)
      }
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error)
      setIsLatestVersion(null)
    } finally {
      setInitialCheckDone(true)
    }
  }

  // 수동 업데이트 확인 (사용자가 버튼 클릭 시 사용, 알림 표시)
  const checkForUpdates = async () => {
    if (!window.electronAPI?.checkForUpdates) {
      console.log('Electron API not available')
      return
    }

    setIsChecking(true)
    try {
      const result: UpdateResult = await window.electronAPI.checkForUpdates()

      if (result.error) {
        notification.error({
          message: '업데이트 확인 실패',
          description: result.error,
        })
      } else if (result.updateInfo) {
        const remoteVersion = result.updateInfo.version

        // 버전 비교하여 실제로 업데이트가 필요한지 확인
        if (isNewerVersion(remoteVersion, currentVersion)) {
          setUpdateAvailable(true)
          setUpdateInfo({
            version: result.updateInfo.version,
            releaseNotes: result.updateInfo.releaseNotes,
          })
          setIsLatestVersion(false)
          setShowUpdateModal(true)
        } else {
          // 최신 버전인 경우
          setIsLatestVersion(true)
          notification.info({
            message: '최신 버전',
            description: `현재 최신 버전(v${currentVersion})을 사용 중입니다.`,
          })
        }
      } else {
        setIsLatestVersion(true)
        notification.info({
          message: '최신 버전',
          description: '현재 최신 버전을 사용 중입니다.',
        })
      }
    } catch (error) {
      console.error('업데이트 확인 중 오류:', error)
      notification.error({
        message: '업데이트 확인 오류',
        description: '업데이트 확인 중 오류가 발생했습니다.',
      })
    } finally {
      setIsChecking(false)
    }
  }

  const downloadUpdate = async () => {
    if (!window.electronAPI?.downloadUpdate) return

    setIsDownloading(true)
    setDownloadProgress({ percent: 0, transferred: 0, total: 0 })

    try {
      const result: UpdateResult = await window.electronAPI.downloadUpdate()

      if (result.error) {
        notification.error({
          message: '업데이트 다운로드 실패',
          description: result.error,
        })
        setIsDownloading(false)
      } else {
        notification.success({
          message: '업데이트 다운로드 시작',
          description: result.message,
        })
      }
    } catch (error) {
      console.error('업데이트 다운로드 중 오류:', error)
      notification.error({
        message: '업데이트 다운로드 오류',
        description: '업데이트 다운로드 중 오류가 발생했습니다.',
      })
      setIsDownloading(false)
    }
  }

  const installUpdate = async () => {
    if (!window.electronAPI?.installUpdate) return

    try {
      await window.electronAPI.installUpdate()
    } catch (error) {
      console.error('업데이트 설치 중 오류:', error)
      notification.error({
        message: '업데이트 설치 오류',
        description: '업데이트 설치 중 오류가 발생했습니다.',
      })
    }
  }

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <>
      <Space direction="vertical" style={{ width: '100%' }}>
        {/* 초기 확인 중일 때 */}
        {!initialCheckDone ? (
          <Button loading block disabled>
            버전 확인 중...
          </Button>
        ) : /* 업데이트 다운로드 완료 상태 */ updateDownloaded ? (
          <Button type="primary" icon={<ReloadOutlined />} onClick={installUpdate} block>
            재시작 및 설치
          </Button>
        ) : /* 업데이트 다운로드 가능 상태 */ updateAvailable ? (
          <Button type="primary" icon={<DownloadOutlined />} onClick={downloadUpdate} loading={isDownloading} block>
            업데이트 다운로드
          </Button>
        ) : /* 최신 버전인 경우 */ isLatestVersion === true ? (
          <div
            style={{
              textAlign: 'center',
              padding: '12px 16px',
              background: 'rgba(82, 196, 26, 0.1)',
              border: '1px solid rgba(82, 196, 26, 0.3)',
              borderRadius: '6px',
              backdropFilter: 'blur(4px)',
            }}
          >
            <Text
              style={{
                color: '#95de64',
                fontSize: 13,
                fontWeight: 600,
                textShadow: '0 1px 2px rgba(0, 0, 0, 0.8)',
                display: 'block',
                marginBottom: 6,
              }}
            >
              ✓ 최신 버전입니다
            </Text>
            <Button
              size="small"
              type="text"
              onClick={checkForUpdates}
              loading={isChecking}
              style={{
                color: 'rgba(149, 222, 100, 0.8)',
                fontSize: 11,
                height: 22,
                padding: '0 8px',
                border: '1px solid rgba(82, 196, 26, 0.2)',
                borderRadius: '4px',
                background: 'rgba(82, 196, 26, 0.05)',
              }}
            >
              다시 확인
            </Button>
          </div>
        ) : (
          /* 확인 실패 또는 기본 상태 */ <Button
            icon={<CheckOutlined />}
            onClick={checkForUpdates}
            loading={isChecking}
            block
          >
            업데이트 확인
          </Button>
        )}

        {isDownloading && downloadProgress && (
          <div style={{ marginTop: 8 }}>
            <Progress
              percent={Math.round(downloadProgress.percent)}
              status="active"
              size="small"
              format={() => `${Math.round(downloadProgress.percent)}%`}
              strokeColor="#69c0ff"
            />
            <Text style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.6)', marginTop: 4, display: 'block' }}>
              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
            </Text>
          </div>
        )}
      </Space>

      <Modal
        title="업데이트 사용 가능"
        open={showUpdateModal}
        onCancel={() => setShowUpdateModal(false)}
        footer={[
          <Button key="later" onClick={() => setShowUpdateModal(false)}>
            나중에
          </Button>,
          updateDownloaded ? (
            <Button key="install" type="primary" onClick={installUpdate}>
              지금 설치
            </Button>
          ) : (
            <Button key="download" type="primary" onClick={downloadUpdate} loading={isDownloading}>
              다운로드
            </Button>
          ),
        ]}
      >
        {updateInfo && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text strong>버전: {updateInfo.version}</Text>

            {updateInfo.releaseNotes && (
              <div>
                <Text strong>업데이트 내용:</Text>
                <Paragraph style={{ marginTop: 8, whiteSpace: 'pre-wrap' }}>{updateInfo.releaseNotes}</Paragraph>
              </div>
            )}

            {updateDownloaded ? (
              <Text type="success">업데이트가 다운로드되었습니다. 설치하려면 앱을 재시작하세요.</Text>
            ) : isDownloading && downloadProgress ? (
              <div>
                <Progress percent={Math.round(downloadProgress.percent)} status="active" />
                <Text type="secondary">
                  {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
                </Text>
              </div>
            ) : (
              <Text>새로운 업데이트를 다운로드하시겠습니까?</Text>
            )}
          </Space>
        )}
      </Modal>
    </>
  )
}

export default UpdateManager
