import { UploadOutlined } from '@ant-design/icons'
import { Button, Form, message, Upload } from 'antd'
import React, { useState } from 'react'
import { uploadDcinsideExcel } from '../api'

const UploadDcinsideExcelForm: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)

  return (
    <div>
      <Form
        layout="vertical"
        onFinish={async () => {
          if (!file) {
            message.warning('엑셀 파일을 업로드해주세요.')
            return
          }
          setLoading(true)
          setResult(null)
          try {
            const res = await uploadDcinsideExcel(file)
            setResult(res)
            message.success('업로드가 완료되었습니다.')
          }
          catch (e: any) {
            message.error(e.message || '업로드에 실패했습니다.')
          }
          finally {
            setLoading(false)
          }
        }}
        style={{ maxWidth: 400 }}
      >
        <Form.Item label="엑셀 파일 업로드" required>
          <Upload
            beforeUpload={(file) => { setFile(file); return false }}
            maxCount={1}
            accept=".xlsx"
            showUploadList={!!file}
          >
            <Button icon={<UploadOutlined />}>엑셀 파일 선택</Button>
          </Upload>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            업로드
          </Button>
        </Form.Item>
      </Form>
      {result && (
        <div style={{ marginTop: 24 }}>
          <b>결과:</b>
          <pre style={{ background: '#f5f5f5', padding: 12, borderRadius: 4, maxHeight: 200, overflow: 'auto' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}

export default UploadDcinsideExcelForm
