import { UploadOutlined } from '@ant-design/icons'
import { Button, Form, message, Upload } from 'antd'
import React, { useState } from 'react'
import { sendDmTo } from '../api'
import RequireInstagramLogin from './RequireInstagramLogin'

const SendDMForm: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<any>(null)

  return (
    <RequireInstagramLogin>
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
              const res = await sendDmTo(file)
              setResult(res)
              if (res.success) {
                message.success('DM 전송이 완료되었습니다.')
              }
              else {
                message.error('DM 전송에 실패했습니다.')
              }
            }
            catch (e: any) {
              message.error(e.message || 'DM 전송에 실패했습니다.')
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
              DM 보내기
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
    </RequireInstagramLogin>
  )
}

export default SendDMForm
