import React, { useEffect, useState } from 'react'
import { Button, Form, Input, message, Space, Card, List, Modal, Popconfirm, Typography, Tag } from 'antd'
import { PlusOutlined, EditOutlined, DeleteOutlined, CheckCircleOutlined, GlobalOutlined } from '@ant-design/icons'
import { getSettings, updateSettings } from '@render/api'

const { Text } = Typography

interface WordPressAccount {
  id: string
  name: string
  url: string
  wpUsername: string
  apiKey: string
}

const WordPressSettingsForm: React.FC = () => {
  const [accounts, setAccounts] = useState<WordPressAccount[]>([])
  const [modalVisible, setModalVisible] = useState(false)
  const [editingAccount, setEditingAccount] = useState<WordPressAccount | null>(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadAccounts()
  }, [])

  const loadAccounts = async () => {
    try {
      const settings = await getSettings()
      setAccounts(settings.wordpressAccounts || [])
    } catch (error) {
      console.error('워드프레스 계정 로드 실패:', error)
      message.error('계정 정보를 불러오는데 실패했습니다.')
    }
  }

  const showModal = (account?: WordPressAccount) => {
    if (account) {
      setEditingAccount(account)
      form.setFieldsValue(account)
    } else {
      setEditingAccount(null)
      form.resetFields()
    }
    setModalVisible(true)
  }

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields()

      let updatedAccounts: WordPressAccount[]

      if (editingAccount) {
        // 수정
        updatedAccounts = accounts.map(acc =>
          acc.id === editingAccount.id ? { ...values, id: editingAccount.id } : acc,
        )
        message.success('워드프레스 계정이 수정되었습니다.')
      } else {
        // 추가
        const newAccount: WordPressAccount = {
          id: `wp-${Date.now()}`,
          ...values,
        }
        updatedAccounts = [...accounts, newAccount]
        message.success('워드프레스 계정이 추가되었습니다.')
      }

      // 설정 저장
      const settings = await getSettings()
      await updateSettings({
        ...settings,
        wordpressAccounts: updatedAccounts,
      })

      setAccounts(updatedAccounts)
      setModalVisible(false)
      form.resetFields()
    } catch (error) {
      console.error('저장 실패:', error)
      message.error('저장에 실패했습니다.')
    }
  }

  const handleDelete = async (accountId: string) => {
    try {
      const updatedAccounts = accounts.filter(acc => acc.id !== accountId)

      const settings = await getSettings()
      await updateSettings({
        ...settings,
        wordpressAccounts: updatedAccounts,
      })

      setAccounts(updatedAccounts)
      message.success('워드프레스 계정이 삭제되었습니다.')
    } catch (error) {
      console.error('삭제 실패:', error)
      message.error('삭제에 실패했습니다.')
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>워드프레스 계정 관리</h3>

      <Card
        title={
          <Space>
            <GlobalOutlined />
            워드프레스 계정 ({accounts.length})
          </Space>
        }
        extra={
          <Button type="primary" icon={<PlusOutlined />} onClick={() => showModal()}>
            계정 추가
          </Button>
        }
      >
        {accounts.length === 0 ? (
          <Text type="secondary">등록된 워드프레스 계정이 없습니다.</Text>
        ) : (
          <List
            dataSource={accounts}
            renderItem={account => (
              <List.Item
                actions={[
                  <Button type="link" icon={<EditOutlined />} onClick={() => showModal(account)} key="edit">
                    수정
                  </Button>,
                  <Popconfirm
                    title="이 계정을 삭제하시겠습니까?"
                    onConfirm={() => handleDelete(account.id)}
                    okText="삭제"
                    cancelText="취소"
                    key="delete"
                  >
                    <Button type="link" danger icon={<DeleteOutlined />}>
                      삭제
                    </Button>
                  </Popconfirm>,
                ]}
              >
                <List.Item.Meta
                  avatar={<CheckCircleOutlined style={{ fontSize: 24, color: '#52c41a' }} />}
                  title={
                    <Space>
                      <Text strong>{account.name}</Text>
                      <Tag color="blue">{account.wpUsername}</Tag>
                    </Space>
                  }
                  description={
                    <Space direction="vertical" size={0}>
                      <Text type="secondary">URL: {account.url}</Text>
                      <Text type="secondary">API Key: {account.apiKey.substring(0, 20)}...</Text>
                    </Space>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Card>

      {/* 계정 추가/수정 모달 */}
      <Modal
        title={editingAccount ? '워드프레스 계정 수정' : '워드프레스 계정 추가'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false)
          form.resetFields()
        }}
        width={600}
        okText="저장"
        cancelText="취소"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="계정 이름"
            name="name"
            rules={[{ required: true, message: '계정 이름을 입력하세요' }]}
            extra="이 계정을 구분하기 위한 이름입니다 (예: 메인 블로그, 서브 블로그)"
          >
            <Input placeholder="예: 메인 블로그" />
          </Form.Item>

          <Form.Item
            label="워드프레스 사이트 URL"
            name="url"
            rules={[
              { required: true, message: '워드프레스 사이트 URL을 입력하세요' },
              { type: 'url', message: '올바른 URL 형식이 아닙니다' },
            ]}
            extra="워드프레스 사이트의 전체 URL을 입력하세요"
          >
            <Input placeholder="https://your-blog.com" />
          </Form.Item>

          <Form.Item
            label="워드프레스 사용자명"
            name="wpUsername"
            rules={[{ required: true, message: '워드프레스 사용자명을 입력하세요' }]}
            extra="워드프레스 관리자 계정의 사용자명입니다"
          >
            <Input placeholder="admin" />
          </Form.Item>

          <Form.Item
            label="Application Password"
            name="apiKey"
            rules={[{ required: true, message: 'Application Password를 입력하세요' }]}
            extra={
              <div>
                워드프레스의 Application Password를 입력하세요.
                <br />
                생성 방법: 워드프레스 관리자 → 사용자 → 프로필 → Application Passwords
              </div>
            }
          >
            <Input.Password placeholder="xxxx xxxx xxxx xxxx xxxx xxxx" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default WordPressSettingsForm
