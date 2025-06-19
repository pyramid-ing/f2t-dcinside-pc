import { Tabs } from 'antd'
import React from 'react'
import UploadDcinsideExcelForm from './UploadDcinsideExcelForm'

const DashboardTabs: React.FC = () => {
  return (
    <Tabs
      defaultActiveKey="dcinside-excel-upload"
      size="large"
      items={[
        {
          key: 'dcinside-excel-upload',
          label: '디씨 엑셀 업로드',
          children: <UploadDcinsideExcelForm />,
        },
      ]}
    />
  )
}

export default DashboardTabs
