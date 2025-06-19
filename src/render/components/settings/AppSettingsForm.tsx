import type { AppSettings } from '../../types/settings'
import { Button, Card, Form, InputNumber, message, Space, Switch } from 'antd'
import React, { useEffect, useState } from 'react'
import { getAppSettingsFromServer, saveAppSettingsToServer } from '../../api'

const AppSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const settings = await getAppSettingsFromServer()
      form.setFieldsValue(settings)
    }
    catch (error) {
      console.error('앱 설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    }
    finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: AppSettings) => {
    try {
      setSaving(true)
      const result = await saveAppSettingsToServer(values)

      if (result.success) {
        message.success('설정이 저장되었습니다.')
      }
      else {
        message.error(result.error || '설정 저장에 실패했습니다.')
      }
    }
    catch (error) {
      console.error('앱 설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    }
    finally {
      setSaving(false)
    }
  }

  return (
    <Card title="앱 설정" loading={loading}>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          showBrowserWindow: true,
          taskDelay: 10,
        }}
      >
        <Form.Item
          label="브라우저 창 표시"
          name="showBrowserWindow"
          valuePropName="checked"
          extra="포스팅 시 브라우저 창을 보여줄지 설정합니다. 끄면 백그라운드에서 실행됩니다."
        >
          <Switch
            checkedChildren="창 보임"
            unCheckedChildren="창 숨김"
          />
        </Form.Item>

        <Form.Item
          label="작업간 딜레이 (초)"
          name="taskDelay"
          rules={[
            { required: true, message: '작업간 딜레이를 입력해주세요.' },
            { type: 'number', min: 1, max: 300, message: '1초 ~ 300초 사이의 값을 입력해주세요.' },
          ]}
          extra="연속 포스팅 시 작업 사이의 대기 시간을 설정합니다."
        >
          <InputNumber
            min={1}
            max={300}
            addonAfter="초"
            style={{ width: 150 }}
          />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              저장
            </Button>
            <Button onClick={loadSettings} disabled={saving}>
              초기화
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </Card>
  )
}

export default AppSettingsForm
