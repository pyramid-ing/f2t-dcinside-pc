import type { Settings } from '@render/types/settings'
import React, { useEffect, useState } from 'react'
import type { FormInstance } from 'antd'
import { Form, Input, Space, message } from 'antd'
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
