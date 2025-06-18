import { Button, Form, InputNumber, message, Switch } from 'antd'
import React, { useEffect, useState } from 'react'
import { getInstagramSettings, saveInstagramSettings } from '../../api'

const DelaySettings: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [form] = Form.useForm()

  // 설정 불러오기
  useEffect(() => {
    async function fetchSettings() {
      setLoading(true)
      try {
        const res = await getInstagramSettings()
        if (res.success && res.data) {
          // headless 값을 반대로 변환하여 폼에 세팅 (저장된 true=숨김, false=보임)
          form.setFieldsValue({
            ...res.data,
            headless: res.data.headless === undefined ? true : !res.data.headless,
          })
        }
      }
      catch {
        message.error('설정 불러오기 실패')
      }
      finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [form])

  // 저장
  const onFinish = async (values: { minDelay: number, maxDelay: number, headless: boolean }) => {
    setLoading(true)
    try {
      // headless 값을 반대로 변환하여 저장 (UI: true=보임, 저장: false)
      const res = await saveInstagramSettings({
        ...values,
        headless: !values.headless,
      })
      if (res.success) {
        message.success('딜레이 설정이 저장되었습니다.')
      }
      else {
        message.error('저장 실패')
      }
    }
    catch {
      message.error('딜레이 설정 저장에 실패했습니다.')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      display: 'flex',
      background: '#fff',
      margin: 0,
      padding: 0,
      width: '100%',
    }}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ minWidth: 300 }}
        initialValues={{ minDelay: 1000, maxDelay: 3000, headless: true }}
      >
        <Form.Item label="최소 딜레이 (ms)" name="minDelay" rules={[{ required: true, message: '최소 딜레이를 입력하세요.' }]}>
          <InputNumber min={0} step={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="최대 딜레이 (ms)" name="maxDelay" rules={[{ required: true, message: '최대 딜레이를 입력하세요.' }]}>
          <InputNumber min={0} step={100} style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item label="창보기 모드" name="headless" valuePropName="checked">
          <Switch checkedChildren="보임" unCheckedChildren="숨김" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default DelaySettings
