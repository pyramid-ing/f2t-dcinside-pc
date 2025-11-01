import { UploadOutlined, DownloadOutlined } from '@ant-design/icons'
import { Button, Card, message, Table, Typography, Upload, Space } from 'antd'
import React, { useState } from 'react'
import styled from 'styled-components'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography

const PageContainer = styled.div`
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
`

const ResultsSection = styled.div`
  width: 100%;
  max-width: 1400px;
  margin: 0 auto;
`

const ResultsCard = styled(Card)`
  .ant-card-head {
    background: linear-gradient(135deg, #03c75a 0%, #02a548 100%);
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
  max-width: 400px;
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
`

const UploadSection = styled.div`
  margin-bottom: 32px;
`

const UploadCard = styled(Card)`
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: none;

  .ant-card-body {
    padding: 24px;
  }
`

const ActionButton = styled(Button)`
  border-radius: 8px;
  font-weight: 500;
  height: 40px;
  padding: 0 24px;
`

interface QRResult {
  title: string
  url: string
  shortUrl: string
}

interface FailedItem {
  title: string
  url: string
  error: string
}

interface BatchResult {
  results: QRResult[]
  failedItems: FailedItem[]
}

const NaverQRPage: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<BatchResult | null>(null)

  const customRequest = async (options: any) => {
    const { file, onSuccess, onError } = options

    try {
      setLoading(true)
      message.info('엑셀 파일을 업로드하고 있습니다...')

      console.log('업로드할 파일:', file)

      // FormData로 파일 전송
      const formData = new FormData()
      formData.append('file', file as File)

      console.log('FormData 생성 완료, 서버로 전송 중...')

      const response = await fetch('http://localhost:3554/naver-qr/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`)
      }

      const result = await response.json()
      setResults(result)

      const totalCount = result.results.length + result.failedItems.length
      message.success(`총 ${totalCount}개 중 ${result.results.length}개 성공, ${result.failedItems.length}개 실패`)

      onSuccess?.(result)
    } catch (error) {
      message.error(`엑셀 처리 실패: ${error.message}`)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadResults = () => {
    if (!results) return

    const workbook = XLSX.utils.book_new()

    // 성공한 항목들
    const successData = results.results.map(item => ({
      제목: item.title,
      원본URL: item.url,
      단축URL: item.shortUrl,
    }))

    // 실패한 항목들
    const failedData = results.failedItems.map(item => ({
      제목: item.title,
      URL: item.url,
      오류: item.error,
    }))

    // 성공 시트
    if (successData.length > 0) {
      const successSheet = XLSX.utils.json_to_sheet(successData)
      XLSX.utils.book_append_sheet(workbook, successSheet, '성공')
    }

    // 실패 시트
    if (failedData.length > 0) {
      const failedSheet = XLSX.utils.json_to_sheet(failedData)
      XLSX.utils.book_append_sheet(workbook, failedSheet, '실패')
    }

    XLSX.writeFile(workbook, `네이버QR_결과_${new Date().toISOString().slice(0, 10)}.xlsx`)
    message.success('결과 파일이 다운로드되었습니다.')
  }

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: '원본 URL',
      dataIndex: 'url',
      key: 'url',
      width: 250,
      ellipsis: true,
      render: (text: string) => (
        <a href={text} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ),
    },
    {
      title: '단축 URL',
      dataIndex: 'shortUrl',
      key: 'shortUrl',
      width: 250,
      ellipsis: true,
      render: (text: string) => (
        <a href={text} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ),
    },
  ]

  const failedColumns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: 200,
      ellipsis: true,
    },
    {
      title: 'URL',
      dataIndex: 'url',
      key: 'url',
      width: 250,
      ellipsis: true,
      render: (text: string) => (
        <a href={text} target="_blank" rel="noopener noreferrer">
          {text}
        </a>
      ),
    },
    {
      title: '오류 메시지',
      dataIndex: 'error',
      key: 'error',
      width: 300,
      render: (text: string) => (
        <MessageCell>
          <div className="message-text error-text">{text}</div>
        </MessageCell>
      ),
    },
  ]

  return (
    <PageContainer>
      <UploadSection>
        <UploadCard>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Title level={4} style={{ marginBottom: 8 }}>
                네이버 QR 코드 자동 생성
              </Title>
              <Text type="secondary">엑셀 파일에 제목과 URL을 업로드하면 네이버 QR 코드가 자동으로 생성됩니다.</Text>
            </div>

            <Upload accept=".xlsx,.xls" customRequest={customRequest} showUploadList={false} disabled={loading}>
              <ActionButton type="primary" icon={<UploadOutlined />} loading={loading} size="large">
                엑셀 파일 업로드
              </ActionButton>
            </Upload>

            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>
                • 엑셀 파일 형식: 제목, URL (또는 url) 컬럼 필요
                <br />• 브라우저가 자동으로 열리며, 로그인이 필요할 수 있습니다.
                <br />• 각 항목마다 QR 코드 생성이 진행됩니다.
              </Text>
            </div>
          </Space>
        </UploadCard>
      </UploadSection>

      {results && (
        <ResultsSection>
          <StatsRow>
            <StatCard type="total">
              <span className="icon">📊</span>
              <span>전체: {results.results.length + results.failedItems.length}개</span>
            </StatCard>
            <StatCard type="success">
              <span className="icon">✅</span>
              <span>성공: {results.results.length}개</span>
            </StatCard>
            <StatCard type="failed">
              <span className="icon">❌</span>
              <span>실패: {results.failedItems.length}개</span>
            </StatCard>
          </StatsRow>

          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            {results.results.length > 0 && (
              <ResultsCard
                title="✅ 성공한 항목"
                extra={
                  <ActionButton type="primary" icon={<DownloadOutlined />} onClick={handleDownloadResults}>
                    결과 다운로드
                  </ActionButton>
                }
              >
                <Table
                  columns={columns}
                  dataSource={results.results.map((item, index) => ({
                    ...item,
                    key: index,
                  }))}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: total => `총 ${total}개`,
                  }}
                  scroll={{ x: 'max-content' }}
                />
              </ResultsCard>
            )}

            {results.failedItems.length > 0 && (
              <ResultsCard
                title="❌ 실패한 항목"
                extra={
                  <ActionButton type="primary" icon={<DownloadOutlined />} onClick={handleDownloadResults}>
                    결과 다운로드
                  </ActionButton>
                }
              >
                <Table
                  columns={failedColumns}
                  dataSource={results.failedItems.map((item, index) => ({
                    ...item,
                    key: index,
                  }))}
                  pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showTotal: total => `총 ${total}개`,
                  }}
                  scroll={{ x: 'max-content' }}
                />
              </ResultsCard>
            )}
          </Space>
        </ResultsSection>
      )}
    </PageContainer>
  )
}

export default NaverQRPage
