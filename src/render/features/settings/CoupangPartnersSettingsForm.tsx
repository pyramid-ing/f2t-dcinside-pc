import React, { useEffect, useState } from 'react'
import { Button, Form, Input, message, Card, Space, Typography, Alert } from 'antd'
import { KeyOutlined, SaveOutlined, ShoppingOutlined } from '@ant-design/icons'
import { getSettings, updateSettings } from '@render/api'

const { Text, Link } = Typography

const CoupangPartnersSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [hasKeys, setHasKeys] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      const settings = await getSettings()
      form.setFieldsValue({
        coupangPartnersAccessKey: settings.coupangPartnersAccessKey || '',
        coupangPartnersSecretKey: settings.coupangPartnersSecretKey || '',
      })
      setHasKeys(!!(settings.coupangPartnersAccessKey && settings.coupangPartnersSecretKey))
    } catch (error) {
      console.error('설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    }
  }

  const handleSubmit = async (values: any) => {
    setLoading(true)
    try {
      const settings = await getSettings()
      await updateSettings({
        ...settings,
        coupangPartnersAccessKey: values.coupangPartnersAccessKey,
        coupangPartnersSecretKey: values.coupangPartnersSecretKey,
      })
      message.success('쿠팡 파트너스 설정이 저장되었습니다.')
      setHasKeys(!!(values.coupangPartnersAccessKey && values.coupangPartnersSecretKey))
    } catch (error) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>쿠팡 파트너스 API 설정</h3>

      <Card
        title={
          <Space>
            <ShoppingOutlined />
            API 키 설정
          </Space>
        }
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message="쿠팡 파트너스 API 키 발급 방법"
            description={
              <div>
                <p>1. 쿠팡 파트너스에 가입하세요</p>
                <p>
                  2.{' '}
                  <Link href="https://partners.coupang.com" target="_blank">
                    쿠팡 파트너스 사이트
                  </Link>
                  에 로그인합니다
                </p>
                <p>3. 상단 메뉴에서 &apos;개발자 도구&apos; → &apos;API 키 관리&apos;로 이동</p>
                <p>4. Access Key와 Secret Key를 생성하여 아래에 입력하세요</p>
              </div>
            }
            type="info"
            showIcon
          />

          {hasKeys && <Alert message="API 키가 설정되어 있습니다" type="success" showIcon icon={<KeyOutlined />} />}

          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              label="Access Key"
              name="coupangPartnersAccessKey"
              rules={[{ required: true, message: 'Access Key를 입력하세요' }]}
              extra="쿠팡 파트너스에서 발급받은 Access Key를 입력하세요"
            >
              <Input.Password placeholder="Access Key" prefix={<KeyOutlined />} />
            </Form.Item>

            <Form.Item
              label="Secret Key"
              name="coupangPartnersSecretKey"
              rules={[{ required: true, message: 'Secret Key를 입력하세요' }]}
              extra="쿠팡 파트너스에서 발급받은 Secret Key를 입력하세요"
            >
              <Input.Password placeholder="Secret Key" prefix={<KeyOutlined />} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={loading} icon={<SaveOutlined />} size="large">
                저장
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>
    </div>
  )
}

export default CoupangPartnersSettingsForm
