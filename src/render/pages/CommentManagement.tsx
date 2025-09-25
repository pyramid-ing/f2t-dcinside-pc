import React, { useState, useEffect } from 'react'
import { Card, Input, Button, Form, Typography, Row, Col, Table, Select, Space, message, InputNumber } from 'antd'
import { SearchOutlined, PlayCircleOutlined, StopOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PageContainer from '../components/shared/PageContainer'
import { commentApi, PostItem, CommentJob } from '../api/commentApi'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

const SearchSection = styled(Card)`
  margin-bottom: 16px;

  .ant-form-item {
    margin-bottom: 16px;
  }
`

const PostListSection = styled(Card)`
  margin-bottom: 16px;

  .ant-table {
    .ant-table-thead > tr > th {
      background: #fafafa;
      font-weight: 600;
    }
  }
`

const CommentFormSection = styled(Card)`
  .ant-form-item {
    margin-bottom: 16px;
  }
`

const CommentManagement: React.FC = () => {
  const [searchForm] = Form.useForm()
  const [commentForm] = Form.useForm()
  const [posts, setPosts] = useState<PostItem[]>([])
  const [commentJobs, setCommentJobs] = useState<CommentJob[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [taskDelay, setTaskDelay] = useState(3)
  const [nickname, setNickname] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loginId, setLoginId] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')
  const [galleryUrl, setGalleryUrl] = useState<string>('')

  // 컴포넌트 마운트 시 댓글 작업 목록 로드
  useEffect(() => {
    const loadCommentJobs = async () => {
      try {
        const jobs = await commentApi.getCommentJobs()
        setCommentJobs(jobs)
      } catch (error) {
        console.error('Failed to load comment jobs:', error)
      }
    }

    loadCommentJobs()
  }, [])

  // 게시물 검색
  const handleSearch = async (values: { keyword: string; sortType: string }) => {
    setSearchLoading(true)
    try {
      const response = await commentApi.searchPosts({
        keyword: values.keyword,
        sortType: values.sortType as 'new' | 'accuracy',
      })
      setPosts(response.posts)
      message.success(`${response.posts.length}개의 게시물을 찾았습니다.`)
    } catch (error) {
      message.error('게시물 검색에 실패했습니다.')
      console.error('Search error:', error)
    } finally {
      setSearchLoading(false)
    }
  }

  // 댓글 작업 시작
  const handleStartCommentJob = async (values: { comment: string }) => {
    if (selectedPosts.length === 0) {
      message.warning('댓글을 달 게시물을 선택해주세요.')
      return
    }

    try {
      const selectedPostUrls = posts.filter(post => selectedPosts.includes(post.id)).map(post => post.url)

      const newJob = await commentApi.createCommentJob({
        keyword: searchForm.getFieldValue('keyword') || '',
        comment: values.comment,
        postUrls: selectedPostUrls,
        nickname: nickname || undefined,
        password: password || undefined,
        taskDelay,
        galleryUrl: galleryUrl || undefined,
        loginId: loginId || undefined,
        loginPassword: loginPassword || undefined,
      })

      setCommentJobs(prev => [newJob, ...prev])
      message.success('댓글 작업이 시작되었습니다.')
    } catch (error) {
      message.error('댓글 작업 시작에 실패했습니다.')
      console.error('Comment job error:', error)
    }
  }

  // 댓글 작업 중지
  const handleStopJob = async (jobId: string) => {
    try {
      await commentApi.updateJobStatus(jobId, 'STOPPED')
      setCommentJobs(prev => prev.map(job => (job.id === jobId ? { ...job, isRunning: false } : job)))
      message.info('댓글 작업이 중지되었습니다.')
    } catch (error) {
      message.error('댓글 작업 중지에 실패했습니다.')
      console.error('Stop job error:', error)
    }
  }

  // 게시물 선택/해제
  const handleSelectPost = (postId: string, selected: boolean) => {
    if (selected) {
      setSelectedPosts(prev => [...prev, postId])
    } else {
      setSelectedPosts(prev => prev.filter(id => id !== postId))
    }
  }

  // 전체 선택/해제
  const handleSelectAll = (selected: boolean) => {
    if (selected) {
      setSelectedPosts(posts.map(post => post.id))
    } else {
      setSelectedPosts([])
    }
  }

  const postColumns = [
    {
      title: (
        <input
          type="checkbox"
          checked={posts.length > 0 && selectedPosts.length === posts.length}
          onChange={e => handleSelectAll(e.target.checked)}
        />
      ),
      dataIndex: 'selected',
      key: 'selected',
      width: 50,
      render: (_: any, record: PostItem) => (
        <input
          type="checkbox"
          checked={selectedPosts.includes(record.id)}
          onChange={e => handleSelectPost(record.id, e.target.checked)}
        />
      ),
    },
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record: PostItem) => (
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            window.electronAPI.openExternal(record.url)
          }}
          style={{ cursor: 'pointer' }}
        >
          {title}
        </a>
      ),
    },
    {
      title: '게시판',
      dataIndex: 'board',
      key: 'board',
      width: 100,
    },
    {
      title: '날짜',
      dataIndex: 'date',
      key: 'date',
      width: 120,
    },
  ]

  const jobColumns = [
    {
      title: '키워드',
      dataIndex: 'keyword',
      key: 'keyword',
    },
    {
      title: '댓글 내용',
      dataIndex: 'comment',
      key: 'comment',
      ellipsis: true,
    },
    {
      title: '상태',
      dataIndex: 'isRunning',
      key: 'isRunning',
      render: (isRunning: boolean) => (
        <span style={{ color: isRunning ? '#52c41a' : '#d9d9d9' }}>{isRunning ? '진행중' : '중지됨'}</span>
      ),
    },
    {
      title: '시작시간',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '작업',
      key: 'actions',
      render: (record: CommentJob) => (
        <Space>
          {record.isRunning ? (
            <Button size="small" danger icon={<StopOutlined />} onClick={() => handleStopJob(record.id)}>
              중지
            </Button>
          ) : (
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              onClick={async () => {
                try {
                  await commentApi.updateJobStatus(record.id, 'RUNNING')
                  setCommentJobs(prev => prev.map(job => (job.id === record.id ? { ...job, isRunning: true } : job)))
                  message.success('댓글 작업이 재시작되었습니다.')
                } catch (error) {
                  message.error('댓글 작업 재시작에 실패했습니다.')
                  console.error('Restart job error:', error)
                }
              }}
            >
              재시작
            </Button>
          )}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer>
      <Title level={2}>댓글 관리</Title>

      {/* 게시물 검색 섹션 */}
      <SearchSection title="게시물 검색">
        <Form form={searchForm} layout="inline" onFinish={handleSearch}>
          <Form.Item name="keyword" rules={[{ required: true, message: '검색 키워드를 입력해주세요' }]}>
            <Input placeholder="검색할 키워드를 입력하세요 (예: 대출)" style={{ width: 300 }} />
          </Form.Item>
          <Form.Item name="sortType" initialValue="new">
            <Select style={{ width: 120 }}>
              <Option value="new">최신순</Option>
              <Option value="accuracy">정확도순</Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />} loading={searchLoading}>
              검색
            </Button>
          </Form.Item>
        </Form>
      </SearchSection>

      {/* 검색 결과 */}
      {posts.length > 0 && (
        <PostListSection title={`검색 결과 (${posts.length}개)`}>
          <Table columns={postColumns} dataSource={posts} rowKey="id" pagination={{ pageSize: 10 }} size="small" />
        </PostListSection>
      )}

      {/* 댓글 작업 설정 */}
      <CommentFormSection title="댓글 작업 설정">
        <Row gutter={16}>
          <Col span={24}>
            <Form form={commentForm} onFinish={handleStartCommentJob}>
              <Form.Item label="갤러리 URL">
                <Input
                  value={galleryUrl}
                  onChange={e => setGalleryUrl(e.target.value)}
                  placeholder="예: https://gall.dcinside.com/mgallery/board/lists?id=..."
                />
              </Form.Item>

              <Form.Item
                name="comment"
                rules={[{ required: true, message: '댓글 내용을 입력해주세요' }]}
                label="댓글 내용"
              >
                <TextArea rows={4} placeholder="달고자 하는 댓글 내용을 입력하세요" maxLength={400} showCount />
              </Form.Item>

              <Form.Item label="닉네임">
                <Input
                  value={nickname}
                  onChange={e => setNickname(e.target.value)}
                  placeholder="닉네임을 입력하세요"
                  maxLength={20}
                />
              </Form.Item>

              <Form.Item label="비밀번호">
                <Input.Password
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="비밀번호를 입력하세요"
                  maxLength={20}
                />
              </Form.Item>

              <Form.Item label="로그인 ID">
                <Input value={loginId} onChange={e => setLoginId(e.target.value)} placeholder="로그인 ID (선택)" />
              </Form.Item>

              <Form.Item label="로그인 비밀번호">
                <Input.Password
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  placeholder="로그인 비밀번호 (선택)"
                />
              </Form.Item>

              <Form.Item label="작업 간격 (초)">
                <InputNumber
                  min={1}
                  max={60}
                  value={taskDelay}
                  onChange={value => setTaskDelay(value || 3)}
                  style={{ width: '100%' }}
                />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<PlayCircleOutlined />}
                    disabled={selectedPosts.length === 0}
                  >
                    댓글 작업 시작
                  </Button>
                  <Text type="secondary">선택된 게시물: {selectedPosts.length}개</Text>
                </Space>
              </Form.Item>
            </Form>
          </Col>
        </Row>
      </CommentFormSection>

      {/* 댓글 작업 현황 */}
      {commentJobs.length > 0 && (
        <Card title="댓글 작업 현황">
          <Table columns={jobColumns} dataSource={commentJobs} rowKey="id" pagination={{ pageSize: 5 }} size="small" />
        </Card>
      )}
    </PageContainer>
  )
}

export default CommentManagement
