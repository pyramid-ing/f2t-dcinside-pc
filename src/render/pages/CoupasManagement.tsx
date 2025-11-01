import React, { useState } from 'react'
import { Card, Button, Typography, Table, Space, message, Upload, Alert } from 'antd'
import { PlayCircleOutlined, FileExcelOutlined, DownloadOutlined, ShoppingOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PageContainer from '../components/shared/PageContainer'
import { coupasApi } from '@render/api'
import * as XLSX from 'xlsx'
import { generateAutoCommentSampleCoupas } from '../utils/sampleExcelGenerator'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'

const { Title, Text } = Typography

const UploadSection = styled(Card)`
  margin-bottom: 16px;

  .ant-form-item {
    margin-bottom: 16px;
  }
`

interface ExcelCoupasData {
  'DC URL': string
  댓글내용: string
  닉네임: string
  비밀번호: string
  로그인ID: string
  로그인비밀번호: string
  예약날짜: string
  워드프레스URL: string
  워드프레스사용자명: string
  워드프레스API키: string
}

interface ParsedCoupasData {
  postUrl: string
  desc: string
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
  scheduledAt?: Date
  wordpressUrl: string
  wordpressUsername: string
  wordpressApiKey: string
}

const CoupasManagement: React.FC = () => {
  const { canAccess } = usePermissions()
  const hasCommentPermission = canAccess(Permission.COMMENT)

  const [excelData, setExcelData] = useState<ParsedCoupasData[]>([])
  const [uploadLoading, setUploadLoading] = useState(false)

  if (!hasCommentPermission) {
    return (
      <PageContainer>
        <Alert
          message="권한이 없습니다"
          description="쿠파스 워크플로우 기능을 사용하려면 '댓글작성' 권한이 필요합니다. 라이센스를 추가로 구매하셔야합니다."
          type="warning"
          showIcon
        />
      </PageContainer>
    )
  }

  // 샘플 엑셀 다운로드 핸들러
  const handleSampleDownload = () => {
    try {
      const fileName = generateAutoCommentSampleCoupas()
      message.success(`쿠파스 워크플로우 샘플 엑셀 파일이 다운로드되었습니다: ${fileName}`)
    } catch (error) {
      message.error('샘플 엑셀 파일 다운로드에 실패했습니다.')
      console.error('Sample download error:', error)
    }
  }

  // 엑셀 파일 업로드 처리
  const handleExcelUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelCoupasData[]

        // 데이터 유효성 검증 및 변환
        const parsedData = jsonData.map((row, index) => {
          // 필수 필드 검증
          if (!row['DC URL'] || !row['댓글내용']) {
            throw new Error(`행 ${index + 2}: DC URL과 댓글내용은 필수입니다.`)
          }

          // 워드프레스 정보 필수 검증
          if (!row['워드프레스URL'] || !row['워드프레스사용자명'] || !row['워드프레스API키']) {
            throw new Error(`행 ${index + 2}: 워드프레스URL, 워드프레스사용자명, 워드프레스API키는 필수입니다.`)
          }

          // 로그인 타입에 따른 필수 필드 검증
          const hasLoginInfo = row['로그인ID'] && row['로그인비밀번호']
          const hasNonLoginInfo = row['닉네임'] && row['비밀번호']

          if (!hasLoginInfo && !hasNonLoginInfo) {
            throw new Error(
              `행 ${index + 2}: 로그인 정보(로그인ID, 로그인비밀번호) 또는 비로그인 정보(닉네임, 비밀번호) 중 하나는 필수입니다.`,
            )
          }

          // 예약날짜 파싱
          let scheduledAt: Date | undefined
          if (row['예약날짜']) {
            const dateStr = row['예약날짜'].toString().trim()
            const parsed = new Date(dateStr)
            if (isNaN(parsed.getTime())) {
              throw new Error(`행 ${index + 2}: 예약날짜 형식이 잘못되었습니다. (YYYY-MM-DD HH:mm 형식)`)
            }
            scheduledAt = parsed
          }

          return {
            postUrl: row['DC URL'],
            desc: row['댓글내용'],
            nickname: row['닉네임'] || undefined,
            password: row['비밀번호'] || undefined,
            loginId: row['로그인ID'] || undefined,
            loginPassword: row['로그인비밀번호'] || undefined,
            scheduledAt,
            wordpressUrl: row['워드프레스URL'],
            wordpressUsername: row['워드프레스사용자명'],
            wordpressApiKey: row['워드프레스API키'],
          }
        })

        setExcelData(parsedData)
        message.success(`${parsedData.length}개의 쿠파스 작업 데이터를 성공적으로 읽었습니다.`)
      } catch (error) {
        message.error(`엑셀 파일 처리 중 오류가 발생했습니다: ${error.message}`)
        console.error('Excel processing error:', error)
      }
    }
    reader.readAsArrayBuffer(file)
    return false // 파일 업로드 방지
  }

  // 엑셀 데이터로 쿠파스 작업 생성
  const handleCreateJobsFromExcel = async () => {
    if (excelData.length === 0) {
      message.warning('업로드된 엑셀 데이터가 없습니다.')
      return
    }

    setUploadLoading(true)
    try {
      let createdCount = 0

      // 쿠파스 작업 생성 (개별로)
      const coupasPromises = excelData.map(async job => {
        try {
          await coupasApi.createCoupasJob({
            postUrl: job.postUrl,
            wordpressUrl: job.wordpressUrl,
            wordpressUsername: job.wordpressUsername,
            wordpressApiKey: job.wordpressApiKey,
            subject: '엑셀 업로드 - 쿠파스 작업',
            desc: job.desc,
            scheduledAt: job.scheduledAt?.toISOString(),
            nickname: job.nickname,
            password: job.password,
            loginId: job.loginId,
            loginPassword: job.loginPassword,
          })
          createdCount++
        } catch (error) {
          console.error(`쿠파스 작업 생성 실패 (${job.postUrl}):`, error)
          throw new Error(`쿠파스 작업 생성 실패: ${job.postUrl}`)
        }
      })

      await Promise.all(coupasPromises)

      message.success(`총 ${createdCount}개의 쿠파스 작업이 생성되었습니다.`)

      // 데이터 초기화
      setExcelData([])
    } catch (error) {
      message.error(`작업 생성에 실패했습니다: ${error.message}`)
      console.error('Bulk job creation error:', error)
    } finally {
      setUploadLoading(false)
    }
  }

  const excelDataColumns = [
    {
      title: 'DC URL',
      dataIndex: 'postUrl',
      key: 'postUrl',
      render: (url: string) => (
        <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px' }}>
          {url.length > 50 ? `${url.substring(0, 50)}...` : url}
        </a>
      ),
    },
    {
      title: '댓글내용',
      dataIndex: 'desc',
      key: 'desc',
      render: (desc: string) => (
        <span style={{ fontSize: '12px' }}>{desc.length > 30 ? `${desc.substring(0, 30)}...` : desc}</span>
      ),
    },
    {
      title: '워드프레스URL',
      dataIndex: 'wordpressUrl',
      key: 'wordpressUrl',
      width: 150,
      render: (url: string) => (
        <span style={{ fontSize: '12px' }}>{url.length > 30 ? `${url.substring(0, 30)}...` : url}</span>
      ),
    },
    {
      title: '닉네임',
      dataIndex: 'nickname',
      key: 'nickname',
      width: 80,
    },
    {
      title: '로그인ID',
      dataIndex: 'loginId',
      key: 'loginId',
      width: 80,
    },
    {
      title: '예약날짜',
      dataIndex: 'scheduledAt',
      key: 'scheduledAt',
      width: 120,
      render: (date: Date) => (date ? date.toLocaleString() : '-'),
    },
  ]

  return (
    <PageContainer>
      <Title level={2}>
        <ShoppingOutlined style={{ marginRight: '8px' }} />
        쿠파스 워크플로우
      </Title>

      {/* 샘플 엑셀 다운로드 섹션 */}
      <UploadSection title="샘플 엑셀 파일 다운로드">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong style={{ fontSize: '16px', color: '#374151' }}>
            📋 쿠파스 워크플로우 샘플 엑셀 파일 다운로드
          </Text>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            쿠파스 워크플로우는 DC 게시글 → 쿠팡 제품 검색 → 워드프레스 포스팅 → 댓글 작성을 자동으로 수행합니다
          </Text>
          <Space size="middle">
            <Button type="primary" icon={<DownloadOutlined />} size="large" onClick={handleSampleDownload}>
              쿠파스 샘플 다운로드
            </Button>
          </Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            • DC 게시글에서 쿠팡 상품명 추출
            <br />
            • 쿠팡 파트너스 API로 상품 검색 및 링크 생성
            <br />
            • 워드프레스에 자동 포스팅
            <br />• DC 게시글에 워드프레스 링크로 댓글 작성
          </Text>
        </Space>
      </UploadSection>

      <UploadSection title="엑셀 파일 업로드">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            엑셀 파일 형식: DC URL, 댓글내용, 닉네임, 비밀번호, 로그인ID, 로그인비밀번호, 예약날짜, 워드프레스URL,
            워드프레스사용자명, 워드프레스API키
          </Text>
          <Text type="secondary">
            필수 항목: DC URL, 댓글내용, (닉네임+비밀번호) 또는 (로그인ID+로그인비밀번호), 워드프레스 정보
          </Text>
          <Text type="secondary" strong style={{ color: '#f59e0b' }}>
            워드프레스 정보 (URL, 사용자명, API키) 필수 입력
          </Text>
          <Upload accept=".xlsx,.xls" beforeUpload={handleExcelUpload} showUploadList={false}>
            <Button icon={<FileExcelOutlined />}>엑셀 파일 선택</Button>
          </Upload>
        </Space>
      </UploadSection>

      {excelData.length > 0 && (
        <>
          <Card title={`업로드된 데이터 (${excelData.length}개)`}>
            <Table
              columns={excelDataColumns}
              dataSource={excelData}
              rowKey={record => `${record.postUrl}-${record.desc}`}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>

          <Card title="쿠파스 작업 생성" style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleCreateJobsFromExcel}
                loading={uploadLoading}
                size="large"
              >
                쿠파스 작업 시작
              </Button>
              <Text type="secondary">총 {excelData.length}개의 쿠파스 작업이 생성됩니다.</Text>
            </Space>
          </Card>
        </>
      )}
    </PageContainer>
  )
}

export default CoupasManagement
