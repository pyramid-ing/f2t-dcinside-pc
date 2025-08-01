import { authApi } from '@render/api'
import { getSettings } from '@render/api/settingsApi'
import { Button, Form, Input, message, Space, Typography, Alert } from 'antd'
import React, { useCallback, useState, useEffect } from 'react'
import styled from 'styled-components'

const { Title, Text } = Typography

const StyledForm = styled(Form)`
  max-width: 500px;
  margin: 0 auto;
  padding: 24px;
`

const StyledCard = styled.div`
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  padding: 24px;
  margin-bottom: 16px;
`

interface LicenseRegistrationFormProps {
  machineId: string
}

const LicenseRegistrationForm: React.FC<LicenseRegistrationFormProps> = ({ machineId }) => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [currentLicenseKey, setCurrentLicenseKey] = useState<string>('')

  // 현재 저장된 라이센스 키 가져오기
  useEffect(() => {
    const fetchCurrentLicense = async () => {
      try {
        const settings = await getSettings()
        setCurrentLicenseKey(settings.licenseKey || '')
      } catch (error) {
        console.error('Error fetching current license:', error)
      }
    }

    fetchCurrentLicense()
  }, [])

  const handleSubmit = useCallback(
    async (values: { license_key: string }) => {
      setLoading(true)
      try {
        const response = await authApi.registerLicense({
          license_key: values.license_key,
          node_machine_id: machineId,
        })

        if (response.success) {
          message.success(response.message)
          setCurrentLicenseKey(values.license_key)
          form.resetFields()
        } else {
          message.error('라이센스 등록에 실패했습니다.')
        }
      } catch (error: any) {
        console.error('License registration error:', error)
        message.error(error.message || '라이센스 등록에 실패했습니다.')
      } finally {
        setLoading(false)
      }
    },
    [form, machineId],
  )

  return (
    <StyledCard>
      <Title level={4}>라이센스 등록</Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        라이센스 키를 입력하여 소프트웨어를 활성화하세요.
      </Text>

      {currentLicenseKey && (
        <Alert
          message="현재 등록된 라이센스"
          description={`라이센스 키: ${currentLicenseKey}`}
          type="info"
          style={{ marginBottom: 16 }}
          showIcon
        />
      )}

      <StyledForm form={form} onFinish={handleSubmit} layout="vertical">
        <Form.Item
          label="라이센스 키"
          name="license_key"
          rules={[
            { required: true, message: '라이센스 키를 입력해주세요.' },
            {
              pattern: /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/,
              message: '올바른 라이센스 키 형식을 입력해주세요.',
            },
          ]}
        >
          <Input placeholder="XXXXX-XXXXX-XXXXX-XXXXX-XXXXX" style={{ fontFamily: 'monospace' }} />
        </Form.Item>

        <Form.Item>
          <Space>
            <Button type="primary" htmlType="submit" loading={loading}>
              라이센스 등록
            </Button>
            <Button onClick={() => form.resetFields()}>초기화</Button>
          </Space>
        </Form.Item>
      </StyledForm>
    </StyledCard>
  )
}

export default LicenseRegistrationForm
