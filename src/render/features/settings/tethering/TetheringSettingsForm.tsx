import type { Settings } from '@render/types/settings'
import React, { useEffect, useState } from 'react'
import type { FormInstance } from 'antd'
import { Form, Input, Space, message, Button } from 'antd'
import { CheckCircleTwoTone, CloseCircleTwoTone } from '@ant-design/icons'
import { checkTetheringConnection } from '@render/api/settingsApi'
import { getSettings } from '@render/api'

type TetheringFormValues = {
  tethering?: NonNullable<Settings['tethering']>
}

interface Props {
  form?: FormInstance<any>
}

const TetheringSettingsForm: React.FC<Props> = ({ form: parentForm }) => {
  const [form] = parentForm ? [parentForm] : Form.useForm<TetheringFormValues>()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [status, setStatus] = useState<null | 'success' | 'error'>(null)
  const [checkResult, setCheckResult] = useState<null | {
    adbFound: boolean
    connected: boolean
    output: string
  }>(null)

  useEffect(() => {
    if (!parentForm) {
      ;(async () => {
        try {
          setLoading(true)
          const s = await getSettings()
          form.setFieldsValue({ tethering: s.tethering })
        } catch (e) {
          message.error('설정을 불러오지 못했습니다.')
        } finally {
          setLoading(false)
        }
      })()
    }
  }, [form])

  return (
    <div>
      <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>테더링 설정</h3>
      {/* 부모 Form 컨텍스트에서 동작하는 Form.Item만 렌더 */}
      <Form.Item label="ADB 경로" name={['tethering', 'adbPath']}>
        <Input placeholder="기본: adb (PATH에 등록되어 있어야 합니다)" />
      </Form.Item>
      <div style={{ marginBottom: 12 }}>
        <Button
          onClick={async () => {
            try {
              setChecking(true)
              const adbPath = (form as any).getFieldValue(['tethering', 'adbPath']) as string | undefined
              const res = await checkTetheringConnection(adbPath)
              setCheckResult(res)
              if (!res.adbFound) {
                setStatus('error')
                message.error('adb를 찾을 수 없습니다. PATH 또는 경로를 확인하세요.')
              } else if (res.connected) {
                setStatus('success')
                message.success('안드로이드 장치가 연결되어 있습니다.')
              } else {
                setStatus('error')
                message.warning('adb는 동작하지만 연결된 장치를 찾지 못했습니다.')
              }
            } catch (e: any) {
              setStatus('error')
              message.error(e?.response?.data?.message || e?.message || '연결 확인 실패')
            } finally {
              setChecking(false)
            }
          }}
          loading={checking}
          icon={
            status === 'success' ? (
              <CheckCircleTwoTone twoToneColor="#52c41a" />
            ) : status === 'error' ? (
              <CloseCircleTwoTone twoToneColor="#ff4d4f" />
            ) : undefined
          }
        >
          ADB 연결 확인
        </Button>
        {checkResult && (
          <div style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: '#666', fontSize: 12 }}>
            {checkResult.adbFound && checkResult.connected ? checkResult.output : '실패'}
          </div>
        )}
      </div>
      <Space size={12} style={{ display: 'flex' }}>
        <Form.Item label="재시도 횟수" name={['tethering', 'attempts']} style={{ flex: 1 }}>
          <Input type="number" min={1} />
        </Form.Item>
        <Form.Item label="대기(초)" name={['tethering', 'waitSeconds']} style={{ flex: 1 }}>
          <Input type="number" min={1} />
        </Form.Item>
      </Space>
      <div style={{ color: '#888', marginTop: 4 }}>포스팅마다 안드로이드 모바일 데이터 토글로 IP를 바꿉니다.</div>
    </div>
  )
}

export default TetheringSettingsForm
