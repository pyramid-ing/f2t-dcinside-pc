import { Card, Tabs, Alert } from 'antd'
import React from 'react'
import CommentJobTable from '@render/features/work-management/CommentJobTable'
import CommentManagement from './CommentManagement'
import CommentExtraction from './CommentExtraction'
import PostMonitoring from './PostMonitoring'
import styled from 'styled-components'
import { usePermissions } from '@render/hooks/usePermissions'
import { Permission } from '@render/types/permissions'

const PageContainer = styled.div`
  padding: 24px;
  background: #f5f5f5;
  min-height: 100vh;
`

const ContentCard = styled(Card)`
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  border: none;

  .ant-card-body {
    padding: 0;
  }

  .ant-tabs {
    .ant-tabs-nav {
      margin: 0;
      padding: 0 24px;
      background: #fafafa;
      border-radius: 12px 12px 0 0;

      .ant-tabs-nav-wrap {
        .ant-tabs-nav-list {
          .ant-tabs-tab {
            padding: 16px 24px;
            font-size: 16px;
            font-weight: 500;

            &.ant-tabs-tab-active {
              background: white;
              border-radius: 8px 8px 0 0;
              box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
            }
          }
        }
      }
    }

    .ant-tabs-content-holder {
      .ant-tabs-content {
        .ant-tabs-tabpane {
          padding: 24px;
          background: white;
          border-radius: 0 0 12px 12px;
        }
      }
    }
  }
`

const CommentPage: React.FC = () => {
  const { canAccess } = usePermissions()
  const hasCommentPermission = canAccess(Permission.COMMENT)

  if (!hasCommentPermission) {
    return (
      <PageContainer>
        <ContentCard>
          <Alert
            message="권한이 없습니다"
            description="댓글 작성 기능을 사용하려면 '댓글작성' 권한이 필요합니다. 라이센스를 추가로 구매하셔야합니다."
            type="warning"
            showIcon
            style={{ margin: 24 }}
          />
        </ContentCard>
      </PageContainer>
    )
  }

  return (
    <PageContainer>
      <ContentCard>
        <Tabs
          defaultActiveKey="extraction"
          size="large"
          items={[
            {
              key: 'extraction',
              label: '주제추출',
              children: <CommentExtraction />,
            },
            {
              key: 'upload',
              label: '업로드',
              children: <CommentManagement />,
            },
            {
              key: 'management',
              label: '댓글 작업',
              children: <CommentJobTable />,
            },
            {
              key: 'monitoring',
              label: '게시글 모니터링',
              children: <PostMonitoring />,
            },
          ]}
        />
      </ContentCard>
    </PageContainer>
  )
}

export default CommentPage
