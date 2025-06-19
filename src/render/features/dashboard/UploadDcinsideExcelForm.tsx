import { UploadOutlined } from '@ant-design/icons'
import { uploadDcinsideExcel } from '@render/api'
import { Button, Form, message, Table, Tag, Typography, Upload } from 'antd'
import React, { useState } from 'react'

const { Title } = Typography

interface UploadResult {
  title: string
  galleryUrl: string
  success: boolean
  message: string
  postJobId?: number
}

const UploadDcinsideExcelForm: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [results, setResults] = useState<UploadResult[]>([])

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '갤러리',
      dataIndex: 'galleryUrl',
      key: 'galleryUrl',
      width: 150,
      ellipsis: true,
      render: (url: string) => {
        const match = url.match(/id=(\w+)/)
        return match ? match[1] : url
      },
    },
    {
      title: '상태',
      dataIndex: 'success',
      key: 'status',
      width: 80,
      render: (success: boolean) => <Tag color={success ? 'success' : 'error'}>{success ? '성공' : '실패'}</Tag>,
    },
    {
      title: '결과 메시지',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '작업 ID',
      dataIndex: 'postJobId',
      key: 'postJobId',
      width: 80,
      render: (id?: number) => id || '-',
    },
  ]

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
          setResults([])
          try {
            const res = await uploadDcinsideExcel(file)
            setResults(res)

            const successCount = res.filter((r: UploadResult) => r.success).length
            const totalCount = res.length

            if (successCount === totalCount) {
              message.success(`모든 ${totalCount}개 항목이 성공적으로 처리되었습니다.`)
            } else {
              message.warning(`${totalCount}개 중 ${successCount}개 성공, ${totalCount - successCount}개 실패`)
            }
          } catch (e: any) {
            message.error(e.message || '업로드에 실패했습니다.')
          } finally {
            setLoading(false)
          }
        }}
        style={{ maxWidth: 400 }}
      >
        <Form.Item label="엑셀 파일 업로드" required>
          <Upload
            beforeUpload={file => {
              setFile(file)
              return false
            }}
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

      {results.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <Title level={4}>업로드 결과</Title>
          <Table
            columns={columns}
            dataSource={results.map((item, index) => ({ ...item, key: index }))}
            size="small"
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} / 총 ${total}개 항목`,
            }}
            summary={pageData => {
              const successCount = pageData.filter(item => item.success).length
              const failureCount = pageData.length - successCount

              return (
                <Table.Summary fixed>
                  <Table.Summary.Row>
                    <Table.Summary.Cell index={0} colSpan={2}>
                      <strong>요약</strong>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={2}>
                      <Tag color="success">
                        성공:
                        {successCount}
                      </Tag>
                      <Tag color="error">
                        실패:
                        {failureCount}
                      </Tag>
                    </Table.Summary.Cell>
                    <Table.Summary.Cell index={3} colSpan={2} />
                  </Table.Summary.Row>
                </Table.Summary>
              )
            }}
          />
        </div>
      )}
    </div>
  )
}

export default UploadDcinsideExcelForm
