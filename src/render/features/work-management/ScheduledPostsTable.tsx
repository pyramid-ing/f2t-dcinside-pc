import type { PostJob } from '../../api'
import { Button, Input, message, Popconfirm, Popover, Select, Space, Table, Tag, Modal } from 'antd'
import React, { useEffect, useState } from 'react'
import { deletePostJob, getPostJobs, retryPostJob, getJobLogs, getLatestJobLog, type JobLog } from '../../api'
import PageContainer from '../../components/shared/PageContainer'
import styled from 'styled-components'

const ResultCell = styled.div`
  max-width: 100%;
  word-break: break-word;
  line-height: 1.5;

  .result-text {
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

  .pending-text {
    color: #2563eb;
    font-weight: 500;
  }

  .processing-text {
    color: #d97706;
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

    &.pending {
      color: #2563eb;
    }

    &.processing {
      color: #d97706;
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

    &.pending {
      background: #eff6ff;
      border-left-color: #2563eb;
      color: #1e40af;
    }

    &.processing {
      background: #fffbeb;
      border-left-color: #d97706;
      color: #a16207;
    }
  }

  .result-url {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;

    a {
      color: #1890ff;
      text-decoration: none;
      font-weight: 500;

      &:hover {
        text-decoration: underline;
      }
    }
  }
`

const StyledTable = styled(Table)`
  .ant-table-tbody > tr.row-completed {
    background-color: #f6ffed;

    &:hover > td {
      background-color: #e6f7e0 !important;
    }
  }

  .ant-table-tbody > tr.row-failed {
    background-color: #fff2f0;

    &:hover > td {
      background-color: #ffe6e2 !important;
    }
  }

  .ant-table-tbody > tr.row-processing {
    background-color: #fff7e6;

    &:hover > td {
      background-color: #ffeac2 !important;
    }
  }

  .ant-table-tbody > tr.row-pending {
    background-color: #f0f9ff;

    &:hover > td {
      background-color: #e0f2fe !important;
    }
  }
`

const statusColor: Record<string, string> = {
  pending: 'blue',
  processing: 'orange',
  completed: 'green',
  failed: 'red',
}

const statusLabels: Record<string, string> = {
  pending: '대기중',
  processing: '처리중',
  completed: '완료',
  failed: '실패',
}

const statusOptions = [
  { value: '', label: '전체' },
  { value: 'pending', label: '대기중' },
  { value: 'processing', label: '처리중' },
  { value: 'completed', label: '완료' },
  { value: 'failed', label: '실패' },
]

// 갤러리 URL에서 ID 추출하는 함수
function extractGalleryId(galleryUrl: string): string {
  try {
    const url = new URL(galleryUrl)
    const pathParts = url.pathname.split('/')
    const idParam = url.searchParams.get('id')

    if (idParam) {
      return idParam
    }

    // URL 경로에서 갤러리 ID 추출 시도
    const galleryIndex = pathParts.findIndex(part => part === 'board' || part === 'mgallery')
    if (galleryIndex !== -1 && pathParts[galleryIndex + 1]) {
      return pathParts[galleryIndex + 1]
    }

    return galleryUrl
  } catch {
    return galleryUrl
  }
}

// 상태별 기본 메시지
function getDefaultMessage(status: string): string {
  switch (status) {
    case 'pending':
      return '처리 대기 중입니다.'
    case 'processing':
      return '현재 처리 중입니다.'
    case 'completed':
      return '성공적으로 완료되었습니다.'
    case 'failed':
      return '처리 중 오류가 발생했습니다.'
    default:
      return '상태를 확인할 수 없습니다.'
  }
}

// 상태별 타입 반환
function getStatusType(status: string): string {
  switch (status) {
    case 'completed':
      return 'success'
    case 'failed':
      return 'error'
    case 'pending':
      return 'pending'
    case 'processing':
      return 'processing'
    default:
      return 'pending'
  }
}

// 상태별 아이콘
function getStatusIcon(status: string): string {
  switch (status) {
    case 'pending':
      return '⏳'
    case 'processing':
      return '⚙️'
    case 'completed':
      return '🎉'
    case 'failed':
      return '⚠️'
    default:
      return '❓'
  }
}

// 상태별 제목
function getStatusTitle(status: string): string {
  switch (status) {
    case 'pending':
      return '대기 중 상세 정보'
    case 'processing':
      return '처리 중 상세 정보'
    case 'completed':
      return '완료 상세 정보'
    case 'failed':
      return '실패 원인 상세'
    default:
      return '상세 정보'
  }
}

const ScheduledPostsTable: React.FC = () => {
  const [data, setData] = useState<PostJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // JobLog 모달 관련 state
  const [logModalVisible, setLogModalVisible] = useState(false)
  const [currentJobId, setCurrentJobId] = useState<string>('')
  const [jobLogs, setJobLogs] = useState<JobLog[]>([])
  const [logsLoading, setLogsLoading] = useState(false)
  const [latestLogs, setLatestLogs] = useState<Record<string, JobLog>>({})

  useEffect(() => {
    fetchData()
  }, [statusFilter, searchText, sortField, sortOrder])

  useEffect(() => {
    const timer = setInterval(() => {
      // 자동 새로고침 시에는 현재 검색 조건 유지
      fetchData()
    }, 5000)
    return () => clearInterval(timer)
  }, [statusFilter, searchText, sortField, sortOrder])

  const fetchData = async () => {
    setLoading(true)
    try {
      const json = await getPostJobs({
        status: statusFilter || undefined,
        search: searchText || undefined,
        orderBy: sortField,
        order: sortOrder,
      })
      setData(json)

      // 최신 로그들을 가져와서 요약 표시용으로 저장
      const latestLogsData: Record<string, JobLog> = {}
      for (const job of json) {
        try {
          const latestLog = await getLatestJobLog(job.id)
          if (latestLog) {
            latestLogsData[job.id] = latestLog
          }
        } catch (error) {
          // 로그가 없는 경우는 무시
        }
      }
      setLatestLogs(latestLogsData)
    } catch {}
    setLoading(false)
  }

  const showJobLogs = async (jobId: string) => {
    setCurrentJobId(jobId)
    setLogModalVisible(true)
    setLogsLoading(true)

    try {
      const logs = await getJobLogs(jobId)
      setJobLogs(logs)
    } catch (error) {
      message.error('로그를 불러오는데 실패했습니다')
      setJobLogs([])
    }
    setLogsLoading(false)
  }

  const handleRetry = async (id: string) => {
    try {
      const json = await retryPostJob(id)
      if (json.success) {
        message.success('재시도 요청 완료')
        fetchData()
      } else {
        message.error(json.message || '재시도 실패')
      }
    } catch {
      message.error('재시도 실패')
    }
  }

  const handleDelete = async (id: string) => {
    try {
      const json = await deletePostJob(id)
      if (json.success) {
        message.success('작업이 삭제되었습니다')
        fetchData()
      } else {
        message.error(json.message || '삭제 실패')
      }
    } catch {
      message.error('삭제 실패')
    }
  }

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field)
      setSortOrder(sorter.order === 'ascend' ? 'asc' : 'desc')
    }
  }

  return (
    <PageContainer title="예약 등록/작업 관리">
      <div style={{ marginBottom: '20px' }}>
        <Space size="middle" wrap>
          <Space>
            <span>상태 필터:</span>
            <Select value={statusFilter} onChange={setStatusFilter} options={statusOptions} style={{ width: 120 }} />
          </Space>
          <Space>
            <span>검색:</span>
            <Input.Search
              placeholder="제목, 갤러리, 말머리, 결과 검색"
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              onSearch={fetchData}
              style={{ width: 300 }}
              allowClear
            />
          </Space>
        </Space>
      </div>

      <StyledTable
        rowKey="id"
        dataSource={data}
        loading={loading}
        pagination={{
          pageSize: 15,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) => `${range[0]}-${range[1]} / 총 ${total}개`,
        }}
        onChange={handleTableChange}
        size="middle"
        bordered
        style={{ background: '#fff' }}
        scroll={{ x: 'max-content' }}
        rowClassName={(record: PostJob) => `row-${record.status}`}
        columns={[
          {
            title: 'ID',
            dataIndex: 'id',
            width: 80,
            sorter: true,
            align: 'center',
          },
          {
            title: '제목',
            dataIndex: 'title',
            width: 300,
            sorter: true,
            ellipsis: { showTitle: false },
            render: (text: string) => (
              <span title={text} style={{ cursor: 'default' }}>
                {text}
              </span>
            ),
          },
          {
            title: '상태',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <Tag color={statusColor[v] || 'default'}>{statusLabels[v] || v}</Tag>,
            sorter: true,
            align: 'center',
          },
          {
            title: '결과',
            dataIndex: 'resultMsg',
            width: 350,
            render: (v: string, row: PostJob) => {
              const latestLog = latestLogs[row.id]
              const displayMessage = latestLog ? latestLog.message : v || getDefaultMessage(row.status)
              const statusType = getStatusType(row.status)

              const popoverContent = (
                <PopoverContent>
                  <div className={`popover-header ${statusType}`}>
                    {getStatusIcon(row.status)} {getStatusTitle(row.status)}
                  </div>
                  <div className={`popover-message ${statusType}`}>{displayMessage}</div>
                  {latestLog && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                      최신 로그: {new Date(latestLog.createdAt).toLocaleString('ko-KR')}
                    </div>
                  )}
                  {row.status === 'completed' && row.resultUrl && (
                    <div className="result-url">
                      <a href={row.resultUrl} target="_blank" rel="noopener noreferrer">
                        📝 등록된 글 보기 →
                      </a>
                    </div>
                  )}
                </PopoverContent>
              )

              return (
                <Popover
                  content={popoverContent}
                  title={null}
                  trigger="hover"
                  placement="topLeft"
                  mouseEnterDelay={0.3}
                >
                  <ResultCell>
                    <div className={`result-text hover-hint ${statusType}-text`}>{displayMessage}</div>
                    {row.status === 'completed' && row.resultUrl && (
                      <a
                        href={row.resultUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: '#1890ff', fontSize: '12px' }}
                      >
                        등록된 글 보기 →
                      </a>
                    )}
                  </ResultCell>
                </Popover>
              )
            },
            sorter: true,
          },
          {
            title: '갤러리',
            dataIndex: 'galleryUrl',
            width: 120,
            sorter: true,
            align: 'center',
            render: (url: string) => (
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  background: '#f5f5f5',
                  padding: '2px 6px',
                  borderRadius: '4px',
                }}
              >
                {extractGalleryId(url)}
              </span>
            ),
          },
          {
            title: '예정시간',
            dataIndex: 'scheduledAt',
            width: 160,
            render: (v: string) => (
              <span style={{ fontSize: '12px', color: '#666' }}>{new Date(v).toLocaleString('ko-KR')}</span>
            ),
            sorter: true,
          },
          {
            title: '말머리',
            dataIndex: 'headtext',
            width: 100,
            sorter: true,
            align: 'center',
            render: (text: string) =>
              text ? (
                <Tag color="blue" style={{ fontSize: '11px' }}>
                  {text}
                </Tag>
              ) : (
                '-'
              ),
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 150,
            fixed: 'right',
            align: 'center',
            render: (_: any, row: PostJob) => (
              <Space size="small" direction="vertical">
                <Space size="small">
                  <Button size="small" onClick={() => showJobLogs(row.id)} style={{ fontSize: '11px' }}>
                    상세
                  </Button>
                  {row.status === 'failed' && (
                    <Button
                      type="primary"
                      size="small"
                      onClick={() => handleRetry(row.id)}
                      style={{ fontSize: '11px' }}
                    >
                      재시도
                    </Button>
                  )}
                </Space>
                {row.status !== 'processing' && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => handleDelete(row.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button danger size="small" style={{ fontSize: '11px', width: '100%' }}>
                      삭제
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />

      {/* JobLog 모달 */}
      <Modal
        title={`작업 로그 (ID: ${currentJobId})`}
        open={logModalVisible}
        onCancel={() => setLogModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setLogModalVisible(false)}>
            닫기
          </Button>,
        ]}
        width={800}
      >
        <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
          {logsLoading ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>로그를 불러오는 중...</div>
          ) : jobLogs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>로그가 없습니다.</div>
          ) : (
            <div>
              {jobLogs.map((log, index) => (
                <div
                  key={log.id}
                  style={{
                    padding: '8px 12px',
                    borderBottom: index === jobLogs.length - 1 ? 'none' : '1px solid #f0f0f0',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ color: '#666', fontSize: '11px', marginBottom: '4px' }}>
                    {new Date(log.createdAt).toLocaleString('ko-KR')}
                  </div>
                  <div style={{ color: '#333' }}>{log.message}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </PageContainer>
  )
}

export default ScheduledPostsTable
