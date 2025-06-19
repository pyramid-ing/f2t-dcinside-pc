import type { PostJob } from '../../api'
import { Button, Input, message, Popconfirm, Select, Space, Table, Tag } from 'antd'
import React, { useEffect, useState } from 'react'
import { deletePostJob, getPostJobs, retryPostJob } from '../../api'
import PageContainer from '../../components/shared/PageContainer'

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

const ScheduledPostsTable: React.FC = () => {
  const [data, setData] = useState<PostJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')
  const [searchText, setSearchText] = useState('')
  const [sortField, setSortField] = useState('updatedAt')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

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
    } catch {}
    setLoading(false)
  }

  const handleRetry = async (id: number) => {
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

  const handleDelete = async (id: number) => {
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

      <Table
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
            width: 250,
            render: (v: string, row: PostJob) => {
              if (row.status === 'completed' && row.resultUrl) {
                return (
                  <div>
                    <div style={{ marginBottom: '4px' }}>{v || '완료'}</div>
                    <a
                      href={row.resultUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: '#1890ff', fontSize: '12px' }}
                    >
                      등록된 글 보기 →
                    </a>
                  </div>
                )
              }
              return <span style={{ color: '#666' }}>{v || '-'}</span>
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
            width: 120,
            fixed: 'right',
            align: 'center',
            render: (_: any, row: PostJob) => (
              <Space size="small">
                {row.status === 'failed' && (
                  <Button type="primary" size="small" onClick={() => handleRetry(row.id)} style={{ fontSize: '11px' }}>
                    재시도
                  </Button>
                )}
                {row.status !== 'processing' && (
                  <Popconfirm
                    title="정말 삭제하시겠습니까?"
                    onConfirm={() => handleDelete(row.id)}
                    okText="삭제"
                    cancelText="취소"
                  >
                    <Button danger size="small" style={{ fontSize: '11px' }}>
                      삭제
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
      />
    </PageContainer>
  )
}

export default ScheduledPostsTable
