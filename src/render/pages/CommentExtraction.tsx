import React, { useState } from 'react'
import { Card, Input, Button, Form, Typography, Table, Select, Space, message, InputNumber } from 'antd'
import { SearchOutlined, DownloadOutlined } from '@ant-design/icons'
import styled from 'styled-components'
import PageContainer from '../components/shared/PageContainer'
import { commentApi, PostItem } from '../api/commentApi'
import * as XLSX from 'xlsx'

const { Title, Text } = Typography
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

const ActionSection = styled(Card)`
  .ant-form-item {
    margin-bottom: 16px;
  }
`

// ExtractedPost는 PostDetail과 동일하므로 별도 정의 불필요

const CommentExtraction: React.FC = () => {
  const [searchForm] = Form.useForm()
  const [posts, setPosts] = useState<PostItem[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [extractionLoading, setExtractionLoading] = useState(false)
  const [pageSize, setPageSize] = useState<number>(100)

  // 게시물 검색
  const handleSearch = async (values: { keyword: string; sortType: string; maxCount: number }) => {
    setSearchLoading(true)
    try {
      const response = await commentApi.searchPosts({
        keyword: values.keyword,
        sortType: values.sortType as 'new' | 'accuracy',
        maxCount: values.maxCount,
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

  // 엑셀 다운로드
  const handleDownloadExcel = async () => {
    if (posts.length === 0) {
      message.warning('다운로드할 게시물이 없습니다.')
      return
    }

    setExtractionLoading(true)
    try {
      // 검색 결과에서 바로 엑셀 데이터 준비
      const excelData = posts.map(post => ({
        제목: post.title,
        'DC URL': post.url,
        요약: post.summary || '',
        갤러리명: post.galleryName || post.board,
        등록일자: post.date,
      }))

      // 워크시트 생성
      const worksheet = XLSX.utils.json_to_sheet(excelData)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, '게시물 목록')

      // 파일명 생성
      const keyword = searchForm.getFieldValue('keyword') || '게시물'
      const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
      const fileName = `댓글_주제추출_${keyword}_${timestamp}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(workbook, fileName)
      message.success(`${posts.length}개의 게시물이 엑셀 파일로 다운로드되었습니다.`)
    } catch (error) {
      message.error('엑셀 다운로드에 실패했습니다.')
      console.error('Excel download error:', error)
    } finally {
      setExtractionLoading(false)
    }
  }

  const postColumns = [
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
      <Title level={2}>댓글 주제 추출</Title>

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
          <Form.Item
            name="maxCount"
            initialValue={100}
            rules={[{ required: true, message: '최대 추출 개수를 입력해주세요' }]}
          >
            <InputNumber min={25} max={1000} placeholder="최대 개수" style={{ width: 120 }} addonAfter="개" />
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
          <Table
            columns={postColumns}
            dataSource={posts}
            rowKey="id"
            pagination={{
              pageSize,
              showSizeChanger: true,
              showQuickJumper: true,
              pageSizeOptions: ['10', '50', '100', '200', '500'],
              showTotal: (total, range) => `${range[0]}-${range[1]} / ${total}개`,
              onShowSizeChange: (_, size) => setPageSize(size),
              onChange: (_page, size) => {
                if (size && size !== pageSize) {
                  setPageSize(size)
                }
              },
              size: 'default',
            }}
            size="small"
          />
        </PostListSection>
      )}

      {/* 액션 섹션 */}
      {posts.length > 0 && (
        <ActionSection title="엑셀 다운로드">
          <Space>
            <Button
              type="primary"
              icon={<DownloadOutlined />}
              onClick={handleDownloadExcel}
              loading={extractionLoading}
              size="large"
            >
              엑셀 파일 다운로드
            </Button>
            <Text type="secondary">다운로드 항목: 제목, DC URL, 요약, 갤러리명, 등록일자</Text>
          </Space>
        </ActionSection>
      )}
    </PageContainer>
  )
}

export default CommentExtraction
