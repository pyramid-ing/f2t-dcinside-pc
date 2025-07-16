import type { Settings } from '../../types/settings'
import { Button, Form, Input, Modal, Radio, message, Space, Switch } from 'antd'
import React, { useEffect, useState } from 'react'
import { getSettings, updateSettings } from '@render/api'

const ProxySettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [proxyModalOpen, setProxyModalOpen] = useState(false)
  const [editingProxy, setEditingProxy] = useState<any | null>(null)
  const proxies: any[] = Form.useWatch('proxies', form) || []
  const [proxyForm] = Form.useForm()

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const settings = await getSettings()
      form.setFieldsValue(settings)
    } catch (error) {
      console.error('프록시 설정 로드 실패:', error)
      message.error('프록시 설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: Settings) => {
    try {
      setSaving(true)
      const settings = await getSettings()
      const result = await updateSettings({
        ...settings,
        ...values,
      })
      message.success('프록시 설정이 저장되었습니다.')
    } catch (error) {
      console.error('프록시 설정 저장 실패:', error)
      message.error('프록시 설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // 프록시 추가/수정 핸들러
  const handleAddOrEditProxy = (proxy?: any, idx?: number) => {
    setEditingProxy(proxy ? { ...proxy, idx } : { ip: '', port: '', id: '', pw: '' })
    proxyForm.setFieldsValue({
      proxy_ip: proxy?.ip || '',
      proxy_port: proxy?.port || '',
      proxy_id: proxy?.id || '',
      proxy_pw: proxy?.pw || '',
    })
    setProxyModalOpen(true)
  }
  const handleProxyModalOk = () => {
    proxyForm.validateFields().then(values => {
      const newProxy = {
        ip: values.proxy_ip,
        port: Number(values.proxy_port),
        id: values.proxy_id,
        pw: values.proxy_pw,
      }
      let next = [...proxies]
      if (editingProxy?.idx !== undefined) {
        next[editingProxy.idx] = newProxy
      } else {
        next.push(newProxy)
      }
      form.setFieldsValue({ proxies: next })
      setProxyModalOpen(false)
      setEditingProxy(null)
      proxyForm.resetFields()
    })
  }
  const handleProxyModalCancel = () => {
    setProxyModalOpen(false)
    setEditingProxy(null)
  }
  const handleDeleteProxy = (idx: number) => {
    const next = proxies.filter((_, i) => i !== idx)
    form.setFieldsValue({ proxies: next })
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>프록시 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          proxyChangeMethod: 'random',
        }}
      >
        <Form.Item label="프록시 사용" name="proxyEnabled" valuePropName="checked" initialValue={false}>
          <Switch checkedChildren="사용" unCheckedChildren="미사용" />
        </Form.Item>
        <Form.Item label="프록시 변경 방식" name="proxyChangeMethod" initialValue="random">
          <Radio.Group>
            <Radio value="random">랜덤</Radio>
            <Radio value="sequential">순차</Radio>
            <Radio value="fixed">고정</Radio>
          </Radio.Group>
        </Form.Item>
        <Form.Item label="프록시 목록">
          <Button onClick={() => handleAddOrEditProxy()}>프록시 추가</Button>
          <div style={{ marginTop: 10 }}>
            {proxies.length === 0 && <div style={{ color: '#888' }}>등록된 프록시가 없습니다.</div>}
            {proxies.map((proxy, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ flex: 1 }}>
                  {proxy.ip}:{proxy.port} {proxy.id && `(ID: ${proxy.id})`}
                </span>
                <Button size="small" onClick={() => handleAddOrEditProxy(proxy, idx)} style={{ marginRight: 4 }}>
                  수정
                </Button>
                <Button size="small" danger onClick={() => handleDeleteProxy(idx)}>
                  삭제
                </Button>
              </div>
            ))}
          </div>
        </Form.Item>
        <Form.Item name="proxies" style={{ display: 'none' }}>
          <Input />
        </Form.Item>
        {/* 프록시 추가/수정 모달 */}
        <Modal
          open={proxyModalOpen}
          onOk={handleProxyModalOk}
          onCancel={handleProxyModalCancel}
          title={editingProxy?.idx !== undefined ? '프록시 수정' : '프록시 추가'}
        >
          <Form form={proxyForm} layout="vertical">
            <Form.Item label="IP" name="proxy_ip" rules={[{ required: true, message: 'IP를 입력하세요.' }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Port" name="proxy_port" rules={[{ required: true, message: '포트를 입력하세요.' }]}>
              <Input type="number" />
            </Form.Item>
            <Form.Item label="ID" name="proxy_id">
              <Input />
            </Form.Item>
            <Form.Item label="PW" name="proxy_pw">
              <Input />
            </Form.Item>
          </Form>
        </Modal>
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

export default ProxySettingsForm
