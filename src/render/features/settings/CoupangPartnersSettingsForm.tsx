import React, { useEffect, useState } from 'react'
import { Button, Form, Input, InputNumber, message, Card, Space, Typography, Alert, Divider } from 'antd'
import { KeyOutlined, SaveOutlined, ShoppingOutlined, SearchOutlined } from '@ant-design/icons'
import { getSettings, updateSettings } from '@render/api'
import type { Settings } from '@render/types/settings'

const { Text, Link } = Typography

const CoupangPartnersSettingsForm: React.FC = () => {
  const [form] = Form.useForm<Partial<Settings>>()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [hasKeys, setHasKeys] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const settings = await getSettings()
      form.setFieldsValue({
        coupangPartnersAccessKey: settings.coupangPartnersAccessKey || '',
        coupangPartnersSecretKey: settings.coupangPartnersSecretKey || '',
        coupas: {
          keywordMin: settings.coupas?.keywordMin ?? 2,
          keywordMax: settings.coupas?.keywordMax ?? 5,
          productsPerKeyword: settings.coupas?.productsPerKeyword ?? 1,
        },
      })
      setHasKeys(!!(settings.coupangPartnersAccessKey && settings.coupangPartnersSecretKey))
    } catch (error) {
      console.error('설정 로드 실패:', error)
      message.error('설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (values: Partial<Settings>) => {
    setSaving(true)
    try {
      const settings = await getSettings()
      await updateSettings({
        ...settings,
        coupangPartnersAccessKey: values.coupangPartnersAccessKey,
        coupangPartnersSecretKey: values.coupangPartnersSecretKey,
        coupas: values.coupas,
      })
      message.success('쿠팡 파트너스 설정이 저장되었습니다.')
      setHasKeys(!!(values.coupangPartnersAccessKey && values.coupangPartnersSecretKey))
    } catch (error) {
      console.error('설정 저장 실패:', error)
      message.error('설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
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
              <Input.Password placeholder="Access Key" prefix={<KeyOutlined />} disabled={loading} />
            </Form.Item>

            <Form.Item
              label="Secret Key"
              name="coupangPartnersSecretKey"
              rules={[{ required: true, message: 'Secret Key를 입력하세요' }]}
              extra="쿠팡 파트너스에서 발급받은 Secret Key를 입력하세요"
            >
              <Input.Password placeholder="Secret Key" prefix={<KeyOutlined />} disabled={loading} />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
                저장
              </Button>
            </Form.Item>
          </Form>
        </Space>
      </Card>

      <Divider />

      <Card
        title={
          <Space>
            <SearchOutlined />
            쿠파스 상품 검색 설정
          </Space>
        }
        style={{ marginTop: 24 }}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="키워드 최소 개수"
            name={['coupas', 'keywordMin']}
            rules={[
              { required: true, message: '키워드 최소 개수를 입력하세요' },
              { type: 'number', min: 1, max: 10, message: '1개 ~ 10개 사이의 값을 입력하세요' },
            ]}
            extra="AI가 추천할 쿠팡 검색 키워드의 최소 개수입니다"
          >
            <InputNumber
              min={1}
              max={10}
              addonAfter="개"
              style={{ width: 150 }}
              disabled={loading}
              placeholder="최소 개수"
            />
          </Form.Item>

          <Form.Item
            label="키워드 최대 개수"
            name={['coupas', 'keywordMax']}
            rules={[
              { required: true, message: '키워드 최대 개수를 입력하세요' },
              { type: 'number', min: 1, max: 10, message: '1개 ~ 10개 사이의 값을 입력하세요' },
            ]}
            extra="AI가 추천할 쿠팡 검색 키워드의 최대 개수입니다"
          >
            <InputNumber
              min={1}
              max={10}
              addonAfter="개"
              style={{ width: 150 }}
              disabled={loading}
              placeholder="최대 개수"
            />
          </Form.Item>

          <Form.Item
            label="키워드당 상품 최대 개수"
            name={['coupas', 'productsPerKeyword']}
            rules={[
              { required: true, message: '키워드당 상품 최대 개수를 입력하세요' },
              { type: 'number', min: 1, max: 10, message: '1개 ~ 10개 사이의 값을 입력하세요' },
            ]}
            extra="각 키워드당 쿠팡에서 가져올 상품의 최대 개수입니다"
          >
            <InputNumber
              min={1}
              max={10}
              addonAfter="개"
              style={{ width: 150 }}
              disabled={loading}
              placeholder="상품 개수"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={saving} icon={<SaveOutlined />} size="large">
              저장
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  )
}

export default CoupangPartnersSettingsForm
