import { authApi } from '@render/api'
import { Tabs, Button, Modal, message } from 'antd'
import React, { useCallback, useEffect, useState } from 'react'
import OpenAISettingsForm from './OpenAISettingsForm'
import SettingsForm from './SettingsForm'
import IpSettingsForm from './ip/IpSettingsForm'
import { resetAllData } from '@render/api/settingsApi'

const SettingsTabs: React.FC = () => {
  const [activeTab, setActiveTab] = useState('app')
  const [machineId, setMachineId] = useState<string>('')
  const [resetting, setResetting] = useState(false)

  const fetchMachineId = useCallback(async () => {
    try {
      const { machineId } = await authApi.getMachineId()
      setMachineId(machineId)
    } catch (error) {
      console.error('Error fetching machine id:', error)
    }
  }, [])

  useEffect(() => {
    fetchMachineId()
  }, [fetchMachineId])

  const handleResetAllData = () => {
    Modal.confirm({
      title: '모든 데이터 초기화',
      content: (
        <div>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold', marginBottom: '10px' }}>
            ⚠️ 경고: 이 작업은 되돌릴 수 없습니다!
          </p>
          <p>다음 데이터가 모두 삭제됩니다:</p>
          <ul style={{ marginLeft: '20px', marginTop: '10px' }}>
            <li>모든 설정 정보</li>
            <li>등록된 작업 목록</li>
            <li>작업 로그</li>
            <li>userdata 폴더</li>
          </ul>
          <p style={{ marginTop: '10px', fontWeight: 'bold' }}>정말로 모든 데이터를 초기화하시겠습니까?</p>
        </div>
      ),
      okText: '초기화',
      okType: 'danger',
      cancelText: '취소',
      width: 500,
      onOk: async () => {
        try {
          setResetting(true)
          const result = await resetAllData()
          if (result.success) {
            message.success(result.message)
          } else {
            message.error(result.message)
          }
        } catch (error: any) {
          message.error(error.response?.data?.message || error.message || '데이터 초기화에 실패했습니다.')
        } finally {
          setResetting(false)
        }
      },
    })
  }

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={[
          {
            key: 'app',
            label: '앱 설정',
            children: <SettingsForm />,
          },
          {
            key: 'ip',
            label: 'IP 설정',
            children: <IpSettingsForm />,
          },
          {
            key: 'openai',
            label: 'OpenAI',
            children: <OpenAISettingsForm />,
          },
        ]}
      />
      <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #f0f0f0', paddingTop: '20px' }}>
        <Button
          danger
          size="large"
          onClick={handleResetAllData}
          loading={resetting}
          style={{
            fontWeight: 'bold',
          }}
        >
          모든 데이터 초기화
        </Button>
        <p style={{ marginTop: '8px', color: '#666', fontSize: '12px' }}>
          ⚠️ 모든 설정, 작업, 로그가 삭제되고 프로그램이 재시작됩니다
        </p>
      </div>
    </div>
  )
}

export default SettingsTabs
