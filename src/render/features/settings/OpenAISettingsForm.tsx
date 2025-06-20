import { Button, Form, Input, message, Alert, Space } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useState, useCallback } from 'react'
import { getOpenAIApiKeyFromServer, saveOpenAIApiKeyToServer, validateOpenAIApiKey } from '../../api'

interface ValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  message?: string
  model?: string
}

const OpenAISettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [isValidating, setIsValidating] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    ;(async () => {
      const key = await getOpenAIApiKeyFromServer()
      form.setFieldsValue({ openAIApiKey: key })

      // 기존 키가 있으면 자동 검증
      if (key) {
        await handleValidateKey(key)
      }
    })()
  }, [form])

  const handleValidateKey = async (apiKey: string) => {
    if (!apiKey || apiKey.trim().length === 0) {
      setValidation({ status: 'idle' })
      return
    }

    setIsValidating(true)
    setValidation({ status: 'validating' })

    try {
      const result = await validateOpenAIApiKey(apiKey.trim())

      if (result.valid) {
        setValidation({
          status: 'valid',
          message: `유효한 API 키입니다.`,
          model: result.model,
        })
      } else {
        setValidation({
          status: 'invalid',
          message: result.error || '알 수 없는 오류가 발생했습니다.',
        })
      }
    } catch (error) {
      setValidation({
        status: 'invalid',
        message: '검증 중 오류가 발생했습니다.',
      })
    } finally {
      setIsValidating(false)
    }
  }

  const debouncedValidate = useCallback(
    (apiKey: string) => {
      // 기존 타이머 클리어
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }

      // 새 타이머 설정 (1초 후 검증)
      const timer = setTimeout(() => {
        handleValidateKey(apiKey)
      }, 1000)

      setDebounceTimer(timer)
    },
    [debounceTimer],
  )

  const onFinish = async (values: { openAIApiKey: string }) => {
    try {
      // 저장 전에 한 번 더 검증
      if (validation.status !== 'valid') {
        message.warning('유효한 API 키를 입력한 후 저장해주세요.')
        return
      }

      await saveOpenAIApiKeyToServer(values.openAIApiKey)
      message.success('OpenAI API 키가 저장되었습니다.')
    } catch {
      message.error('저장에 실패했습니다.')
    }
  }

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // 입력이 변경되면 검증 상태 초기화
    setValidation({ status: 'idle' })

    // debounce로 자동 검증
    if (value.trim().length > 0) {
      debouncedValidate(value)
    }
  }

  const renderValidationStatus = () => {
    switch (validation.status) {
      case 'validating':
        return (
          <Alert
            message={
              <Space>
                <LoadingOutlined />
                API 키 검증 중...
              </Space>
            }
            type="info"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'valid':
        return (
          <Alert
            message={
              <Space>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                {validation.message}
                {validation.model && <span style={{ color: '#666' }}>({validation.model})</span>}
              </Space>
            }
            type="success"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      case 'invalid':
        return (
          <Alert
            message={
              <Space>
                <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
                {validation.message}
              </Space>
            }
            type="error"
            showIcon={false}
            style={{ marginTop: 8 }}
          />
        )
      default:
        return null
    }
  }

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer)
      }
    }
  }, [debounceTimer])

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>OpenAI 설정</h3>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item
          label="OpenAI API 키"
          name="openAIApiKey"
          rules={[{ required: true, message: 'API 키를 입력하세요.' }]}
          extra="ChatGPT API를 사용하기 위한 OpenAI API 키를 입력하세요. 입력 후 자동으로 검증됩니다."
        >
          <Input.Password placeholder="sk-..." autoComplete="off" onChange={onApiKeyChange} />
        </Form.Item>

        {renderValidationStatus()}

        <Form.Item style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" disabled={validation.status !== 'valid'}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default OpenAISettingsForm
