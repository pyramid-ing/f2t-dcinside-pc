import { Button, Form, Input, message } from 'antd'
import React, { useEffect } from 'react'
import { getOpenAIApiKeyFromServer, saveOpenAIApiKeyToServer } from '../../api'

const OpenAISettingsForm: React.FC = () => {
  const [form] = Form.useForm()

  useEffect(() => {
    (async () => {
      const key = await getOpenAIApiKeyFromServer()
      form.setFieldsValue({ openAIApiKey: key })
    })()
  }, [form])

  const onFinish = async (values: { openAIApiKey: string }) => {
    try {
      await saveOpenAIApiKeyToServer(values.openAIApiKey)
      message.success('OpenAI API 키가 저장되었습니다.')
    }
    catch {
      message.error('저장에 실패했습니다.')
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>OpenAI 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={onFinish}
        style={{ maxWidth: 400 }}
      >
        <Form.Item
          label="OpenAI API 키"
          name="openAIApiKey"
          rules={[{ required: true, message: 'API 키를 입력하세요.' }]}
          extra="ChatGPT API를 사용하기 위한 OpenAI API 키를 입력하세요."
        >
          <Input.Password placeholder="sk-..." autoComplete="off" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default OpenAISettingsForm
