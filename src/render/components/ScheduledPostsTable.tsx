import type { PostJob } from '../api'
import { Button, message, Popconfirm, Select, Space, Table, Tag, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { deletePostJob, getPostJobs, retryPostJob } from '../api'

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

const ScheduledPostsTable: React.FC = () => {
  const [data, setData] = useState<PostJob[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(() => {
    fetchData()
    const timer = setInterval(fetchData, 5000)
    return () => clearInterval(timer)
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      const json = await getPostJobs()
      setData(json)
    }
    catch {}
    setLoading(false)
  }

  const handleRetry = async (id: number) => {
    try {
      const json = await retryPostJob(id)
      if (json.success) {
        message.success('재시도 요청 완료')
        fetchData()
      }
      else {
        message.error(json.message || '재시도 실패')
      }
    }
    catch {
      message.error('재시도 실패')
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const json = await deletePostJob(id)
      if (json.success) {
        message.success('작업이 삭제되었습니다')
        fetchData()
      }
      else {
        message.error(json.message || '삭제 실패')
      }
    }
    catch {
      message.error('삭제 실패')
    }
  }

  const filteredData = statusFilter ? data.filter(d => d.status === statusFilter) : data

  return (
    <div>
      <Typography.Title level={4}>예약 등록/작업 관리</Typography.Title>
      <Space style={{ marginBottom: 16 }}>
        <span>상태 필터:</span>
        <Select
          value={statusFilter}
          onChange={setStatusFilter}
          options={statusOptions}
          style={{ width: 120 }}
        />
      </Space>
      <Table
        rowKey="id"
        dataSource={filteredData}
        loading={loading}
        pagination={{ pageSize: 10 }}
        columns={[
          { 
            title: 'ID', 
            dataIndex: 'id', 
            width: 60,
            sorter: (a, b) => a.id - b.id,
          },
          { 
            title: '갤러리', 
            dataIndex: 'galleryUrl', 
            width: 180,
            sorter: (a, b) => a.galleryUrl.localeCompare(b.galleryUrl),
          },
          { 
            title: '제목', 
            dataIndex: 'title', 
            width: 200,
            sorter: (a, b) => a.title.localeCompare(b.title),
          },
          {
            title: '예정시간',
            dataIndex: 'scheduledAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
            sorter: (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
          },
          {
            title: '상태',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <Tag color={statusColor[v] || 'default'}>{statusLabels[v] || v}</Tag>,
            sorter: (a, b) => a.status.localeCompare(b.status),
          },
          {
            title: '결과',
            dataIndex: 'resultMsg',
            width: 200,
            render: (v: string, row: PostJob) => {
              if (row.status === 'completed' && row.resultUrl) {
                return (
                  <div>
                    <div>{v || '완료'}</div>
                    <a href={row.resultUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#1890ff' }}>
                      등록된 글 보기
                    </a>
                  </div>
                )
              }
              return v || '-'
            },
          },
          {
            title: '말머리',
            dataIndex: 'headtext',
            width: 120,
            sorter: (a, b) => (a.headtext || '').localeCompare(b.headtext || ''),
          },
          {
            title: '생성시간',
            dataIndex: 'createdAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
            sorter: (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
          },
          {
            title: '수정시간',
            dataIndex: 'updatedAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
            sorter: (a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime(),
            defaultSortOrder: 'descend',
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 150,
            render: (_: any, row: PostJob) => (
              <Space>
                {row.status === 'failed' && (
                  <Button size="small" onClick={() => handleRetry(row.id)}>
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
                    <Button size="small" danger>
                      삭제
                    </Button>
                  </Popconfirm>
                )}
              </Space>
            ),
          },
        ]}
        scroll={{ x: 1400 }}
      />
    </div>
  )
}

export default ScheduledPostsTable
