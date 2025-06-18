import { Button, Form, Input, InputNumber, message } from 'antd'
import React, { useState } from 'react'
import { exportPostsXlsx } from '../api'
import RequireInstagramLogin from './RequireInstagramLogin'

const ExportPostsXlsx: React.FC = () => {
  const [loading, setLoading] = useState(false)

  return (
    <RequireInstagramLogin>
      <Form
        layout="vertical"
        onFinish={async (values: { keyword: string, limit?: number }) => {
          setLoading(true)
          try {
            const blob = await exportPostsXlsx(values)
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'export.xlsx'
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.URL.revokeObjectURL(url)
            message.success('엑셀 파일이 다운로드되었습니다.')
          }
          catch (e: any) {
            message.error(e.message || '엑셀 내보내기에 실패했습니다.')
          }
          finally {
            setLoading(false)
          }
        }}
        style={{ maxWidth: 400 }}
      >
        <Form.Item label="검색 키워드" name="keyword" rules={[{ required: true, message: '키워드를 입력하세요.' }]}>
          <Input placeholder="예: 여행" />
        </Form.Item>
        <Form.Item label="검색 개수 (선택)" name="limit">
          <InputNumber min={1} max={100} style={{ width: '100%' }} placeholder="기본값: 10" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            게시물 엑셀로 내보내기
          </Button>
        </Form.Item>
      </Form>
    </RequireInstagramLogin>
  )
}

export default ExportPostsXlsx
