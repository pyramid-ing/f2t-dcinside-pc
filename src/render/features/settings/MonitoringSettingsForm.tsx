import React, { useEffect, useState } from 'react'
import { Button, Form, message, Space, Switch } from 'antd'
import { getSettings, updateSettings } from '@render/api'

const MonitoringSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const settings = await getSettings()
      form.setFieldsValue({
        monitoring: {
          includeImagesInAiAnalysis: settings.monitoring?.includeImagesInAiAnalysis ?? true,
        },
      })
    } catch (error: any) {
      console.error('모니터링 설정 로드 실패:', error)
      message.error(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: any) => {
    try {
      setSaving(true)
      const currentSettings = await getSettings()
      await updateSettings({
        ...currentSettings,
        monitoring: {
          ...currentSettings.monitoring,
          includeImagesInAiAnalysis: values.monitoring?.includeImagesInAiAnalysis ?? true,
        },
      })

      message.success('모니터링 설정이 저장되었습니다.')
    } catch (error: any) {
      console.error('모니터링 설정 저장 실패:', error)
      message.error(error.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>AI 분석 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          monitoring: {
            includeImagesInAiAnalysis: true,
          },
        }}
      >
        <Form.Item
          label="AI 분석 시 이미지 포함"
          name={['monitoring', 'includeImagesInAiAnalysis']}
          valuePropName="checked"
          extra="디시인사이드 크롤링 질문 분석 및 쿠팡 워크플로우 실행 시 게시글의 이미지를 AI에게 함께 전송합니다. 이미지를 포함하면 더 정확한 분석이 가능하지만, API 비용이 증가하고 처리 시간이 길어질 수 있습니다."
        >
          <Switch checkedChildren="이미지 포함" unCheckedChildren="텍스트만" loading={loading} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              저장
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

export default MonitoringSettingsForm
