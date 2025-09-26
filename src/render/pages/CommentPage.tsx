import { Card, Tabs } from 'antd'
import React from 'react'
import CommentJobTable from '@render/features/work-management/CommentJobTable'
import CommentManagement from './CommentManagement'
import styled from 'styled-components'

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
  return (
    <PageContainer>
      <ContentCard>
        <Tabs
          defaultActiveKey="upload"
          size="large"
          items={[
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
          ]}
        />
      </ContentCard>
    </PageContainer>
  )
}

export default CommentPage
