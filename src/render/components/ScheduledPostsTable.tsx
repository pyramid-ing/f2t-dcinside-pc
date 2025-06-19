import type { PostJob } from '../api'
import { Button, message, Select, Space, Table, Tag, Typography } from 'antd'
import React, { useEffect, useState } from 'react'
import { getPostJobs, retryPostJob } from '../api'

const statusColor: Record<string, string> = {
  pending: 'blue',
  completed: 'green',
  failed: 'red',
}

const statusOptions = [
  { value: '', label: '전체' },
  { value: 'pending', label: '대기중' },
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
          { title: 'ID', dataIndex: 'id', width: 60 },
          { title: '갤러리', dataIndex: 'galleryUrl', width: 180 },
          { title: '제목', dataIndex: 'title', width: 200 },
          {
            title: '예정시간',
            dataIndex: 'scheduledAt',
            width: 160,
            render: (v: string) => new Date(v).toLocaleString(),
          },
          {
            title: '상태',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <Tag color={statusColor[v] || 'default'}>{v}</Tag>,
          },
          {
            title: '결과',
            dataIndex: 'resultMsg',
            width: 200,
            render: (v: string) => v || '-',
          },
          {
            title: '말머리',
            dataIndex: 'headtext',
            width: 120,
          },
          {
            title: '액션',
            dataIndex: 'action',
            width: 100,
            render: (_: any, row: PostJob) =>
              row.status === 'failed' || row.status === 'pending'
                ? (
                    <Button size="small" onClick={() => handleRetry(row.id)}>
                      재시도
                    </Button>
                  )
                : null,
          },
        ]}
        scroll={{ x: 1000 }}
      />
    </div>
  )
}

export default ScheduledPostsTable
