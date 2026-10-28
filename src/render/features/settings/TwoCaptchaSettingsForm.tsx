import { Button, Form, Input, message, Alert, Space } from 'antd'
import { CheckCircleOutlined, LoadingOutlined, ExclamationCircleOutlined } from '@ant-design/icons'
import React, { useEffect, useState, useCallback } from 'react'
import { getSettings, updateSettings, validateTwoCaptchaApiKey } from '@render/api'

interface ValidationState {
  status: 'idle' | 'validating' | 'valid' | 'invalid'
  message?: string
  balance?: number
}

const TwoCaptchaSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [validation, setValidation] = useState<ValidationState>({ status: 'idle' })
  const [isValidating, setIsValidating] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  useEffect(() => {
    ;(async () => {
      const settings = await getSettings()
      form.setFieldsValue({ twoCaptchaApiKey: settings.twoCaptchaApiKey || '' })

      // 기존 키가 있으면 자동 검증
      if (settings.twoCaptchaApiKey) {
        await handleValidateKey(settings.twoCaptchaApiKey)
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
      const result = await validateTwoCaptchaApiKey(apiKey.trim())

      if (result.data.valid) {
        setValidation({
          status: 'valid',
          message: `유효한 API 키입니다.`,
          balance: result.data.balance,
        })
      } else {
        setValidation({
          status: 'invalid',
          message: result.data.error || '알 수 없는 오류가 발생했습니다.',
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

  const onFinish = async (values: { twoCaptchaApiKey: string }) => {
    try {
      // 빈 값이면 검증 없이 저장 허용 (선택적 설정이므로)
      const apiKey = values.twoCaptchaApiKey?.trim() || ''

      if (apiKey && validation.status !== 'valid') {
        message.warning('유효한 API 키를 입력한 후 저장해주세요.')
        return
      }

      const setting = await getSettings()

      await updateSettings({
        ...setting,
        twoCaptchaApiKey: apiKey,
      })

      if (apiKey) {
        message.success('2captcha API 키가 저장되었습니다.')
      } else {
        message.success('2captcha API 키가 제거되었습니다.')
      }
    } catch {
      message.error('저장에 실패했습니다.')
    }
  }

  const onApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // 입력이 변경되면 검증 상태 초기화
    setValidation({ status: 'idle' })

    // debounce로 자동 검증 (빈 값이 아닐 때만)
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
                {validation.balance !== undefined && (
                  <span style={{ color: '#666' }}>(잔액: ${validation.balance?.toFixed(4) || '0'})</span>
                )}
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

  const isFormValid = () => {
    const apiKey = form.getFieldValue('twoCaptchaApiKey')?.trim() || ''

    // 빈 값이면 저장 가능 (선택적 설정)
    if (!apiKey) return true

    // 값이 있으면 검증 통과해야 저장 가능
    return validation.status === 'valid'
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>2captcha 설정</h3>
      <Form form={form} layout="vertical" onFinish={onFinish} style={{ maxWidth: 500 }}>
        <Form.Item
          label="2captcha API 키"
          name="twoCaptchaApiKey"
          extra={
            <div>
              <div>reCAPTCHA 자동 해결을 위한 2captcha API 키를 입력하세요.</div>
              <div style={{ marginTop: 4, color: '#666' }}>
                선택 사항입니다. 설정하지 않으면 reCAPTCHA 발생 시 작업이 중단됩니다.
              </div>
              <div style={{ marginTop: 4 }}>
                <a
                  href="https://2captcha.com?from=16653706"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#1890ff' }}
                >
                  2captcha 가입하기 →
                </a>
              </div>
            </div>
          }
        >
          <Input.Password placeholder="2captcha API 키를 입력하세요..." autoComplete="off" onChange={onApiKeyChange} />
        </Form.Item>

        {renderValidationStatus()}

        <Form.Item style={{ marginTop: 16 }}>
          <Button type="primary" htmlType="submit" disabled={!isFormValid()}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default TwoCaptchaSettingsForm
