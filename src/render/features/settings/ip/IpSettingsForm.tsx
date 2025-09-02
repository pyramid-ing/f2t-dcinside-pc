import type { Settings } from '@render/types/settings'
import { IpMode } from '@render/types/settings'
import React, { useEffect, useState } from 'react'
import { Button, Form, Radio, message } from 'antd'
import ProxySettingsForm from '../ProxySettingsForm'
import TetheringSettingsForm from '../tethering/TetheringSettingsForm'
import { getSettings, updateSettings } from '@render/api'

const IpSettingsForm: React.FC = () => {
  const [form] = Form.useForm<Partial<Settings>>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    ;(async () => {
      try {
        setLoading(true)
        const s = await getSettings()
        form.setFieldsValue(s as Partial<Settings>)
      } catch (e) {
        message.error('설정을 불러오지 못했습니다.')
      } finally {
        setLoading(false)
      }
    })()
  }, [form])

  const ipMode: IpMode = Form.useWatch('ipMode', form) || IpMode.NONE

  const handleSave = async (values: Partial<Settings>) => {
    try {
      setSaving(true)
      const current = await getSettings()
      const next = await updateSettings({ ...current, ...values })
      message.success('IP 설정이 저장되었습니다.')
      form.setFieldsValue(next)
    } catch (e: any) {
      message.error(e?.response?.data?.message || e?.message || '저장 실패')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>IP 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{ ipMode: IpMode.NONE, tethering: { attempts: 3, waitSeconds: 3 } }}
      >
        <Form.Item label="IP 변경 모드" name="ipMode">
          <Radio.Group>
            <Radio value={IpMode.NONE}>사용 안 함</Radio>
            <Radio value={IpMode.PROXY}>프록시</Radio>
            <Radio value={IpMode.TETHERING}>테더링</Radio>
          </Radio.Group>
        </Form.Item>

        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
          <ProxySettingsForm form={form as any} />
        </div>

        <div style={{ padding: 12, border: '1px solid #eee', borderRadius: 8, marginBottom: 16 }}>
          <TetheringSettingsForm form={form as any} />
        </div>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} disabled={loading}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default IpSettingsForm
