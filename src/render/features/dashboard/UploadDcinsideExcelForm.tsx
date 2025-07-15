import { UploadOutlined } from '@ant-design/icons'
import { uploadDcinsideExcel } from '@render/api'
import { Button, Card, Form, message, Popover, Table, Tag, Typography, Upload } from 'antd'
import React, { useState } from 'react'
import styled from 'styled-components'

const { Title, Text } = Typography

const Container = styled.div`
  width: 100%;
  background: #f5f5f5;
  min-height: 100vh;
  padding: 24px;
`

const UploadSection = styled.div`
  max-width: 600px;
  margin: 0 auto 40px auto;
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
`

const ResultsSection = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
`

const ResultsCard = styled(Card)`
  .ant-card-head {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 12px 12px 0 0;

    .ant-card-head-title {
      color: white;
      font-size: 20px;
      font-weight: 600;
    }
  }

  .ant-card-body {
    padding: 32px;
  }

  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  overflow: hidden;
`

const StatsRow = styled.div`
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 32px;
  flex-wrap: wrap;
`

const StatCard = styled.div<{ type: 'total' | 'success' | 'failed' }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 24px;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);

  ${props => {
    switch (props.type) {
      case 'total':
        return `
          background: linear-gradient(135deg, #e0f2fe 0%, #bae6fd 100%);
          color: #0c4a6e;
          border: 2px solid #7dd3fc;
        `
      case 'success':
        return `
          background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%);
          color: #14532d;
          border: 2px solid #86efac;
        `
      case 'failed':
        return `
          background: linear-gradient(135deg, #fee2e2 0%, #fecaca 100%);
          color: #7f1d1d;
          border: 2px solid #fca5a5;
        `
    }
  }}

  .icon {
    font-size: 20px;
  }
`

const MessageCell = styled.div`
  max-width: 100%;
  word-break: break-word;
  line-height: 1.5;

  .message-text {
    font-size: 14px;
    line-height: 1.6;
    margin-bottom: 4px;
  }

  .success-text {
    color: #16a34a;
    font-weight: 500;
  }

  .error-text {
    color: #dc2626;
    font-weight: 500;
  }

  .hover-hint {
    cursor: help;
    padding: 4px 8px;
    border-radius: 6px;
    transition: background-color 0.2s;

    &:hover {
      background-color: rgba(59, 130, 246, 0.1);
    }
  }
`

const PopoverContent = styled.div`
  max-width: 400px;

  .popover-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    font-size: 16px;
    font-weight: 600;

    &.success {
      color: #16a34a;
    }

    &.error {
      color: #dc2626;
    }
  }

  .popover-message {
    background: #f8fafc;
    padding: 12px;
    border-radius: 8px;
    font-size: 13px;
    line-height: 1.6;
    color: #475569;
    border-left: 3px solid #e2e8f0;
    white-space: pre-wrap;
    word-break: break-word;

    &.success {
      background: #f0fdf4;
      border-left-color: #16a34a;
      color: #15803d;
    }

    &.error {
      background: #fef2f2;
      border-left-color: #dc2626;
      color: #b91c1c;
    }
  }
`

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
      width: '25%',
      render: (text: string) => <Text style={{ fontWeight: '500', fontSize: '14px' }}>{text}</Text>,
    },
    {
      title: '갤러리',
      dataIndex: 'galleryUrl',
      key: 'galleryUrl',
      width: '12%',
      align: 'center' as const,
      render: (url: string) => {
        const match = url.match(/id=(\w+)/)
        const galleryId = match ? match[1] : url
        return (
          <Tag color="blue" style={{ fontFamily: 'monospace' }}>
            {galleryId}
          </Tag>
        )
      },
    },
    {
      title: '상태',
      dataIndex: 'success',
      key: 'status',
      width: '10%',
      align: 'center' as const,
      render: (success: boolean) => (
        <Tag color={success ? 'success' : 'error'} style={{ fontWeight: '600' }}>
          {success ? '✅ 성공' : '❌ 실패'}
        </Tag>
      ),
    },
    {
      title: '결과 메시지',
      dataIndex: 'message',
      key: 'message',
      width: '43%',
      render: (message: string, record: UploadResult) => {
        const displayMessage = message || (record.success ? '처리 완료되었습니다.' : '처리 중 오류가 발생했습니다.')

        const popoverContent = (
          <PopoverContent>
            <div className={`popover-header ${record.success ? 'success' : 'error'}`}>
              {record.success ? '🎉 성공 상세 내용' : '⚠️ 실패 원인 상세'}
            </div>
            <div className={`popover-message ${record.success ? 'success' : 'error'}`}>{displayMessage}</div>
          </PopoverContent>
        )

        return (
          <Popover content={popoverContent} title={null} trigger="hover" placement="topLeft" mouseEnterDelay={0.3}>
            <MessageCell>
              <div className={`message-text hover-hint ${record.success ? 'success-text' : 'error-text'}`}>
                {displayMessage}
              </div>
            </MessageCell>
          </Popover>
        )
      },
    },
    {
      title: '작업 ID',
      dataIndex: 'postJobId',
      key: 'postJobId',
      width: '10%',
      align: 'center' as const,
      render: (id?: number) => (
        <Tag color={id ? 'processing' : 'default'} style={{ fontFamily: 'monospace' }}>
          {id || '-'}
        </Tag>
      ),
    },
  ]

  return (
    <Container>
      <UploadSection>
        <Title level={3} style={{ textAlign: 'center', marginBottom: '24px', color: '#1f2937' }}>
          📄 DC인사이드 게시글 업로드
        </Title>
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
              setResults(res.data)

              const successCount = res.data.filter((r: UploadResult) => r.success).length
              const totalCount = res.data.length

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
              <Button icon={<UploadOutlined />} size="large">
                엑셀 파일 선택
              </Button>
            </Upload>
            <div style={{ marginTop: '8px', fontSize: '13px', color: '#6b7280' }}>
              엑셀 파일의 첫 번째 시트를 사용하며, 첫 번째 행은 헤더로 처리됩니다.
            </div>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} size="large" style={{ width: '100%' }}>
              업로드 시작
            </Button>
          </Form.Item>
        </Form>
      </UploadSection>

      {results.length > 0 && (
        <ResultsSection>
          <ResultsCard
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '24px' }}>📊</span>
                업로드 결과
              </div>
            }
          >
            <StatsRow>
              <StatCard type="total">
                <div className="icon">📋</div>
                <div>총 {results.length}건</div>
              </StatCard>
              <StatCard type="success">
                <div className="icon">✅</div>
                <div>성공 {results.filter(r => r.success).length}건</div>
              </StatCard>
              {results.filter(r => !r.success).length > 0 && (
                <StatCard type="failed">
                  <div className="icon">❌</div>
                  <div>실패 {results.filter(r => !r.success).length}건</div>
                </StatCard>
              )}
            </StatsRow>

            <Table
              columns={columns}
              dataSource={results.map((item, index) => ({ ...item, key: index }))}
              size="middle"
              scroll={{ x: 'max-content' }}
              pagination={{
                pageSize: 8,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) => `${range[0]}-${range[1]} / 총 ${total}개 항목`,
                pageSizeOptions: ['5', '8', '15', '30'],
              }}
              rowClassName={(record: UploadResult) =>
                record.success ? 'ant-table-row-success' : 'ant-table-row-error'
              }
            />
          </ResultsCard>
        </ResultsSection>
      )}
    </Container>
  )
}

export default UploadDcinsideExcelForm
