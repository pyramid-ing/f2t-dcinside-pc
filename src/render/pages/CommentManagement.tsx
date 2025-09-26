import React, { useState } from 'react'
import { Card, Input, Button, Form, Typography, Row, Col, Table, Select, Space, message } from 'antd'
import { SearchOutlined, PlayCircleOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PageContainer from '../components/shared/PageContainer'
import { commentApi, PostItem } from '../api/commentApi'

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
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedPosts, setSelectedPosts] = useState<string[]>([])
  const [nickname, setNickname] = useState<string>('')
  const [password, setPassword] = useState<string>('')
  const [loginId, setLoginId] = useState<string>('')
  const [loginPassword, setLoginPassword] = useState<string>('')

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
      // 선택된 게시물들의 URL과 제목 가져오기
      const selectedPostsData = posts.filter(post => selectedPosts.includes(post.id))
      const selectedPostUrls = selectedPostsData.map(post => post.url)
      const selectedPostTitles = selectedPostsData.map(post => post.title)

      // 각 게시물에 대해 개별 댓글 작업 생성
      const jobs = await commentApi.createCommentJob({
        keyword: searchForm.getFieldValue('keyword') || '검색된 게시물',
        comment: values.comment,
        postUrls: selectedPostUrls,
        postTitles: selectedPostTitles,
        nickname: nickname || undefined,
        password: password || undefined,
        loginId: loginId || undefined,
        loginPassword: loginPassword || undefined,
      })

      message.success(`${jobs.length}개의 댓글 작업이 생성되었습니다.`)

      // 선택된 게시물 초기화
      setSelectedPosts([])
      commentForm.resetFields()
    } catch (error) {
      message.error('댓글 작업 생성에 실패했습니다.')
      console.error('Create comment job error:', error)
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
    </PageContainer>
  )
}

export default CommentManagement
