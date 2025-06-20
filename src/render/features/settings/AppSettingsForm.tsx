import type { AppSettings } from '../../types/settings'
import { Button, Form, InputNumber, message, Radio, Space, Switch } from 'antd'
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
    } catch (error) {
      console.error('앱 설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: AppSettings) => {
    try {
      setSaving(true)
      const result = await saveAppSettingsToServer(values)

      if (result.success) {
        message.success('설정이 저장되었습니다.')
      } else {
        message.error(result.error || '설정 저장에 실패했습니다.')
      }
    } catch (error) {
      console.error('앱 설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>앱 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          showBrowserWindow: true,
          taskDelay: 10,
          imageUploadFailureAction: 'fail',
        }}
      >
        <Form.Item
          label="브라우저 창 표시"
          name="showBrowserWindow"
          valuePropName="checked"
          extra="포스팅 시 브라우저 창을 보여줄지 설정합니다. 끄면 백그라운드에서 실행됩니다."
        >
          <Switch checkedChildren="창 보임" unCheckedChildren="창 숨김" loading={loading} />
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
          <InputNumber min={1} max={300} addonAfter="초" style={{ width: 150 }} disabled={loading} />
        </Form.Item>

        <Form.Item
          label="이미지 업로드 실패 시 처리"
          name="imageUploadFailureAction"
          rules={[{ required: true, message: '이미지 업로드 실패 처리 방식을 선택해주세요.' }]}
          extra="이미지 업로드가 실패했을 때의 처리 방식을 설정합니다. 같은 이미지 반복 사용 시 등록이 안되는 경우가 있습니다."
        >
          <Radio.Group disabled={loading}>
            <Space direction="vertical">
              <Radio value="fail">작업 실패 - 이미지 업로드 실패 시 전체 포스팅을 중단합니다</Radio>
              <Radio value="skip">이미지 무시하고 진행 - 이미지 없이 텍스트만 포스팅합니다</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              저장
            </Button>
            <Button onClick={loadSettings} disabled={saving || loading}>
              초기화
            </Button>
          </Space>
        </Form.Item>
      </Form>
    </div>
  )
}

export default AppSettingsForm
