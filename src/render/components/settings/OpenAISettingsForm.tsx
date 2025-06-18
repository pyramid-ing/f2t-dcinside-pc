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
      >
        <Input.Password placeholder="sk-..." autoComplete="off" />
      </Form.Item>
      <Form.Item>
        <Button type="primary" htmlType="submit" block>
          저장
        </Button>
      </Form.Item>
    </Form>
  )
}

export default OpenAISettingsForm
