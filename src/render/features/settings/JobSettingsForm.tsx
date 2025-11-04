import { Button, Form, InputNumber, message } from 'antd'
import React, { useEffect, useState } from 'react'
import { getSettings, updateCommentBatchSize } from '@render/api'

const JobSettingsForm: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSettings()
  }, [])

  const loadSettings = async () => {
    try {
      setLoading(true)
      const settings = await getSettings()
      form.setFieldsValue({
        commentBatchSize: settings.commentBatchSize || 1,
      })
    } catch (error) {
      console.error('작업 설정 로드 실패:', error)
      message.error(error instanceof Error ? error.message : '작업 설정을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async (values: { commentBatchSize: number }) => {
    try {
      setSaving(true)
      await updateCommentBatchSize(values.commentBatchSize)
      message.success('작업 설정이 저장되었습니다.')
    } catch (error) {
      console.error('작업 설정 저장 실패:', error)
      message.error(error instanceof Error ? error.message : '작업 설정 저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h3 style={{ marginBottom: '20px', fontSize: '16px', fontWeight: 600 }}>작업 설정</h3>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
        initialValues={{
          commentBatchSize: 1,
        }}
      >
        <Form.Item
          label="댓글 동시 처리 개수"
          name="commentBatchSize"
          rules={[
            { required: true, message: '댓글 동시 처리 개수를 입력해주세요.' },
            { type: 'number', min: 1, max: 10, message: '1~10 사이의 값을 입력해주세요.' },
          ]}
          extra="댓글 작업을 동시에 처리할 개수를 설정합니다. (최소 1개, 최대 10개)"
        >
          <InputNumber min={1} max={10} style={{ width: 150 }} disabled={loading} />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" loading={saving} disabled={loading}>
            저장
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default JobSettingsForm
