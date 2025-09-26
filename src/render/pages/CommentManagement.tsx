import React, { useState } from 'react'
import { Card, Button, Typography, Table, Space, message, Upload, Dropdown } from 'antd'
import { PlayCircleOutlined, FileExcelOutlined, DownloadOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PageContainer from '../components/shared/PageContainer'
import { commentApi, BulkCommentJobRequest } from '../api/commentApi'
import * as XLSX from 'xlsx'
import {
  generateAutoCommentSampleNonMemberGallery,
  generateAutoCommentSampleNonMemberNickname,
  generateAutoCommentSampleMember,
} from '../utils/sampleExcelGenerator'

const { Title, Text } = Typography

const UploadSection = styled(Card)`
  margin-bottom: 16px;

  .ant-form-item {
    margin-bottom: 16px;
  }
`

interface ExcelCommentData {
  'DC URL': string
  댓글내용: string
  닉네임: string
  비밀번호: string
  로그인ID: string
  로그인비밀번호: string
  예약날짜: string
}

interface ParsedCommentData {
  postUrl: string
  comment: string
  nickname?: string
  password?: string
  loginId?: string
  loginPassword?: string
  scheduledAt?: Date
}

const CommentManagement: React.FC = () => {
  const [excelData, setExcelData] = useState<ParsedCommentData[]>([])
  const [uploadLoading, setUploadLoading] = useState(false)

  // 샘플 엑셀 다운로드 핸들러
  const handleSampleDownload = (type: 'nonMemberGallery' | 'nonMemberNickname' | 'member') => {
    try {
      let fileName = ''
      switch (type) {
        case 'nonMemberGallery':
          fileName = generateAutoCommentSampleNonMemberGallery()
          message.success(`비회원 갤러리닉 샘플 엑셀 파일이 다운로드되었습니다: ${fileName}`)
          break
        case 'nonMemberNickname':
          fileName = generateAutoCommentSampleNonMemberNickname()
          message.success(`비회원 닉네임입력 샘플 엑셀 파일이 다운로드되었습니다: ${fileName}`)
          break
        case 'member':
          fileName = generateAutoCommentSampleMember()
          message.success(`회원 샘플 엑셀 파일이 다운로드되었습니다: ${fileName}`)
          break
      }
    } catch (error) {
      message.error('샘플 엑셀 파일 다운로드에 실패했습니다.')
      console.error('Sample download error:', error)
    }
  }

  const commentSampleMenuItems = [
    {
      key: 'nonMemberGallery',
      label: '비회원 (갤러리닉)',
      onClick: () => handleSampleDownload('nonMemberGallery'),
    },
    {
      key: 'nonMemberNickname',
      label: '비회원 (닉네임입력)',
      onClick: () => handleSampleDownload('nonMemberNickname'),
    },
    {
      key: 'member',
      label: '회원',
      onClick: () => handleSampleDownload('member'),
    },
  ]

  // 엑셀 파일 업로드 처리
  const handleExcelUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const worksheet = workbook.Sheets[sheetName]
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as ExcelCommentData[]

        // 데이터 유효성 검증 및 변환
        const parsedData = jsonData.map((row, index) => {
          // 필수 필드 검증
          if (!row['DC URL'] || !row['댓글내용']) {
            throw new Error(`행 ${index + 2}: DC URL과 댓글내용은 필수입니다.`)
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
            comment: row['댓글내용'],
            nickname: row['닉네임'] || undefined,
            password: row['비밀번호'] || undefined,
            loginId: row['로그인ID'] || undefined,
            loginPassword: row['로그인비밀번호'] || undefined,
            scheduledAt,
          }
        })

        setExcelData(parsedData)
        message.success(`${parsedData.length}개의 댓글 데이터를 성공적으로 읽었습니다.`)
      } catch (error) {
        message.error(`엑셀 파일 처리 중 오류가 발생했습니다: ${error.message}`)
        console.error('Excel processing error:', error)
      }
    }
    reader.readAsArrayBuffer(file)
    return false // 파일 업로드 방지
  }

  // 엑셀 데이터로 댓글 작업 생성
  const handleCreateJobsFromExcel = async () => {
    if (excelData.length === 0) {
      message.warning('업로드된 엑셀 데이터가 없습니다.')
      return
    }

    setUploadLoading(true)
    try {
      const bulkRequest: BulkCommentJobRequest = {
        keyword: '엑셀 업로드',
        commentJobs: excelData,
      }

      const jobs = await commentApi.createBulkCommentJobs(bulkRequest)
      message.success(`${jobs.length}개의 댓글 작업이 생성되었습니다.`)

      // 데이터 초기화
      setExcelData([])
    } catch (error) {
      message.error('댓글 작업 생성에 실패했습니다.')
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
      dataIndex: 'comment',
      key: 'comment',
      render: (comment: string) => (
        <span style={{ fontSize: '12px' }}>{comment.length > 30 ? `${comment.substring(0, 30)}...` : comment}</span>
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
      <Title level={2}>댓글 관리</Title>

      {/* 샘플 엑셀 다운로드 섹션 */}
      <UploadSection title="샘플 엑셀 파일 다운로드">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text strong style={{ fontSize: '16px', color: '#374151' }}>
            📋 댓글 샘플 엑셀 파일 다운로드
          </Text>
          <Text type="secondary" style={{ fontSize: '14px' }}>
            댓글 엑셀 파일 형식을 확인하고 샘플 데이터로 테스트해보세요
          </Text>
          <Space size="middle">
            <Dropdown menu={{ items: commentSampleMenuItems }} placement="bottomCenter">
              <Button type="primary" icon={<DownloadOutlined />} size="large">
                댓글 샘플 다운로드
              </Button>
            </Dropdown>
          </Space>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            • 비회원 (갤러리닉): 갤러리 닉네임 사용, 닉네임/비밀번호 불필요
            <br />
            • 비회원 (닉네임입력): 직접 닉네임 입력, 닉네임+비밀번호 필수
            <br />• 회원: 로그인ID+로그인비밀번호 필수
          </Text>
        </Space>
      </UploadSection>

      <UploadSection title="엑셀 파일 업로드">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary">
            엑셀 파일 형식: DC URL, 댓글내용, 닉네임, 비밀번호, 로그인ID, 로그인비밀번호, 예약날짜
          </Text>
          <Text type="secondary">필수 항목: DC URL, 댓글내용, (닉네임+비밀번호) 또는 (로그인ID+로그인비밀번호)</Text>
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
              rowKey={(record, index) => `${record.postUrl}-${index}`}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>

          <Card title="댓글 작업 생성" style={{ marginTop: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlayCircleOutlined />}
                onClick={handleCreateJobsFromExcel}
                loading={uploadLoading}
                size="large"
              >
                댓글 작업 시작
              </Button>
              <Text type="secondary">총 {excelData.length}개의 댓글 작업이 생성됩니다.</Text>
            </Space>
          </Card>
        </>
      )}
    </PageContainer>
  )
}

export default CommentManagement
